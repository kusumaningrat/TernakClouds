package environment

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/models"
)

type Environment struct {
	models.Base
	WorkspaceID uuid.UUID `gorm:"type:uuid;not null;index"                                    json:"workspace_id"`
	Name        string    `gorm:"not null"                                                     json:"name"`
	Slug        string    `gorm:"not null"                                                     json:"slug"`
	Description string    `json:"description,omitempty"`
	Order       int       `gorm:"default:0"                                                    json:"order"`
}

func (Environment) TableName() string { return "environments" }

// UniqueIndex on (workspace_id, slug) is declared via GORM migrator tag below.
// GORM does not support composite unique index via struct tags on embedded fields,
// so it is enforced programmatically in Repository.Create and via a DB migration.
