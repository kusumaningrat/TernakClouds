package environment

type CreateEnvironmentInput struct {
	Name        string `json:"name"        binding:"required"`
	Description string `json:"description"`
}

type UpdateEnvironmentInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type EnvironmentResponse struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description,omitempty"`
	Order       int    `json:"order"`
	CreatedAt   string `json:"created_at"`
}
