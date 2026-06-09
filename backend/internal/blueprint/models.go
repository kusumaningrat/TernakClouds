package blueprint

import "github.com/kusumaningrat/ternakclouds/internal/models"

// Blueprint is a reusable, versioned deployment template.
// System blueprints are seeded by the platform; custom ones can be created per workspace.
type Blueprint struct {
	models.Base
	Name        string `gorm:"uniqueIndex;not null"           json:"name"`
	DisplayName string `gorm:"not null"                       json:"display_name"`
	Description string `                                      json:"description"`
	// Category is "application", "infrastructure", or "cicd".
	Category string `gorm:"not null;default:'application'" json:"category"`
	// Version follows semver-lite, e.g. "v1", "v2".
	Version string `gorm:"not null;default:'v1'" json:"version"`
	// SupportedRuntimes is a comma-separated list: "nomad,kubernetes,docker". Empty for cicd category.
	SupportedRuntimes string `gorm:"not null;default:''" json:"-"`
	IsPublic          bool   `gorm:"not null;default:true" json:"is_public"`
	// IsSystem marks blueprints seeded by the platform (cannot be deleted by users).
	IsSystem bool `gorm:"not null;default:false" json:"is_system"`
	// Icon is an optional display icon name (lucide icon slug).
	Icon string `json:"icon,omitempty"`

	// Developer-friendly defaults — auto-fill the provision spec so developers
	// don't need to know infrastructure details.
	DefaultImage    string `gorm:"not null;default:''" json:"default_image,omitempty"`
	DefaultTag      string `gorm:"not null;default:'latest'" json:"default_tag,omitempty"`
	DefaultPort     int    `gorm:"not null;default:8080" json:"default_port,omitempty"`
	DefaultCPU      int    `gorm:"not null;default:256" json:"default_cpu,omitempty"`
	DefaultMemoryMB int    `gorm:"not null;default:256" json:"default_memory_mb,omitempty"`
	// CICDProvider is set for "cicd" category blueprints: "github-actions", "gitlab-ci", "jenkins".
	CICDProvider string `gorm:"not null;default:''" json:"cicd_provider,omitempty"`
}
