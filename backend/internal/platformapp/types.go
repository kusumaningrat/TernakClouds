package platformapp

import (
	"errors"

	"github.com/kusumaningrat/ternakclouds/internal/generator"
)

var (
	ErrAppNotFound       = errors.New("platform application not found")
	ErrUnsupportedRuntime = errors.New("unsupported runtime provider")
)

// RepositoryProvisionConfig tells the provision flow where to commit generated manifests.
type RepositoryProvisionConfig struct {
	ProviderID string `json:"provider_id" binding:"required"` // UUID of the repo provider
	Repository string `json:"repository"  binding:"required"` // "org/repo"
	BaseBranch string `json:"base_branch"`                    // PR target branch (default "main")
}

// ProvisionInput is the request body for creating a new platform application.
// OverrideManifest and OverrideCICD allow the caller to supply a manually edited
// manifest or CI/CD workflow from the preview step instead of re-generating.
type ProvisionInput struct {
	BlueprintName    string                     `json:"blueprint_name"     binding:"required"`
	Spec             generator.PlatformSpec     `json:"spec"               binding:"required"`
	OverrideManifest string                     `json:"override_manifest,omitempty"`
	OverrideCICD     string                     `json:"override_cicd,omitempty"`
	// Repository is optional. When set, generated manifests are committed and a PR is opened.
	Repository       *RepositoryProvisionConfig `json:"repository,omitempty"`
	// InitialSecrets are written to the grant's Vault path before runtime deploy.
	InitialSecrets   map[string]string          `json:"initial_secrets,omitempty"`
	// SecretGrantID is required when InitialSecrets is non-empty.
	SecretGrantID    string                     `json:"secret_grant_id,omitempty"`
}

// PreviewInput is the request body for previewing generated resources without provisioning.
type PreviewInput struct {
	BlueprintName string             `json:"blueprint_name" binding:"required"`
	Spec          generator.PlatformSpec `json:"spec"           binding:"required"`
}

// GeneratedResources holds the preview output from all applicable generators.
type GeneratedResources struct {
	RuntimeManifest string `json:"runtime_manifest,omitempty"`
	RuntimeProvider string `json:"runtime_provider"`
	CICDWorkflow    string `json:"cicd_workflow,omitempty"`
	CICDProvider    string `json:"cicd_provider,omitempty"`
}

// PlatformAppPage is the paginated response for platform applications.
type PlatformAppPage struct {
	Items []PlatformAppResponse `json:"items"`
	Total int64                 `json:"total"`
	Page  int                   `json:"page"`
	Limit int                   `json:"limit"`
}

// DeploymentHistoryPage is the paginated response for deployment records.
type DeploymentHistoryPage struct {
	Items []DeploymentRecordResponse `json:"items"`
	Total int64                      `json:"total"`
	Page  int                        `json:"page"`
	Limit int                        `json:"limit"`
}

// DeploymentRecordResponse is the HTTP response for a single deployment event.
type DeploymentRecordResponse struct {
	ID            string `json:"id"`
	PlatformAppID string `json:"platform_app_id"`
	TriggeredBy   string `json:"triggered_by"`
	Status        string `json:"status"`
	RuntimeJobID  string `json:"runtime_job_id,omitempty"`
	RepoName      string `json:"repo_name,omitempty"`
	RepoBranch    string `json:"repo_branch,omitempty"`
	CommitSHA     string `json:"commit_sha,omitempty"`
	PRNumber      int    `json:"pr_number,omitempty"`
	PRURL         string `json:"pr_url,omitempty"`
	CICDProvider  string `json:"cicd_provider,omitempty"`
	Message       string `json:"message,omitempty"`
	CreatedAt     string `json:"created_at"`
}

// PlatformAppResponse is the HTTP response for a platform application.
type PlatformAppResponse struct {
	ID                string                 `json:"id"`
	WorkspaceID       string                 `json:"workspace_id"`
	EnvironmentID     string                 `json:"environment_id"`
	BlueprintID       string                 `json:"blueprint_id"`
	BlueprintName     string                 `json:"blueprint_name"`
	Name              string                 `json:"name"`
	RuntimeProvider   string                 `json:"runtime_provider"`
	Status            string                 `json:"status"`
	GeneratedManifest string                 `json:"generated_manifest,omitempty"`
	RuntimeJobID      string                 `json:"runtime_job_id,omitempty"`
	ProvisionedBy     string                 `json:"provisioned_by"`
	Spec              generator.PlatformSpec `json:"spec"`
	// Repository integration fields — populated when manifests were committed.
	RepoProviderID string `json:"repo_provider_id,omitempty"`
	RepoName       string `json:"repo_name,omitempty"`
	RepoBranch     string `json:"repo_branch,omitempty"`
	CommitSHA      string `json:"commit_sha,omitempty"`
	PRNumber       int    `json:"pr_number,omitempty"`
	PRURL          string `json:"pr_url,omitempty"`
	// RepoError is set when the repository commit/PR step fails after a successful deploy.
	RepoError string `json:"repo_error,omitempty"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}
