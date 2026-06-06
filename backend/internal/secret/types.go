package secret

import "github.com/google/uuid"

type CreateGrantInput struct {
	Name        string `json:"name" binding:"required"`
	VaultPath   string `json:"vault_path"` // owner-only; members may omit
	Description string `json:"description"`
}

type UpdateGrantInput struct {
	Name        *string `json:"name"`
	VaultPath   *string `json:"vault_path"`
	Description *string `json:"description"`
}

// MemberGrantView is returned to regular workspace members — no vault_path exposed.
type MemberGrantView struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   string    `json:"created_at"`
}

// AdminGrantView is returned to workspace owners — includes vault_path.
type AdminGrantView struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	VaultPath   string    `json:"vault_path"`
	Description string    `json:"description"`
	CreatedBy   uuid.UUID `json:"created_by"`
	CreatedAt   string    `json:"created_at"`
	UpdatedAt   string    `json:"updated_at"`
}

// SecretEntry is one resolved path within a grant's vault_path tree.
// Path is relative to the grant's vault_path; empty means the grant path itself.
type SecretEntry struct {
	Path string            `json:"path"`
	Data map[string]string `json:"data"`
}

// WriteSecretInput is the request body for PUT .../secrets/:id/value.
// Path is optional — when set, it is appended to the grant's vault_path.
// Leave empty to write to the grant's vault_path directly.
type WriteSecretInput struct {
	Path string            `json:"path"`
	Data map[string]string `json:"data" binding:"required"`
}

// SecretValueResponse is returned when any member reads a secret's value.
type SecretValueResponse struct {
	Name    string        `json:"name"`
	Entries []SecretEntry `json:"entries"`
}
