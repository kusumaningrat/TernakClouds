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
	ErrRegistryRequired   = errors.New("registry_id required for non-public catalog items")
	ErrNoVaultCapability  = errors.New("no vault provider found in the secrets capability for this environment")
)

type DeployInput struct {
	CatalogName string `json:"catalog_name" binding:"required"`
	JobName     string `json:"job_name"     binding:"required"`
	Datacenter  string `json:"datacenter"   binding:"required"`
	// Namespace is the Nomad namespace to deploy into (e.g. "default", "production").
	// Use GET /workspaces/:slug/environments/:envSlug/nomad/namespaces to list available namespaces.
	Namespace   string `json:"namespace"    binding:"required"`
	WorkerName  string `json:"worker_name"  binding:"required"`
	ExposedPort int    `json:"exposed_port" binding:"required"`
	CPU         *int   `json:"cpu"`
	Memory      *int   `json:"memory"`
	// For private images, RegistryID + ImagePath + ImageTag are all required.
	RegistryID string `json:"registry_id"`
	ImagePath  string `json:"image_path"`
	// ImageTag overrides the default tag embedded in DefaultImage.
	// For public images it replaces the tag portion; for private images it is the tag.
	ImageTag string `json:"image_tag"`
	// Vault integration — optional. When VaultRole is set a vault{} block is added
	// to the task. When VaultPath is also set, a template{} block injects environment
	// variables from the environment's bound Vault KV engine at runtime.
	// VaultPath is the relative path within the KV engine (e.g. "myapp/env").
	// EnvMappings holds the actual secret values to write; the IDP stores them in
	// the environment's Vault instance automatically on deploy.
	VaultRole   string            `json:"vault_role"`
	VaultPath   string            `json:"vault_path"`
	EnvMappings map[string]string `json:"env_mappings"` // { "ENV_VAR": "actual_secret_value" }
}
