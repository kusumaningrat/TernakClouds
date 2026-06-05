package servicecatalog

import "errors"

const (
	StatusRunning = "running"
	StatusStopped = "stopped"
	StatusFailed  = "failed"
)

var (
	ErrCatalogNotFound    = errors.New("catalog item not found")
	ErrDeploymentNotFound = errors.New("deployment not found")
	ErrRegistryNotBound   = errors.New("registry not bound to this environment")
	ErrRegistryRequired   = errors.New("A registry must be selected for private catalog items.")
	ErrNoVaultCapability  = errors.New("Secret storage is not available for this environment. Please configure a Vault provider.")
	ErrUnsupportedRuntime = errors.New("unsupported runtime provider; use 'nomad', 'kubernetes', or 'docker'")
	ErrInvalidPortBinding = errors.New("host port cannot be bound without a container port")
)

type DeployInput struct {
	CatalogName string `json:"catalog_name" binding:"required"`
	JobName     string `json:"job_name"     binding:"required"`
	// RuntimeProvider selects the deployment target. Defaults to "nomad" when omitted.
	RuntimeProvider string `json:"runtime_provider"`
	ExposedPort     *int   `json:"exposed_port"`
	CPU             *int   `json:"cpu"`
	Memory          *int   `json:"memory"`

	// ── Nomad-specific ──────────────────────────────────────────────────────
	Datacenter string `json:"datacenter"`
	Namespace  string `json:"namespace"`
	WorkerName string `json:"worker_name"`

	// ── Kubernetes-specific ─────────────────────────────────────────────────
	K8sNamespace string `json:"k8s_namespace"`
	Replicas     *int   `json:"replicas"`
	// K8sNodeName pins the deployment to a specific node via nodeSelector (optional).
	K8sNodeName string `json:"k8s_node_name"`

	// ── Registry ────────────────────────────────────────────────────────────
	RegistryID string `json:"registry_id"`
	ImagePath  string `json:"image_path"`
	ImageTag   string `json:"image_tag"`

	// ── Vault (Nomad only) ──────────────────────────────────────────────────
	VaultRole   string            `json:"vault_role"`
	VaultPath   string            `json:"vault_path"`
	EnvMappings map[string]string `json:"env_mappings"`

	// ── Environment variables (all runtimes) ────────────────────────────────
	EnvVars map[string]string `json:"env_vars"`
}
