package registry

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/internal/models"
)

type RegistryProvider struct {
	models.Base
	WorkspaceID  uuid.UUID `gorm:"type:uuid;not null;index"        json:"workspace_id"`
	Name         string    `gorm:"not null"                        json:"name"`
	ProviderType string    `gorm:"not null"                        json:"provider_type"`
	Endpoint     string    `json:"endpoint,omitempty"`
	VaultPath    string    `json:"-"`
	Description  string    `json:"description,omitempty"`
}

// RegistryBinding links a workspace-level registry to an environment in read-only mode.
type RegistryBinding struct {
	models.Base
	EnvironmentID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:uq_registry_binding" json:"environment_id"`
	RegistryID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:uq_registry_binding" json:"registry_id"`
	AllowedPaths  []string  `gorm:"serializer:json"                                    json:"allowed_paths,omitempty"`
}
