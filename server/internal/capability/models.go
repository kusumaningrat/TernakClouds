package capability

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/internal/models"
)

// Name constants for the capability catalogue.
const (
	CapRuntime       = "runtime"
	CapSecrets       = "secrets"
	CapNetworking    = "networking"
	CapObservability = "observability"
	CapStorage       = "storage"
	CapLogs          = "logs"
)

// Capability is a seeded catalogue row describing a platform capability type.
type Capability struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string    `gorm:"uniqueIndex;not null" json:"name"`
	DisplayName string    `gorm:"not null"             json:"display_name"`
	Description string    `                            json:"description"`
}

// Provider is a seeded catalogue row describing a concrete provider implementation.
type Provider struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Name           string    `gorm:"uniqueIndex;not null" json:"name"`
	DisplayName    string    `gorm:"not null"             json:"display_name"`
	CapabilityName string    `gorm:"not null;index"       json:"capability_name"`
	Description    string    `                            json:"description"`
}

// CapabilityBinding records that an environment has a particular capability
// enabled (or explicitly disabled). One row per (environment, capability) pair.
type CapabilityBinding struct {
	models.Base
	EnvironmentID   uuid.UUID        `gorm:"type:uuid;not null;uniqueIndex:idx_env_cap" json:"environment_id"`
	CapabilityName  string           `gorm:"not null;uniqueIndex:idx_env_cap"           json:"capability_name"`
	IsEnabled       bool             `gorm:"not null;default:true"                      json:"is_enabled"`
	ProviderConfigs []ProviderConfig `gorm:"foreignKey:CapabilityBindingID"             json:"provider_configs,omitempty"`
}

// ProviderConfig stores the non-secret configuration for one provider bound to
// a capability. Multiple providers can be bound per capability binding.
// Credentials are stored in Vault; only the vault path is kept here.
type ProviderConfig struct {
	models.Base
	CapabilityBindingID uuid.UUID `gorm:"type:uuid;not null;index:idx_binding_provider,unique" json:"capability_binding_id"`
	ProviderName        string    `gorm:"not null;index:idx_binding_provider,unique"          json:"provider_name"`
	DisplayName         string    `gorm:"not null"                                            json:"display_name"`
	Endpoint            string    `gorm:"not null"                                            json:"endpoint"`
	Region              string    `                                                           json:"region,omitempty"`
	Namespace           string    `                                                           json:"namespace,omitempty"`
	VaultPath           string    `gorm:"not null"                                            json:"-"`
	CredentialType      string    `gorm:"not null;default:'token'"                            json:"credential_type"`
	CreatedBy           uuid.UUID `gorm:"type:uuid"                                           json:"created_by"`
}
