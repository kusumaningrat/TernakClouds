package accessrequest

import (
	"time"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/models"
)

const (
	StatusPending  = "pending"
	StatusApproved = "approved"
	StatusDenied   = "denied"
)

type AccessRequest struct {
	models.Base
	UserID        uuid.UUID  `gorm:"type:uuid;not null;index"   json:"user_id"`
	WorkspaceID   uuid.UUID  `gorm:"type:uuid;not null;index"   json:"workspace_id"`
	RequestedRole string     `gorm:"not null"                   json:"requested_role"`
	Reason        string     `json:"reason"`
	Status        string     `gorm:"not null;default:'pending'" json:"status"`
	ReviewedBy    *uuid.UUID `gorm:"type:uuid"                  json:"reviewed_by,omitempty"`
	ReviewedAt    *time.Time `json:"reviewed_at,omitempty"`
}
