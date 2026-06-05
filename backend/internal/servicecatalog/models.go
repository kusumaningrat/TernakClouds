package servicecatalog

import (
	"encoding/json"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/models"
	"gorm.io/datatypes"
)

// PortDef describes a single port exposed by a catalog item template.
type PortDef struct {
	Name          string `json:"name"`
	ContainerPort int    `json:"container_port"`
	Protocol      string `json:"protocol,omitempty"` // "tcp" or "udp"; default "tcp"
	// Primary marks this port as the one used for health checks (Nomad service block).
	// If none is marked primary, the first port is used.
	Primary bool `json:"primary,omitempty"`
}

// PortMapping is a resolved port binding at deploy time: container port + optional host port.
type PortMapping struct {
	Name          string `json:"name"`
	ContainerPort int    `json:"container_port"`
	// ExposedPort is the host-side port. 0 means the port is container-internal only.
	ExposedPort int    `json:"exposed_port,omitempty"`
	Protocol    string `json:"protocol,omitempty"`
}

// CatalogItem is a seeded, read-only entry describing a deployable service template.
type CatalogItem struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey"   json:"id"`
	Name        string    `gorm:"uniqueIndex;not null"   json:"name"`
	DisplayName string    `gorm:"not null"               json:"display_name"`
	Description string    `                              json:"description"`
	// Category groups items in the catalog UI (e.g. "Application", "Database", "Cache").
	Category string `gorm:"not null;default:''" json:"category"`
	// DefaultPorts lists the ports this service template exposes.
	DefaultPorts datatypes.JSON `gorm:"type:jsonb" json:"default_ports"`
	DefaultImage string         `gorm:"not null"               json:"default_image"`
	DefaultCPU   int            `gorm:"not null"               json:"default_cpu"`
	DefaultMemory int           `gorm:"not null"               json:"default_memory"`
	// HealthCheckType is "http" or "tcp".
	HealthCheckType string `gorm:"not null"              json:"health_check_type"`
	// HealthCheckPath is the HTTP path used when HealthCheckType == "http".
	HealthCheckPath string `json:"health_check_path,omitempty"`
	// IsPublicImage signals that DefaultImage can be pulled without a registry binding.
	IsPublicImage bool `gorm:"not null;default:true" json:"is_public_image"`
	// EnvironmentConfig holds optional default environment variables/config.
	EnvironmentConfig datatypes.JSON `gorm:"type:jsonb" json:"environment_config,omitempty"`
}

// ParseDefaultPorts deserialises DefaultPorts into a typed slice.
func (c *CatalogItem) ParseDefaultPorts() ([]PortDef, error) {
	if len(c.DefaultPorts) == 0 {
		return nil, nil
	}
	var ports []PortDef
	if err := json.Unmarshal(c.DefaultPorts, &ports); err != nil {
		return nil, err
	}
	return ports, nil
}

// ServiceDeployment records a catalog item that has been deployed to an environment.
type ServiceDeployment struct {
	models.Base
	WorkspaceID   uuid.UUID `gorm:"type:uuid;not null;index"    json:"workspace_id"`
	EnvironmentID uuid.UUID `gorm:"type:uuid;not null;index"    json:"environment_id"`
	CatalogName   string    `gorm:"not null"                    json:"catalog_name"`
	JobName       string    `gorm:"not null"                    json:"job_name"`
	Datacenter    string    `gorm:"not null"                    json:"datacenter"`
	Namespace     string    `gorm:"not null;default:'default'"  json:"namespace"`
	WorkerName    string    `gorm:"not null"                    json:"worker_name"`
	// Ports holds the resolved port mappings for this deployment.
	Ports         datatypes.JSON `gorm:"type:jsonb"                   json:"ports"`
	CPU           int            `gorm:"not null"                    json:"cpu"`
	Memory        int            `gorm:"not null"                    json:"memory"`
	Image         string         `gorm:"not null"                    json:"image"`
	// RegistryID is nil for public images.
	RegistryID *uuid.UUID `gorm:"type:uuid"                    json:"registry_id,omitempty"`
	// NomadJobID is kept for backward compatibility.
	NomadJobID string `gorm:"not null;default:''"           json:"nomad_job_id"`
	// RuntimeProvider is "nomad", "kubernetes", or "docker".
	RuntimeProvider string `gorm:"not null;default:'nomad'"      json:"runtime_provider"`
	// RuntimeJobID holds the runtime-specific job identifier.
	RuntimeJobID string    `gorm:"not null;default:''"           json:"runtime_job_id"`
	Status       string    `gorm:"not null;default:'running'"    json:"status"`
	DeployedBy   uuid.UUID `gorm:"type:uuid;not null"            json:"deployed_by"`
	// JobDefinition stores the exact manifest rendered and submitted to the runtime.
	JobDefinition string `gorm:"type:text"                    json:"job_definition"`
}
