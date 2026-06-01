package role

type AssignRoleInput struct {
	RoleID string `json:"role_id" binding:"required"`
}
