package secret

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SecretGrant struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	EnvironmentID uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_secret_grant_env_name" json:"environment_id"`
	WorkspaceID   uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	Name          string         `gorm:"not null;uniqueIndex:idx_secret_grant_env_name" json:"name"`
	VaultPath     string         `gorm:"not null" json:"-"`
	Description   string         `json:"description"`
	CreatedBy     uuid.UUID      `gorm:"type:uuid;not null" json:"created_by"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}
