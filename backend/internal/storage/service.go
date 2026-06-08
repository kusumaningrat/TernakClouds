package storage

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/capability"
	"github.com/kusumaningrat/ternakclouds/internal/vault"
)

var ErrNoStorageProvider = errors.New(
	"No storage provider is configured for this environment. Please bind a provider in Platform → Storage.",
)

// ProviderInfo describes the active storage provider bound to an environment.
type ProviderInfo struct {
	ProviderName string `json:"provider_name"`
	DisplayName  string `json:"display_name"`
	Endpoint     string `json:"endpoint"`
	Region       string `json:"region,omitempty"`
}

type Service struct {
	capRepo *capability.Repository
	vault   vault.Client
}

func NewService(capRepo *capability.Repository, vc vault.Client) *Service {
	return &Service{capRepo: capRepo, vault: vc}
}

// clientForEnv resolves a storage Provider for the given environment.
// It reads the first bound ProviderConfig under the "storage" capability,
// retrieves the credential from Vault, and constructs the appropriate client.
func (s *Service) clientForEnv(ctx context.Context, envID uuid.UUID) (Provider, *capability.ProviderConfig, error) {
	binding, err := s.capRepo.FindBinding(envID, capability.CapStorage)
	if err != nil {
		return nil, nil, err
	}
	if binding == nil || len(binding.ProviderConfigs) == 0 {
		return nil, nil, ErrNoStorageProvider
	}

	pc := &binding.ProviderConfigs[0]
	credential := ""
	if s.vault != nil && pc.VaultPath != "" {
		credential, err = s.vault.RetrieveToken(ctx, pc.VaultPath)
		if err != nil {
			return nil, nil, fmt.Errorf("retrieving storage credential: %w", err)
		}
	}

	p, err := newProvider(pc.ProviderName, pc.Endpoint, pc.Region, credential)
	if err != nil {
		return nil, nil, err
	}
	return p, pc, nil
}

// newProvider constructs a Provider from a provider name and its configuration.
func newProvider(name, endpoint, region, credential string) (Provider, error) {
	switch name {
	case "minio", "s3", "gcs", "r2", "b2":
		return newS3Client(endpoint, region, credential)
	case "azure-blob":
		return newAzureClient(credential)
	default:
		return nil, fmt.Errorf("unsupported storage provider: %s", name)
	}
}

// ListBuckets returns all buckets/containers visible to the configured credential.
func (s *Service) ListBuckets(ctx context.Context, envID uuid.UUID) ([]Bucket, error) {
	p, _, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return p.ListBuckets(ctx)
}

// CreateBucket creates a new bucket/container. If region is empty the provider default is used.
func (s *Service) CreateBucket(ctx context.Context, envID uuid.UUID, name, region string) error {
	p, pc, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return err
	}
	if region == "" {
		region = pc.Region
	}
	return p.CreateBucket(ctx, name, region)
}

// DeleteBucket removes a bucket/container. The bucket must be empty for most providers.
func (s *Service) DeleteBucket(ctx context.Context, envID uuid.UUID, name string) error {
	p, _, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return err
	}
	return p.DeleteBucket(ctx, name)
}

// GetProviderInfo returns metadata about the active storage provider without
// exposing credentials.
func (s *Service) GetProviderInfo(ctx context.Context, envID uuid.UUID) (*ProviderInfo, error) {
	binding, err := s.capRepo.FindBinding(envID, capability.CapStorage)
	if err != nil {
		return nil, err
	}
	if binding == nil || len(binding.ProviderConfigs) == 0 {
		return nil, ErrNoStorageProvider
	}
	pc := binding.ProviderConfigs[0]
	return &ProviderInfo{
		ProviderName: pc.ProviderName,
		DisplayName:  pc.DisplayName,
		Endpoint:     pc.Endpoint,
		Region:       pc.Region,
	}, nil
}
