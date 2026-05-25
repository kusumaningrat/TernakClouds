package ecr

import (
	"context"
	"fmt"

	registryprovider "github.com/kusumaningrat/idp-backend/internal/providers/registry"
)

// Provider is a stub for AWS Elastic Container Registry.
// Full implementation requires the AWS SDK (github.com/aws/aws-sdk-go-v2).
type Provider struct {
	region          string
	accessKeyID     string
	secretAccessKey string
	accountID       string
}

// New creates an ECR provider stub.
// credentials must contain "aws_access_key_id", "aws_secret_access_key",
// "region", and optionally "account_id".
func New(credentials map[string]string) (*Provider, error) {
	region := credentials["region"]
	if region == "" {
		return nil, fmt.Errorf("ecr: region is required")
	}
	if credentials["aws_access_key_id"] == "" || credentials["aws_secret_access_key"] == "" {
		return nil, fmt.Errorf("ecr: aws_access_key_id and aws_secret_access_key are required")
	}
	return &Provider{
		region:          region,
		accessKeyID:     credentials["aws_access_key_id"],
		secretAccessKey: credentials["aws_secret_access_key"],
		accountID:       credentials["account_id"],
	}, nil
}

func (p *Provider) ValidateConnection(_ context.Context) error {
	return fmt.Errorf("ecr: not yet implemented — add github.com/aws/aws-sdk-go-v2 to use ECR")
}

func (p *Provider) ListRepositories(_ context.Context) ([]registryprovider.Repo, error) {
	return nil, fmt.Errorf("ecr: not yet implemented")
}

func (p *Provider) ListTags(_ context.Context, _ string) ([]registryprovider.Tag, error) {
	return nil, fmt.Errorf("ecr: not yet implemented")
}

func (p *Provider) GetManifest(_ context.Context, _ string) (*registryprovider.Manifest, error) {
	return nil, fmt.Errorf("ecr: not yet implemented")
}

func (p *Provider) ValidateImage(_ context.Context, _ string) error {
	return fmt.Errorf("ecr: not yet implemented")
}
