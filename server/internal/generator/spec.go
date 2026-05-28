package generator

// PlatformSpec is the normalized specification consumed by all generators.
// It is provider-agnostic: generators translate it into runtime-specific manifests.
type PlatformSpec struct {
	Service       ServiceSpec       `json:"service"`
	Runtime       RuntimeSpec       `json:"runtime"`
	Container     ContainerSpec     `json:"container"`
	Deployment    DeploymentSpec    `json:"deployment"`
	Registry      RegistrySpec      `json:"registry"`
	Secrets       SecretsSpec       `json:"secrets"`
	CICD          CICDSpec          `json:"cicd"`
	Observability ObservabilitySpec `json:"observability"`
}

type ServiceSpec struct {
	// Name is the logical service name (slug format, e.g. "payments-api").
	Name string `json:"name"`
	// Type is the blueprint category: "web-api", "worker", "cron-job", "static-website", "background-processor".
	Type string `json:"type"`
}

type RuntimeSpec struct {
	// Provider is "nomad", "kubernetes", or "docker".
	Provider string `json:"provider"`
	// Variant selects the manifest template variant.
	// Nomad: "" (default = v1), "no-vault", "with-volume".
	// Kubernetes: "" (default = v1), "with-hpa", "with-ingress", "with-pvc".
	Variant string `json:"variant,omitempty"`

	// ── Nomad ────────────────────────────────────────────────────────────────
	Datacenter string `json:"datacenter,omitempty"`
	Namespace  string `json:"namespace,omitempty"`
	WorkerName string `json:"worker_name,omitempty"`

	// ── Kubernetes ───────────────────────────────────────────────────────────
	K8sNamespace string `json:"k8s_namespace,omitempty"`
	Replicas     int    `json:"replicas,omitempty"`

	// ── Docker ───────────────────────────────────────────────────────────────
	Network string `json:"network,omitempty"`
}

type ContainerSpec struct {
	// Image is the full image reference without a tag (e.g. "nginx", "harbor.example.com/myorg/myapp").
	Image    string `json:"image"`
	Tag      string `json:"tag"`
	Port     int    `json:"port"`
	CPU      int    `json:"cpu"`      // MHz (Nomad) / millicores (K8s)
	MemoryMB int    `json:"memory_mb"` // megabytes

	// Auth for private registries — populated by the provisioning service.
	RegistryUsername string `json:"registry_username,omitempty"`
	RegistryPassword string `json:"registry_password,omitempty"`
}

type DeploymentSpec struct {
	// Strategy is "rolling", "recreate", or "canary".
	Strategy string `json:"strategy"`
}

type RegistrySpec struct {
	Provider   string `json:"provider,omitempty"` // "harbor", "dockerhub", "ghcr", "ecr"
	RegistryID string `json:"registry_id,omitempty"`
	Endpoint   string `json:"endpoint,omitempty"`
	ImagePath  string `json:"image_path,omitempty"`
}

type SecretsSpec struct {
	Provider string `json:"provider,omitempty"` // "vault"
	// VaultRole is the Nomad vault{} role name.
	VaultRole string `json:"vault_role,omitempty"`
	// VaultPath is the full Consul Template path (e.g. "secret/data/myapp/env").
	VaultPath string `json:"vault_path,omitempty"`
}

type CICDSpec struct {
	// Provider is "github-actions", "gitlab-ci", or "jenkins".
	Provider string `json:"provider,omitempty"`
	Enabled  bool   `json:"enabled"`
	// Branch is the deployment trigger branch (default "main").
	Branch string `json:"branch,omitempty"`
	// Style selects the deploy method within the provider:
	// "" (default = "v1" / IDP API), "ssh", "nomad", "kubectl", "helm".
	Style string `json:"style,omitempty"`
}

type ObservabilitySpec struct {
	LogsEnabled    bool              `json:"logs_enabled"`
	MetricsEnabled bool              `json:"metrics_enabled"`
	// Labels are injected as metadata for log/metric correlation.
	Labels map[string]string `json:"labels,omitempty"`
}
