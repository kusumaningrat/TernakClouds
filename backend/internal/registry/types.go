package registry

import "errors"

const (
	ProviderTypeHarbor    = "harbor"
	ProviderTypeDockerHub = "dockerhub"
	ProviderTypeGHCR      = "ghcr"
	ProviderTypeECR       = "ecr"
	ProviderTypeGCR       = "gcr"
)

var validProviderTypes = map[string]bool{
	ProviderTypeHarbor:    true,
	ProviderTypeDockerHub: true,
	ProviderTypeGHCR:      true,
	ProviderTypeECR:       true,
	ProviderTypeGCR:       true,
}

var (
	ErrNotFound        = errors.New("registry not found")
	ErrForbidden       = errors.New("forbidden")
	ErrBindingExists   = errors.New("registry already bound to this environment")
	ErrBindingNotFound = errors.New("binding not found")
	ErrInvalidProvider = errors.New("unsupported registry provider type")
)

type CreateProviderInput struct {
	Name         string            `json:"name"          binding:"required"`
	ProviderType string            `json:"provider_type" binding:"required"`
	Endpoint     string            `json:"endpoint"`
	Description  string            `json:"description"`
	Credentials  map[string]string `json:"credentials"`
}

type UpdateProviderInput struct {
	Name        *string           `json:"name"`
	Endpoint    *string           `json:"endpoint"`
	Description *string           `json:"description"`
	Credentials map[string]string `json:"credentials"`
}

type CreateBindingInput struct {
	RegistryID   string   `json:"registry_id"   binding:"required"`
	AllowedPaths []string `json:"allowed_paths"`
}

type ProviderResponse struct {
	ID           string `json:"id"`
	WorkspaceID  string `json:"workspace_id"`
	Name         string `json:"name"`
	ProviderType string `json:"provider_type"`
	Endpoint     string `json:"endpoint,omitempty"`
	Description  string `json:"description,omitempty"`
	CreatedAt    string `json:"created_at"`
}

type BindingResponse struct {
	ID               string   `json:"id"`
	EnvironmentID    string   `json:"environment_id"`
	RegistryID       string   `json:"registry_id"`
	RegistryName     string   `json:"registry_name,omitempty"`
	RegistryType     string   `json:"registry_type,omitempty"`
	RegistryEndpoint string   `json:"registry_endpoint,omitempty"`
	AllowedPaths     []string `json:"allowed_paths,omitempty"`
	CreatedAt        string   `json:"created_at"`
}

// BindingWithProvider is an internal join result used by the repository layer.
type BindingWithProvider struct {
	RegistryBinding
	RegistryName     string `gorm:"column:registry_name"`
	RegistryType     string `gorm:"column:registry_type"`
	RegistryEndpoint string `gorm:"column:registry_endpoint"`
}
