package platformapp

import (
	"time"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/models"
)

const (
	StatusPending     = "pending"
	StatusProvisioned = "provisioned"
	StatusFailed      = "failed"
	StatusStopped     = "stopped"
)

// PlatformApp is a deployed application created from a blueprint.
// It owns the canonical platform spec and all generated manifests.
type PlatformApp struct {
	models.Base
	WorkspaceID   uuid.UUID `gorm:"type:uuid;not null;index" json:"workspace_id"`
	EnvironmentID uuid.UUID `gorm:"type:uuid;not null;index" json:"environment_id"`
	BlueprintID   uuid.UUID `gorm:"type:uuid;not null"       json:"blueprint_id"`
	BlueprintName string    `gorm:"not null"                 json:"blueprint_name"`
	Name          string    `gorm:"not null"                 json:"name"`
	// RuntimeProvider is the selected provider: "nomad", "kubernetes", or "docker".
	RuntimeProvider string `gorm:"not null" json:"runtime_provider"`
	// SpecJSON is the serialized PlatformSpec used to generate this application.
	SpecJSON string `gorm:"type:text;not null" json:"-"`
	// Status tracks provisioning state.
	Status string `gorm:"not null;default:'pending'" json:"status"`
	// GeneratedManifest stores the rendered runtime manifest (HCL, YAML, etc.).
	GeneratedManifest string    `gorm:"type:text"          json:"generated_manifest,omitempty"`
	ProvisionedBy     uuid.UUID `gorm:"type:uuid;not null" json:"provisioned_by"`
	// RuntimeJobID is the job/deployment ID in the runtime (e.g. Nomad job name, K8s deployment name).
	RuntimeJobID string `json:"runtime_job_id,omitempty"`

	// Repository integration — set when manifests were committed to a repo provider.
	RepoProviderID string `json:"repo_provider_id,omitempty"`
	RepoName       string `json:"repo_name,omitempty"`
	RepoBranch     string `json:"repo_branch,omitempty"` // base branch (PR target)
	CommitSHA      string `json:"commit_sha,omitempty"`
	PRNumber       int    `json:"pr_number,omitempty"`
	PRURL          string `json:"pr_url,omitempty"`
}

// DeploymentRecord captures a single provisioning or redeploy event for a PlatformApp.
// Each call to Provision() creates one record; future redeploy webhooks create additional ones.
type DeploymentRecord struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey"    json:"id"`
	PlatformAppID uuid.UUID `gorm:"type:uuid;not null;index" json:"platform_app_id"`
	TriggeredBy   uuid.UUID `gorm:"type:uuid;not null"      json:"triggered_by"`
	// Status mirrors PlatformApp status at the time of this deployment.
	Status       string `gorm:"not null"    json:"status"`
	RuntimeJobID string `json:"runtime_job_id,omitempty"`
	// Repository / CI/CD traceability fields.
	RepoName     string `json:"repo_name,omitempty"`
	RepoBranch   string `json:"repo_branch,omitempty"`
	CommitSHA    string `json:"commit_sha,omitempty"`
	PRNumber     int    `json:"pr_number,omitempty"`
	PRURL        string `json:"pr_url,omitempty"`
	CICDProvider string `json:"cicd_provider,omitempty"`
	Message      string `gorm:"type:text" json:"message,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

func (d *DeploymentRecord) BeforeCreate(_ interface{}) {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
}
