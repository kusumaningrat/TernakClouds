package servicecatalog

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"text/template"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/capability"
	"github.com/kusumaningrat/ternakclouds/internal/docker"
	"github.com/kusumaningrat/ternakclouds/internal/kubernetes"
	"github.com/kusumaningrat/ternakclouds/internal/nomad"
	"github.com/kusumaningrat/ternakclouds/internal/registry"
	"github.com/kusumaningrat/ternakclouds/internal/vault"
)

// ── Nomad HCL template ────────────────────────────────────────────────────────

const hclTemplate = `job "[[.JobName]]-App" {
  datacenters = ["[[.Datacenter]]"]
  type        = "service"
  namespace   = "[[.Namespace]]"

  update {
    max_parallel     = 1
    health_check     = "task_states"
    min_healthy_time = "30s"
  }

  group "[[.JobName]]" {
    count = 1
    [[- if .Ports]]

    network {
      [[- range .Ports]]
      port "[[.Name]]" {
        [[- if .ExposedPort]]
        static       = [[.ExposedPort]]
        [[- end]]
        to           = [[.ContainerPort]]
        host_network = "[[.HostNetwork]]"
      }
      [[- end]]
    }

    service {
      name = "[[.JobName]]"
      tags = ["apps", "catalog"]
      port = "[[.PrimaryPortName]]"
      check {
        name     = "health"
        type     = "[[.HealthCheckType]]"
        port     = "[[.PrimaryPortName]]"
        [[- if eq .HealthCheckType "http"]]
        path     = "[[.HealthCheckPath]]"
        [[- end]]
        interval = "30s"
        timeout  = "10s"
      }
    }
    [[- end]]

    constraint {
      attribute = "${attr.unique.hostname}"
      value     = "[[.WorkerName]]"
    }

    task "[[.JobName]]" {
      driver = "docker"

      config {
        image = "[[.Image]]"
        [[- if .Ports]]
        ports = [[print "["]][[range $i, $p := .Ports]][[if $i]], [[end]]"[[$p.Name]]"[[end]]]
        [[- end]]
        [[- if .RegistryUsername]]
        auth {
          username = "[[.RegistryUsername]]"
          password = "[[.RegistryPassword]]"
        }
        [[- end]]
        dns_servers = ["172.17.0.1", "172.18.0.1", "8.8.8.8", "8.8.4.4", "1.1.1.1"]
      }

      [[- if .VaultRole]]

      vault {
        role = "[[.VaultRole]]"
      }
      [[- end]]
      [[- if .VaultPath]]

      template {
        destination = "secrets/env"
        env         = true
        data        = <<EOF
{{ with secret "[[.VaultPath]]" }}{{ range $k, $v := .Data.data }}{{ $k }}="{{ $v }}"
{{ end }}{{ end }}
EOF
      }
      [[- end]]

      resources {
        cpu    = [[.CPU]]
        memory = [[.Memory]]
      }
    }
  }
}`

type nomadPort struct {
	Name          string
	ContainerPort int
	ExposedPort   int // 0 = no static host binding
}

type nomadTemplateVars struct {
	JobName          string
	Datacenter       string
	Namespace        string
	WorkerName       string
	Ports            []nomadPort
	PrimaryPortName  string
	HostNetwork      string
	CPU              int
	Memory           int
	Image            string
	HealthCheckType  string
	HealthCheckPath  string
	RegistryUsername string
	RegistryPassword string
	VaultRole        string
	VaultPath        string
}

var parsedHCLTemplate = template.Must(
	template.New("catalog-nomad").Delims("[[", "]]").Parse(hclTemplate),
)

// ── Kubernetes YAML template ──────────────────────────────────────────────────

const k8sTemplate = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{.JobName}}
  namespace: {{.Namespace}}
  labels:
    app: {{.JobName}}
    managed-by: ternak-idp
    catalog: {{.CatalogName}}
spec:
  replicas: {{.Replicas}}
  selector:
    matchLabels:
      app: {{.JobName}}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: {{.JobName}}
    spec:
      {{- if .NodeName}}
      nodeSelector:
        kubernetes.io/hostname: {{.NodeName}}
      {{- end}}
      containers:
        - name: {{.JobName}}
          image: {{.Image}}
          ports:
            {{- range .Ports}}
            - containerPort: {{.ContainerPort}}
              name: {{.Name}}
            {{- end}}
          resources:
            requests:
              cpu: "{{.CPU}}m"
              memory: "{{.MemoryMB}}Mi"
            limits:
              cpu: "{{.CPULimit}}m"
              memory: "{{.MemoryLimitMB}}Mi"
          {{- if and .PrimaryPort (eq .HealthCheckType "http")}}
          readinessProbe:
            httpGet:
              path: {{.HealthCheckPath}}
              port: {{.PrimaryPort}}
            initialDelaySeconds: 15
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: {{.HealthCheckPath}}
              port: {{.PrimaryPort}}
            initialDelaySeconds: 30
            periodSeconds: 30
          {{- end}}
---
apiVersion: v1
kind: Service
metadata:
  name: {{.JobName}}
  namespace: {{.Namespace}}
  labels:
    app: {{.JobName}}
spec:
  selector:
    app: {{.JobName}}
  ports:
    {{- range .Ports}}
    - protocol: TCP
      port: {{.ContainerPort}}
      targetPort: {{.ContainerPort}}
      name: {{.Name}}
      {{- if .NodePort}}
      nodePort: {{.NodePort}}
      {{- end}}
    {{- end}}
  type: {{if .HasNodePort}}NodePort{{else}}ClusterIP{{end}}
`

type k8sPort struct {
	Name          string
	ContainerPort int
	NodePort      int // 0 = ClusterIP only (no host binding)
}

type k8sCatalogTemplateVars struct {
	JobName         string
	CatalogName     string
	Namespace       string
	Replicas        int
	Image           string
	Ports           []k8sPort
	PrimaryPort     int // container port used for health probes; 0 = no probe
	HasNodePort     bool
	CPU             int
	CPULimit        int
	MemoryMB        int
	MemoryLimitMB   int
	HealthCheckType string
	HealthCheckPath string
	NodeName        string
}

var parsedK8sTemplate = template.Must(
	template.New("catalog-k8s").Parse(k8sTemplate),
)

// ── Service ───────────────────────────────────────────────────────────────────

type Service struct {
	repo          *Repository
	nomadSvc      *nomad.Service
	kubernetesSvc *kubernetes.Service
	dockerSvc     *docker.Service
	registryRepo  *registry.Repository
	capRepo       *capability.Repository
	vault         vault.Client
}

func NewService(
	repo *Repository,
	nomadSvc *nomad.Service,
	kubernetesSvc *kubernetes.Service,
	dockerSvc *docker.Service,
	registryRepo *registry.Repository,
	capRepo *capability.Repository,
	vc vault.Client,
) *Service {
	return &Service{
		repo:          repo,
		nomadSvc:      nomadSvc,
		kubernetesSvc: kubernetesSvc,
		dockerSvc:     dockerSvc,
		registryRepo:  registryRepo,
		capRepo:       capRepo,
		vault:         vc,
	}
}

func (s *Service) ListCatalog() ([]CatalogItem, error) {
	return s.repo.ListCatalog()
}

func (s *Service) ListDeployments(ctx context.Context, envID uuid.UUID) ([]ServiceDeployment, error) {
	// Fetch recorded deployments from DB
	deployments, err := s.repo.ListDeployments(envID)
	if err != nil {
		return nil, err
	}

	var out []ServiceDeployment

	// Reconcile with provider state for runtime-specific cleanup/status
	for _, d := range deployments {
		// Only reconcile Nomad deployments for now
		if d.RuntimeProvider == "nomad" {
			// RuntimeJobID for Nomad is expected to be the Nomad job ID
			job, err := s.nomadSvc.GetJob(ctx, envID, d.RuntimeJobID, d.Namespace)
			if err != nil {
				// If the job is not found on the provider, remove the DB record so
				// the UI stays in sync with provider state. We detect this by
				// looking for a 404 in the Nomad client error message.
				if strings.Contains(err.Error(), " 404") || strings.Contains(err.Error(), "404:") {
					_ = s.repo.DeleteDeployment(d.ID)
					continue
				}
				// For other errors, surface unknown status in the listing
				d.Status = "unknown"
			} else {
				// If job exists, try to derive a sensible status from the job payload
				if statusRaw, ok := job["Status"].(string); ok {
					d.Status = strings.ToLower(statusRaw)
				}
			}
		}

		out = append(out, d)
	}

	return out, nil
}

func (s *Service) GetDeployment(id uuid.UUID) (*ServiceDeployment, error) {
	return s.repo.FindDeployment(id)
}

// ── Port helpers ─────────────────────────────────────────────────────────────

func primaryPortName(defs []PortDef) string {
	for _, d := range defs {
		if d.Primary {
			return d.Name
		}
	}
	if len(defs) > 0 {
		return defs[0].Name
	}
	return ""
}

func primaryContainerPort(defs []PortDef) int {
	for _, d := range defs {
		if d.Primary {
			return d.ContainerPort
		}
	}
	if len(defs) > 0 {
		return defs[0].ContainerPort
	}
	return 0
}

// defaultMappings builds zero-ExposedPort mappings from catalog PortDefs.
func defaultMappings(defs []PortDef) []PortMapping {
	out := make([]PortMapping, 0, len(defs))
	for _, d := range defs {
		out = append(out, PortMapping{
			Name:          d.Name,
			ContainerPort: d.ContainerPort,
			Protocol:      d.Protocol,
		})
	}
	return out
}

func toNomadPorts(mappings []PortMapping) []nomadPort {
	out := make([]nomadPort, 0, len(mappings))
	for _, m := range mappings {
		out = append(out, nomadPort{
			Name:          m.Name,
			ContainerPort: m.ContainerPort,
			ExposedPort:   m.ExposedPort,
		})
	}
	return out
}

func toK8sPorts(mappings []PortMapping) ([]k8sPort, bool) {
	out := make([]k8sPort, 0, len(mappings))
	hasNodePort := false
	for _, m := range mappings {
		if m.ExposedPort > 0 {
			hasNodePort = true
		}
		out = append(out, k8sPort{
			Name:          m.Name,
			ContainerPort: m.ContainerPort,
			NodePort:      m.ExposedPort,
		})
	}
	return out, hasNodePort
}

func (s *Service) Deploy(ctx context.Context, workspaceID, envID, callerID uuid.UUID, input DeployInput) (*ServiceDeployment, error) {
	item, err := s.repo.FindCatalogByName(input.CatalogName)
	if err != nil {
		return nil, err
	}

	runtimeProvider := input.RuntimeProvider
	if runtimeProvider == "" {
		runtimeProvider = "nomad"
	}

	image, regUsername, regPassword, registryID, err := s.resolveImage(ctx, envID, item, input)
	if err != nil {
		return nil, err
	}

	cpu := item.DefaultCPU
	if input.CPU != nil {
		cpu = *input.CPU
	}
	memory := item.DefaultMemory
	if input.Memory != nil {
		memory = *input.Memory
	}

	// Resolve port mappings: prefer user-supplied, fall back to catalog defaults.
	defaultDefs, err := item.ParseDefaultPorts()
	if err != nil {
		return nil, fmt.Errorf("parse catalog ports: %w", err)
	}
	portMappings := input.Ports
	if len(portMappings) == 0 {
		portMappings = defaultMappings(defaultDefs)
	}
	primName := primaryPortName(defaultDefs)
	primPort := primaryContainerPort(defaultDefs)

	var (
		runtimeJobID  string
		nomadJobID    string
		jobDefinition string
		namespace     string
	)

	switch runtimeProvider {
	case "nomad":
		namespace = input.Namespace
		if namespace == "" {
			namespace = "default"
		}
		runtimeJobID, nomadJobID, jobDefinition, err = s.deployNomad(ctx, envID, item, portMappings, primName, input, image, regUsername, regPassword, cpu, memory, namespace)
		if err != nil {
			return nil, err
		}

	case "kubernetes":
		namespace = input.K8sNamespace
		if namespace == "" {
			namespace = "default"
		}
		runtimeJobID, jobDefinition, err = s.deployKubernetes(ctx, envID, item, portMappings, primPort, input, image, cpu, memory, namespace)
		if err != nil {
			return nil, err
		}

	case "docker":
		runtimeJobID, err = s.deployDocker(ctx, envID, item, portMappings, input, image, cpu, memory)
		if err != nil {
			return nil, err
		}

	default:
		return nil, ErrUnsupportedRuntime
	}

	portsJSON, err := json.Marshal(portMappings)
	if err != nil {
		return nil, fmt.Errorf("marshal ports: %w", err)
	}

	d := &ServiceDeployment{
		WorkspaceID:     workspaceID,
		EnvironmentID:   envID,
		CatalogName:     input.CatalogName,
		JobName:         input.JobName,
		Datacenter:      input.Datacenter,
		Namespace:       namespace,
		WorkerName:      input.WorkerName,
		Ports:           portsJSON,
		CPU:             cpu,
		Memory:          memory,
		Image:           image,
		RegistryID:      registryID,
		NomadJobID:      nomadJobID,
		RuntimeProvider: runtimeProvider,
		RuntimeJobID:    runtimeJobID,
		Status:          StatusRunning,
		DeployedBy:      callerID,
		JobDefinition:   jobDefinition,
	}
	if err := s.repo.CreateDeployment(d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *Service) deployNomad(
	ctx context.Context,
	envID uuid.UUID,
	item *CatalogItem,
	portMappings []PortMapping,
	primPortName string,
	input DeployInput,
	image, regUsername, regPassword string,
	cpu, memory int,
	namespace string,
) (runtimeJobID, nomadJobID, hcl string, err error) {
	vaultTemplatePath := ""
	if input.VaultPath != "" {
		vaultTemplatePath, err = s.writeVaultSecrets(ctx, envID, input.VaultPath, input.EnvMappings)
		if err != nil {
			return "", "", "", fmt.Errorf("vault secrets: %w", err)
		}
	}

	hostNetwork := input.NomadHostNetwork
	if hostNetwork != "public" {
		hostNetwork = "private"
	}

	vars := nomadTemplateVars{
		JobName:          input.JobName,
		Datacenter:       input.Datacenter,
		Namespace:        namespace,
		WorkerName:       input.WorkerName,
		Ports:            toNomadPorts(portMappings),
		PrimaryPortName:  primPortName,
		HostNetwork:      hostNetwork,
		CPU:              cpu,
		Memory:           memory,
		Image:            image,
		HealthCheckType:  item.HealthCheckType,
		HealthCheckPath:  item.HealthCheckPath,
		RegistryUsername: regUsername,
		RegistryPassword: regPassword,
		VaultRole:        input.VaultRole,
		VaultPath:        vaultTemplatePath,
	}

	hcl, err = renderNomadHCL(vars)
	if err != nil {
		return "", "", "", fmt.Errorf("render nomad template: %w", err)
	}
	if err = s.nomadSvc.DeployHCL(ctx, envID, hcl); err != nil {
		return "", "", "", fmt.Errorf("nomad deploy: %w", err)
	}

	nomadJobID = input.JobName + "-App"
	runtimeJobID = nomadJobID
	return runtimeJobID, nomadJobID, hcl, nil
}

func (s *Service) deployKubernetes(
	ctx context.Context,
	envID uuid.UUID,
	item *CatalogItem,
	portMappings []PortMapping,
	primContainerPort int,
	input DeployInput,
	image string,
	cpu, memory int,
	namespace string,
) (runtimeJobID, yamlManifest string, err error) {
	replicas := 1
	if input.Replicas != nil && *input.Replicas > 0 {
		replicas = *input.Replicas
	}

	k8sPorts, hasNodePort := toK8sPorts(portMappings)

	vars := k8sCatalogTemplateVars{
		JobName:         input.JobName,
		CatalogName:     input.CatalogName,
		Namespace:       namespace,
		Replicas:        replicas,
		Image:           image,
		Ports:           k8sPorts,
		PrimaryPort:     primContainerPort,
		HasNodePort:     hasNodePort,
		CPU:             cpu,
		CPULimit:        cpu * 2,
		MemoryMB:        memory,
		MemoryLimitMB:   memory * 2,
		HealthCheckType: item.HealthCheckType,
		HealthCheckPath: item.HealthCheckPath,
		NodeName:        input.K8sNodeName,
	}

	yamlManifest, err = renderK8sYAML(vars)
	if err != nil {
		return "", "", fmt.Errorf("render kubernetes template: %w", err)
	}

	runtimeJobID, err = s.kubernetesSvc.DeployYAML(ctx, envID, yamlManifest)
	if err != nil {
		return "", "", fmt.Errorf("kubernetes deploy: %w", err)
	}
	return runtimeJobID, yamlManifest, nil
}

func (s *Service) deployDocker(
	ctx context.Context,
	envID uuid.UUID,
	item *CatalogItem,
	portMappings []PortMapping,
	input DeployInput,
	image string,
	cpu, memory int,
) (runtimeJobID string, err error) {
	var env []string
	for k, v := range input.EnvVars {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}
	dockerPorts := make([]docker.PortConfig, 0, len(portMappings))
	for _, pm := range portMappings {
		dockerPorts = append(dockerPorts, docker.PortConfig{
			ContainerPort: pm.ContainerPort,
			HostPort:      pm.ExposedPort,
			Protocol:      pm.Protocol,
		})
	}
	cfg := docker.ContainerRunConfig{
		Image:    image,
		Name:     input.JobName,
		Ports:    dockerPorts,
		CPU:      cpu,
		MemoryMB: memory,
		Env:      env,
		Labels:   map[string]string{"catalog": input.CatalogName},
	}
	runtimeJobID, err = s.dockerSvc.RunContainer(ctx, envID, cfg)
	if err != nil {
		return "", fmt.Errorf("docker deploy: %w", err)
	}
	return runtimeJobID, nil
}

func (s *Service) StopAndDelete(ctx context.Context, id, envID uuid.UUID) error {
	d, err := s.repo.FindDeployment(id)
	if err != nil {
		return err
	}

	switch d.RuntimeProvider {
	case "kubernetes":
		parts := strings.SplitN(d.RuntimeJobID, "/", 2)
		if len(parts) == 2 && s.kubernetesSvc != nil {
			_ = s.kubernetesSvc.DeleteResources(ctx, envID, parts[0], parts[1])
		}
	case "docker":
		if d.RuntimeJobID != "" && s.dockerSvc != nil {
			_ = s.dockerSvc.StopAndRemoveContainer(ctx, envID, d.RuntimeJobID)
		}
	default:
		// nomad (including legacy empty RuntimeProvider)
		if d.NomadJobID != "" {
			_, _ = s.nomadSvc.StopJob(ctx, envID, d.NomadJobID, d.Namespace, false)
		}
	}

	return s.repo.DeleteDeployment(id)
}

// resolveImage returns the full image URI, optional registry credentials,
// and the registry UUID (nil for public images).
func (s *Service) resolveImage(
	ctx context.Context,
	envID uuid.UUID,
	item *CatalogItem,
	input DeployInput,
) (image, username, password string, registryID *uuid.UUID, err error) {
	if item.IsPublicImage {
		image = buildPublicImageURI(item.DefaultImage, input.ImageTag)
		return
	}

	if input.RegistryID == "" {
		err = ErrRegistryRequired
		return
	}
	regID, parseErr := uuid.Parse(input.RegistryID)
	if parseErr != nil {
		err = fmt.Errorf("invalid registry_id: %w", parseErr)
		return
	}

	binding, findErr := s.registryRepo.FindBinding(envID, regID)
	if findErr != nil {
		err = findErr
		return
	}
	if binding == nil {
		err = ErrRegistryNotBound
		return
	}

	provider, findErr := s.registryRepo.FindProviderByID(regID)
	if findErr != nil {
		err = findErr
		return
	}

	tag := input.ImageTag
	if tag == "" {
		tag = "latest"
	}
	image = buildImageURI(provider.ProviderType, provider.Endpoint, input.ImagePath, tag)
	registryID = &regID

	if provider.VaultPath != "" && s.vault != nil {
		creds, vaultErr := s.vault.ReadKV(ctx, provider.VaultPath)
		if vaultErr != nil {
			err = fmt.Errorf("read registry credentials: %w", vaultErr)
			return
		}
		username = creds["username"]
		password = creds["password"]
	}
	return
}

func buildPublicImageURI(defaultImage, tagOverride string) string {
	if tagOverride == "" {
		return defaultImage
	}
	if idx := strings.LastIndex(defaultImage, ":"); idx != -1 {
		return defaultImage[:idx+1] + tagOverride
	}
	return defaultImage + ":" + tagOverride
}

func buildImageURI(providerType, endpoint, imagePath, tag string) string {
	if providerType == "dockerhub" {
		return imagePath + ":" + tag
	}
	return endpoint + "/" + imagePath + ":" + tag
}

func (s *Service) writeVaultSecrets(ctx context.Context, envID uuid.UUID, vaultPath string, secrets map[string]string) (string, error) {
	binding, err := s.capRepo.FindBinding(envID, capability.CapSecrets)
	if err != nil {
		return "", err
	}
	if binding == nil {
		return "", ErrNoVaultCapability
	}

	var vaultPC *capability.ProviderConfig
	for i := range binding.ProviderConfigs {
		if binding.ProviderConfigs[i].ProviderName == "vault" {
			vaultPC = &binding.ProviderConfigs[i]
			break
		}
	}
	if vaultPC == nil {
		return "", ErrNoVaultCapability
	}

	kvMount := vaultPC.Namespace
	if kvMount == "" {
		kvMount = "secret"
	}

	vaultPath = strings.TrimPrefix(strings.TrimLeft(vaultPath, "/"), kvMount+"/")

	if len(secrets) > 0 {
		token, err := s.vault.RetrieveToken(ctx, vaultPC.VaultPath)
		if err != nil {
			return "", fmt.Errorf("retrieve vault token: %w", err)
		}
		envVault := vault.NewFromToken(vaultPC.Endpoint, token, kvMount)
		if err := envVault.WriteKV(ctx, vaultPath, secrets); err != nil {
			return "", fmt.Errorf("write secrets: %w", err)
		}
	}

	return kvMount + "/data/" + vaultPath, nil
}

func renderNomadHCL(vars nomadTemplateVars) (string, error) {
	var buf bytes.Buffer
	if err := parsedHCLTemplate.Execute(&buf, vars); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func renderK8sYAML(vars k8sCatalogTemplateVars) (string, error) {
	var buf bytes.Buffer
	if err := parsedK8sTemplate.Execute(&buf, vars); err != nil {
		return "", err
	}
	return buf.String(), nil
}
