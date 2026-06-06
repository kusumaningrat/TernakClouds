package workspace

import (
	"time"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/models"
	"gorm.io/gorm"
)

const (
	MemberRoleOwner  = "owner"
	MemberRoleMember = "member"
)

type Workspace struct {
	models.Base
	Name        string            `gorm:"not null"              json:"name"`
	Slug        string            `gorm:"uniqueIndex;not null"  json:"slug"`
	Description string            `json:"description,omitempty"`
	OwnerID     uuid.UUID         `gorm:"type:uuid;not null;index" json:"owner_id"`
	Members     []WorkspaceMember `gorm:"foreignKey:WorkspaceID"   json:"members,omitempty"`
}

type WorkspaceMember struct {
	WorkspaceID uuid.UUID `gorm:"type:uuid;primaryKey"      json:"workspace_id"`
	UserID      uuid.UUID `gorm:"type:uuid;primaryKey"      json:"user_id"`
	Role        string    `gorm:"not null;default:'member'" json:"role"`
	JoinedAt    time.Time `json:"joined_at"`
}

func (m *WorkspaceMember) BeforeCreate(_ *gorm.DB) error {
	if m.JoinedAt.IsZero() {
		m.JoinedAt = time.Now()
	}
	return nil
}

// WorkspaceMemberDetail is used for list/get responses that include user fields,
// loaded via a JOIN rather than a GORM association (avoids FK constraint creation).
type WorkspaceMemberDetail struct {
	WorkspaceMember
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}
