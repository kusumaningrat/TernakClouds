package role

import (
	"time"

	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/internal/models"
	"gorm.io/gorm"
)

const (
	Admin     = "admin"
	Developer = "developer"
	Viewer    = "viewer"
	Manager   = "manager"
)

type Role struct {
	models.Base
	Name            string           `gorm:"uniqueIndex;not null" json:"name"`
	Description     string           `json:"description,omitempty"`
	RolePermissions []RolePermission `gorm:"foreignKey:RoleID"    json:"role_permissions,omitempty"`
	UserRoles       []UserRole       `gorm:"foreignKey:RoleID"    json:"-"`
}

type Permission struct {
	models.Base
	Name            string           `gorm:"uniqueIndex;not null"    json:"name"`
	Resource        string           `gorm:"not null"                json:"resource"`
	Action          string           `gorm:"not null"                json:"action"`
	Description     string           `json:"description,omitempty"`
	RolePermissions []RolePermission `gorm:"foreignKey:PermissionID" json:"-"`
}

type RolePermission struct {
	RoleID       uuid.UUID   `gorm:"type:uuid;primaryKey"     json:"role_id"`
	PermissionID uuid.UUID   `gorm:"type:uuid;primaryKey"     json:"permission_id"`
	Role         *Role       `gorm:"foreignKey:RoleID"        json:"-"`
	Permission   *Permission `gorm:"foreignKey:PermissionID"  json:"permission,omitempty"`
}

type UserRole struct {
	UserID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"user_id"`
	RoleID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"role_id"`
	AssignedAt time.Time `json:"assigned_at"`
	Role       *Role     `gorm:"foreignKey:RoleID"    json:"role,omitempty"`
	// User field omitted — avoids import cycle with user package; load via preload in services
}

func (ur *UserRole) BeforeCreate(tx *gorm.DB) error {
	if ur.AssignedAt.IsZero() {
		ur.AssignedAt = time.Now()
	}
	return nil
}
