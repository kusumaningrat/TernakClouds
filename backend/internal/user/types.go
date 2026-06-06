package user

import (
	"time"

	"github.com/google/uuid"
)

// ListFilters holds optional query-param filters for the user list endpoint.
type ListFilters struct {
	WorkspaceSlug string
	DepartmentID  string
	RoleID        string
	IsActive      *bool
	Page          int
	Limit         int
}

// -- internal scan targets (used only within the repository layer) -------------

type userBaseRow struct {
	ID             uuid.UUID `gorm:"column:id"`
	Email          string    `gorm:"column:email"`
	FirstName      string    `gorm:"column:first_name"`
	LastName       string    `gorm:"column:last_name"`
	IsActive       bool      `gorm:"column:is_active"`
	DepartmentID   uuid.UUID `gorm:"column:department_id"`
	DepartmentName string    `gorm:"column:department_name"`
	CreatedAt      time.Time `gorm:"column:created_at"`
	UpdatedAt      time.Time `gorm:"column:updated_at"`
}

type userRoleRow struct {
	UserID      uuid.UUID `gorm:"column:user_id"`
	RoleID      uuid.UUID `gorm:"column:role_id"`
	RoleName    string    `gorm:"column:role_name"`
	Description string    `gorm:"column:description"`
	AssignedAt  time.Time `gorm:"column:assigned_at"`
}

type userWorkspaceRow struct {
	UserID        uuid.UUID `gorm:"column:user_id"`
	WorkspaceID   uuid.UUID `gorm:"column:workspace_id"`
	WorkspaceName string    `gorm:"column:workspace_name"`
	WorkspaceSlug string    `gorm:"column:workspace_slug"`
	WsRole        string    `gorm:"column:ws_role"`
	JoinedAt      time.Time `gorm:"column:joined_at"`
}

// -- public response types (returned by service, serialized by handler) -------

type UserRoleSummary struct {
	RoleID      uuid.UUID `json:"role_id"`
	RoleName    string    `json:"role_name"`
	Description string    `json:"description,omitempty"`
	AssignedAt  time.Time `json:"assigned_at"`
}

type UserWorkspaceSummary struct {
	WorkspaceID   uuid.UUID `json:"workspace_id"`
	WorkspaceName string    `json:"workspace_name"`
	WorkspaceSlug string    `json:"workspace_slug"`
	Role          string    `json:"role"` // "owner" | "member"
	JoinedAt      time.Time `json:"joined_at"`
}

type UserSummary struct {
	ID             uuid.UUID              `json:"id"`
	Email          string                 `json:"email"`
	FirstName      string                 `json:"first_name"`
	LastName       string                 `json:"last_name"`
	IsActive       bool                   `json:"is_active"`
	DepartmentID   uuid.UUID              `json:"department_id"`
	DepartmentName string                 `json:"department_name"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
	Roles          []UserRoleSummary      `json:"roles"`
	Workspaces     []UserWorkspaceSummary `json:"workspaces"`
}

type UserListResponse struct {
	Items []UserSummary `json:"items"`
	Total int64         `json:"total"`
	Page  int           `json:"page"`
	Limit int           `json:"limit"`
}
