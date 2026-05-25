package servicecatalog

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/internal/models"
)

// CatalogItem is a seeded, read-only entry describing a deployable service template.
type CatalogItem struct {
	ID                   uuid.UUID `gorm:"type:uuid;primaryKey"   json:"id"`
	Name                 string    `gorm:"uniqueIndex;not null"   json:"name"`
	DisplayName          string    `gorm:"not null"               json:"display_name"`
	Description          string    `                              json:"description"`
	DefaultImage         string    `gorm:"not null"               json:"default_image"`
	DefaultContainerPort int       `gorm:"not null"               json:"default_container_port"`
	DefaultCPU           int       `gorm:"not null"               json:"default_cpu"`
	DefaultMemory        int       `gorm:"not null"               json:"default_memory"`
	// HealthCheckType is "http" or "tcp".
	HealthCheckType string `gorm:"not null"              json:"health_check_type"`
	// HealthCheckPath is the HTTP path used when HealthCheckType == "http".
	HealthCheckPath string `json:"health_check_path,omitempty"`
	// IsPublicImage signals that DefaultImage can be pulled without a registry binding.
	IsPublicImage bool `gorm:"not null;default:true" json:"is_public_image"`
}

// ServiceDeployment records a catalog item that has been deployed to an environment.
type ServiceDeployment struct {
	models.Base
	WorkspaceID   uuid.UUID  `gorm:"type:uuid;not null;index"    json:"workspace_id"`
	EnvironmentID uuid.UUID  `gorm:"type:uuid;not null;index"    json:"environment_id"`
	CatalogName   string     `gorm:"not null"                    json:"catalog_name"`
	JobName       string     `gorm:"not null"                    json:"job_name"`
	Datacenter    string     `gorm:"not null"                    json:"datacenter"`
	Namespace     string     `gorm:"not null;default:'default'"  json:"namespace"`
	WorkerName    string     `gorm:"not null"                    json:"worker_name"`
	ExposedPort   int        `gorm:"not null"                    json:"exposed_port"`
	ContainerPort int        `gorm:"not null"                    json:"container_port"`
	CPU           int        `gorm:"not null"                    json:"cpu"`
	Memory        int        `gorm:"not null"                    json:"memory"`
	Image         string     `gorm:"not null"                    json:"image"`
	// RegistryID is nil for public images.
	RegistryID    *uuid.UUID `gorm:"type:uuid"                   json:"registry_id,omitempty"`
	NomadJobID    string     `gorm:"not null"                    json:"nomad_job_id"`
	Status        string     `gorm:"not null;default:'running'"  json:"status"`
	DeployedBy    uuid.UUID  `gorm:"type:uuid;not null"          json:"deployed_by"`
	// JobDefinition stores the exact HCL that was rendered and submitted to Nomad.
	JobDefinition string `gorm:"type:text"                   json:"job_definition"`
}
