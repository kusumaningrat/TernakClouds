package repository

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/models"
)

// RepoProvider is a workspace-level SCM provider connection.
type RepoProvider struct {
	models.Base
	WorkspaceID  uuid.UUID `gorm:"type:uuid;not null;index"        json:"workspace_id"`
	Name         string    `gorm:"not null"                        json:"name"`
	ProviderType string    `gorm:"not null"                        json:"provider_type"` // "github" | "gitlab"
	BaseURL      string    `json:"base_url,omitempty"`             // for self-hosted GitLab
	VaultPath    string    `json:"-"`
	Description  string    `json:"description,omitempty"`
	// AllowedRepos restricts repo listing to these full names (e.g. "org/repo").
	// When empty all accessible repos are returned. Useful for fine-grained PATs.
	AllowedRepos []string  `gorm:"serializer:json"                 json:"allowed_repos,omitempty"`
}
