package gcr

import (
	"context"
	"fmt"

	registryprovider "github.com/kusumaningrat/ternakclouds/internal/providers/registry"
)

// Provider is a stub for Google Container Registry / Artifact Registry.
// Full implementation requires the GCP SDK (cloud.google.com/go).
type Provider struct {
	projectID       string
	serviceAcctJSON string
}

// New creates a GCR provider stub.
// credentials must contain "project_id" and "service_account_json".
func New(credentials map[string]string) (*Provider, error) {
	projectID := credentials["project_id"]
	if projectID == "" {
		return nil, fmt.Errorf("gcr: project_id is required")
	}
	return &Provider{
		projectID:       projectID,
		serviceAcctJSON: credentials["service_account_json"],
	}, nil
}

func (p *Provider) ValidateConnection(_ context.Context) error {
	return fmt.Errorf("gcr: not yet implemented — add cloud.google.com/go to use GCR/Artifact Registry")
}

func (p *Provider) ListRepositories(_ context.Context) ([]registryprovider.Repo, error) {
	return nil, fmt.Errorf("gcr: not yet implemented")
}

func (p *Provider) ListTags(_ context.Context, _ string) ([]registryprovider.Tag, error) {
	return nil, fmt.Errorf("gcr: not yet implemented")
}

func (p *Provider) GetManifest(_ context.Context, _ string) (*registryprovider.Manifest, error) {
	return nil, fmt.Errorf("gcr: not yet implemented")
}

func (p *Provider) ValidateImage(_ context.Context, _ string) error {
	return fmt.Errorf("gcr: not yet implemented")
}
