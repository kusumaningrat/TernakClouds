package accessrequest

import (
	"time"

	"github.com/google/uuid"
)

type CreateInput struct {
	WorkspaceID   uuid.UUID `json:"workspace_id"   binding:"required"`
	RequestedRole string    `json:"requested_role" binding:"required"`
	Reason        string    `json:"reason"`
}

type ApproveInput struct {
	Role string `json:"role"` // optional: admin can override requested_role on approve
}

type AccessRequestDetail struct {
	ID            uuid.UUID  `json:"id"`
	UserID        uuid.UUID  `json:"user_id"`
	FirstName     string     `json:"first_name"`
	LastName      string     `json:"last_name"`
	Email         string     `json:"email"`
	WorkspaceID   uuid.UUID  `json:"workspace_id"`
	WorkspaceName string     `json:"workspace_name"`
	WorkspaceSlug string     `json:"workspace_slug"`
	RequestedRole string     `json:"requested_role"`
	Reason        string     `json:"reason"`
	Status        string     `json:"status"`
	ReviewedBy    *uuid.UUID `json:"reviewed_by,omitempty"`
	ReviewedAt    *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}
