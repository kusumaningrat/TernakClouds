package department

import "github.com/kusumaningrat/ternakclouds/internal/models"

type Department struct {
	models.Base
	Name        string `gorm:"uniqueIndex;not null" json:"name"`
	Slug        string `gorm:"uniqueIndex;not null" json:"slug"`
	Description string `json:"description,omitempty"`

	// Users loaded via preload — import cycle avoided by using a slice of
	// the concrete user type from the user package only where needed (services).
	// For DB relations, GORM resolves FKs by column name, not Go type.
}
