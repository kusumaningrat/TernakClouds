package repository

import "errors"

const (
	ProviderTypeGitHub = "github"
	ProviderTypeGitLab = "gitlab"
)

var validProviderTypes = map[string]bool{
	ProviderTypeGitHub: true,
	ProviderTypeGitLab: true,
}

var (
	ErrNotFound        = errors.New("repository provider not found")
	ErrInvalidProvider = errors.New("unsupported repository provider type")
)

type CreateProviderInput struct {
	Name         string            `json:"name"          binding:"required"`
	ProviderType string            `json:"provider_type" binding:"required"`
	BaseURL      string            `json:"base_url"`
	Description  string            `json:"description"`
	Credentials  map[string]string `json:"credentials"`
	AllowedRepos []string          `json:"allowed_repos"`
}

type UpdateProviderInput struct {
	Name         *string           `json:"name"`
	BaseURL      *string           `json:"base_url"`
	Description  *string           `json:"description"`
	Credentials  map[string]string `json:"credentials"`
	AllowedRepos *[]string         `json:"allowed_repos"`
}

type ProviderResponse struct {
	ID           string   `json:"id"`
	WorkspaceID  string   `json:"workspace_id"`
	Name         string   `json:"name"`
	ProviderType string   `json:"provider_type"`
	BaseURL      string   `json:"base_url,omitempty"`
	Description  string   `json:"description,omitempty"`
	AllowedRepos []string `json:"allowed_repos,omitempty"`
	CreatedAt    string   `json:"created_at"`
}

type CommitFilesInput struct {
	Repository   string           `json:"repository"    binding:"required"`
	Branch       string           `json:"branch"        binding:"required"`
	Message      string           `json:"message"       binding:"required"`
	Files        []FileEntryInput `json:"files"         binding:"required"`
	CreateBranch bool             `json:"create_branch"`
}

type FileEntryInput struct {
	Path    string `json:"path"    binding:"required"`
	Content string `json:"content" binding:"required"`
}

type PullRequestInput struct {
	Repository string   `json:"repository" binding:"required"`
	Title      string   `json:"title"      binding:"required"`
	Body       string   `json:"body"`
	Head       string   `json:"head"       binding:"required"`
	Base       string   `json:"base"       binding:"required"`
	Reviewers  []string `json:"reviewers"`
}
