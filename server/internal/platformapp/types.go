package platformapp

import (
	"errors"

	"github.com/kusumaningrat/idp-backend/internal/generator"
)

var (
	ErrAppNotFound       = errors.New("platform application not found")
	ErrUnsupportedRuntime = errors.New("unsupported runtime provider")
)

// ProvisionInput is the request body for creating a new platform application.
// OverrideManifest and OverrideCICD allow the caller to supply a manually edited
// manifest or CI/CD workflow from the preview step instead of re-generating.
type ProvisionInput struct {
	BlueprintName    string                 `json:"blueprint_name"     binding:"required"`
	Spec             generator.PlatformSpec `json:"spec"               binding:"required"`
	OverrideManifest string                 `json:"override_manifest,omitempty"`
	OverrideCICD     string                 `json:"override_cicd,omitempty"`
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

// PlatformAppResponse is the HTTP response for a platform application.
type PlatformAppResponse struct {
	ID                string             `json:"id"`
	WorkspaceID       string             `json:"workspace_id"`
	EnvironmentID     string             `json:"environment_id"`
	BlueprintID       string             `json:"blueprint_id"`
	BlueprintName     string             `json:"blueprint_name"`
	Name              string             `json:"name"`
	RuntimeProvider   string             `json:"runtime_provider"`
	Status            string             `json:"status"`
	GeneratedManifest string             `json:"generated_manifest,omitempty"`
	RuntimeJobID      string             `json:"runtime_job_id,omitempty"`
	ProvisionedBy     string             `json:"provisioned_by"`
	Spec              generator.PlatformSpec `json:"spec"`
	CreatedAt         string             `json:"created_at"`
	UpdatedAt         string             `json:"updated_at"`
}
