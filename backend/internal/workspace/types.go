package workspace

type CreateWorkspaceInput struct {
	Name        string `json:"name"        binding:"required"`
	Description string `json:"description"`
}

type UpdateWorkspaceInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type AddMemberInput struct {
	UserID string `json:"user_id" binding:"required"`
}

type WorkspaceResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description,omitempty"`
	OwnerID     string `json:"owner_id"`
	CreatedAt   string `json:"created_at"`
}

type MemberResponse struct {
	WorkspaceID string `json:"workspace_id"`
	UserID      string `json:"user_id"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	Role        string `json:"role"`
	JoinedAt    string `json:"joined_at"`
}

// DirectoryEntry is a lightweight workspace stub for the access request picker.
type DirectoryEntry struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description,omitempty"`
}
