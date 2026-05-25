package servicecatalog

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"text/template"

	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/internal/capability"
	"github.com/kusumaningrat/idp-backend/internal/nomad"
	"github.com/kusumaningrat/idp-backend/internal/registry"
	"github.com/kusumaningrat/idp-backend/internal/vault"
)

// hclTemplate uses [[ ]] as Go template delimiters so that Nomad's Consul
// Template syntax ({{ }}) inside vault template blocks passes through as-is.
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

    network {
      port "http" {
        static       = [[.ExposedPort]]
        to           = [[.ContainerPort]]
        host_network = "private"
      }
    }

    service {
      name = "[[.JobName]]"
      tags = ["apps", "catalog"]
      port = "http"
      check {
        name     = "health"
        type     = "[[.HealthCheckType]]"
        port     = "http"
        [[- if eq .HealthCheckType "http"]]
        path     = "[[.HealthCheckPath]]"
        [[- end]]
        interval = "30s"
        timeout  = "10s"
      }
    }

    constraint {
      attribute = "${attr.unique.hostname}"
      value     = "[[.WorkerName]]"
    }

    task "[[.JobName]]" {
      driver = "docker"

      config {
        image = "[[.Image]]"
        ports = ["http"]
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

type jobTemplateVars struct {
	JobName          string
	Datacenter       string
	Namespace        string
	WorkerName       string
	ExposedPort      int
	ContainerPort    int
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

type Service struct {
	repo         *Repository
	nomadSvc     *nomad.Service
	registryRepo *registry.Repository
	capRepo      *capability.Repository
	vault        vault.Client
}

func NewService(repo *Repository, nomadSvc *nomad.Service, registryRepo *registry.Repository, capRepo *capability.Repository, vc vault.Client) *Service {
	return &Service{
		repo:         repo,
		nomadSvc:     nomadSvc,
		registryRepo: registryRepo,
		capRepo:      capRepo,
		vault:        vc,
	}
}

func (s *Service) ListCatalog() ([]CatalogItem, error) {
	return s.repo.ListCatalog()
}

func (s *Service) ListDeployments(envID uuid.UUID) ([]ServiceDeployment, error) {
	return s.repo.ListDeployments(envID)
}

func (s *Service) GetDeployment(id uuid.UUID) (*ServiceDeployment, error) {
	return s.repo.FindDeployment(id)
}

func (s *Service) Deploy(ctx context.Context, workspaceID, envID, callerID uuid.UUID, input DeployInput) (*ServiceDeployment, error) {
	item, err := s.repo.FindCatalogByName(input.CatalogName)
	if err != nil {
		return nil, err
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

	// Resolve the full Consul Template vault path. When env_mappings are provided
	// the secrets are written to the environment's bound Vault instance first.
	vaultTemplatePath := ""
	if input.VaultPath != "" {
		p, vErr := s.writeVaultSecrets(ctx, envID, input.VaultPath, input.EnvMappings)
		if vErr != nil {
			return nil, fmt.Errorf("vault secrets: %w", vErr)
		}
		vaultTemplatePath = p
	}

	vars := jobTemplateVars{
		JobName:          input.JobName,
		Datacenter:       input.Datacenter,
		Namespace:        input.Namespace,
		WorkerName:       input.WorkerName,
		ExposedPort:      input.ExposedPort,
		ContainerPort:    item.DefaultContainerPort,
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

	hcl, err := renderHCL(vars)
	if err != nil {
		return nil, fmt.Errorf("render template: %w", err)
	}

	if err := s.nomadSvc.DeployHCL(ctx, envID, hcl); err != nil {
		return nil, fmt.Errorf("nomad deploy: %w", err)
	}

	// Job ID in Nomad is deterministic from the HCL job block name.
	nomadJobID := input.JobName + "-App"

	d := &ServiceDeployment{
		WorkspaceID:   workspaceID,
		EnvironmentID: envID,
		CatalogName:   input.CatalogName,
		JobName:       input.JobName,
		Datacenter:    input.Datacenter,
		Namespace:     input.Namespace,
		WorkerName:    input.WorkerName,
		ExposedPort:   input.ExposedPort,
		ContainerPort: item.DefaultContainerPort,
		CPU:           cpu,
		Memory:        memory,
		Image:         image,
		RegistryID:    registryID,
		NomadJobID:    nomadJobID,
		Status:        StatusRunning,
		DeployedBy:    callerID,
		JobDefinition: hcl,
	}
	if err := s.repo.CreateDeployment(d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *Service) StopAndDelete(ctx context.Context, id, envID uuid.UUID) error {
	d, err := s.repo.FindDeployment(id)
	if err != nil {
		return err
	}
	// Attempt to stop the Nomad job; ignore errors if the job is already gone.
	_, _ = s.nomadSvc.StopJob(ctx, envID, d.NomadJobID, d.Namespace, false)
	return s.repo.DeleteDeployment(id)
}

// resolveImage returns the full image URI, optional Docker auth credentials,
// and the registry UUID that was used (nil for public images).
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

// buildPublicImageURI replaces the tag portion of a default image string, or
// returns the default image unchanged when tagOverride is empty.
func buildPublicImageURI(defaultImage, tagOverride string) string {
	if tagOverride == "" {
		return defaultImage
	}
	if idx := strings.LastIndex(defaultImage, ":"); idx != -1 {
		return defaultImage[:idx+1] + tagOverride
	}
	return defaultImage + ":" + tagOverride
}

// buildImageURI constructs the full image reference for a given registry type.
func buildImageURI(providerType, endpoint, imagePath, tag string) string {
	if providerType == "dockerhub" {
		return imagePath + ":" + tag
	}
	return endpoint + "/" + imagePath + ":" + tag
}

// writeVaultSecrets looks up the `secrets` capability for the environment,
// optionally writes the provided key-value pairs to that Vault instance, and
// returns the full Consul Template path (e.g. "secret/data/myapp/env") that
// the Nomad template block should reference.
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

func renderHCL(vars jobTemplateVars) (string, error) {
	var buf bytes.Buffer
	if err := parsedHCLTemplate.Execute(&buf, vars); err != nil {
		return "", err
	}
	return buf.String(), nil
}
