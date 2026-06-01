package blueprint

import "github.com/kusumaningrat/ternakclouds/internal/models"

// Blueprint is a reusable, versioned deployment template.
// System blueprints are seeded by the platform; custom ones can be created per workspace.
type Blueprint struct {
	models.Base
	Name        string `gorm:"uniqueIndex;not null"            json:"name"`
	DisplayName string `gorm:"not null"                        json:"display_name"`
	Description string `                                       json:"description"`
	// Category is "application" or "infrastructure".
	Category string `gorm:"not null;default:'application'"  json:"category"`
	// Version follows semver-lite, e.g. "v1", "v2".
	Version string `gorm:"not null;default:'v1'"           json:"version"`
	// SupportedRuntimes is a comma-separated list: "nomad,kubernetes,docker".
	SupportedRuntimes string `gorm:"not null"                        json:"-"`
	IsPublic          bool   `gorm:"not null;default:true"           json:"is_public"`
	// IsSystem marks blueprints seeded by the platform (cannot be deleted by users).
	IsSystem bool `gorm:"not null;default:false"          json:"is_system"`
	// Icon is an optional display icon name (lucide icon slug).
	Icon string `json:"icon,omitempty"`
}
