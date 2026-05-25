package registry

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	registryprovider "github.com/kusumaningrat/idp-backend/internal/providers/registry"
	"github.com/kusumaningrat/idp-backend/internal/providers/registry/dockerhub"
	"github.com/kusumaningrat/idp-backend/internal/providers/registry/ecr"
	"github.com/kusumaningrat/idp-backend/internal/providers/registry/gcr"
	"github.com/kusumaningrat/idp-backend/internal/providers/registry/ghcr"
	"github.com/kusumaningrat/idp-backend/internal/providers/registry/harbor"
	"github.com/kusumaningrat/idp-backend/internal/vault"
)

type Service struct {
	repo  *Repository
	vault vault.Client
}

func NewService(repo *Repository, vc vault.Client) *Service {
	return &Service{repo: repo, vault: vc}
}

// --- Registry providers ---

func (s *Service) CreateProvider(ctx context.Context, workspaceID uuid.UUID, input CreateProviderInput) (*RegistryProvider, error) {
	if !validProviderTypes[input.ProviderType] {
		return nil, ErrInvalidProvider
	}

	p := &RegistryProvider{
		WorkspaceID:  workspaceID,
		Name:         input.Name,
		ProviderType: input.ProviderType,
		Endpoint:     input.Endpoint,
		Description:  input.Description,
	}
	if err := s.repo.CreateProvider(p); err != nil {
		return nil, err
	}

	if len(input.Credentials) > 0 {
		path := vaultPath(workspaceID, p.ID)
		if err := s.vault.WriteKV(ctx, path, input.Credentials); err != nil {
			_ = s.repo.DeleteProvider(p.ID)
			return nil, fmt.Errorf("store registry credentials: %w", err)
		}
		p.VaultPath = path
		_ = s.repo.UpdateProvider(p)
	}

	return p, nil
}

func (s *Service) ListProviders(workspaceID uuid.UUID) ([]RegistryProvider, error) {
	return s.repo.ListProviders(workspaceID)
}

func (s *Service) GetProvider(id uuid.UUID) (*RegistryProvider, error) {
	return s.repo.FindProviderByID(id)
}

func (s *Service) UpdateProvider(ctx context.Context, id uuid.UUID, input UpdateProviderInput) (*RegistryProvider, error) {
	p, err := s.repo.FindProviderByID(id)
	if err != nil {
		return nil, err
	}
	if input.Name != nil {
		p.Name = *input.Name
	}
	if input.Endpoint != nil {
		p.Endpoint = *input.Endpoint
	}
	if input.Description != nil {
		p.Description = *input.Description
	}
	if len(input.Credentials) > 0 {
		path := vaultPath(p.WorkspaceID, p.ID)
		if err := s.vault.WriteKV(ctx, path, input.Credentials); err != nil {
			return nil, fmt.Errorf("update registry credentials: %w", err)
		}
		p.VaultPath = path
	}
	return p, s.repo.UpdateProvider(p)
}

func (s *Service) DeleteProvider(ctx context.Context, id uuid.UUID) error {
	p, err := s.repo.FindProviderByID(id)
	if err != nil {
		return err
	}
	if p.VaultPath != "" {
		_ = s.vault.DeleteToken(ctx, p.VaultPath)
	}
	if err := s.repo.DeleteBindingsByRegistry(id); err != nil {
		return err
	}
	return s.repo.DeleteProvider(id)
}

func (s *Service) ValidateConnection(ctx context.Context, id uuid.UUID) error {
	client, err := s.providerClient(ctx, id)
	if err != nil {
		return err
	}
	return client.ValidateConnection(ctx)
}

func (s *Service) ListRepositories(ctx context.Context, id uuid.UUID) ([]registryprovider.Repo, error) {
	client, err := s.providerClient(ctx, id)
	if err != nil {
		return nil, err
	}
	return client.ListRepositories(ctx)
}

func (s *Service) ListTags(ctx context.Context, id uuid.UUID, repository string) ([]registryprovider.Tag, error) {
	client, err := s.providerClient(ctx, id)
	if err != nil {
		return nil, err
	}
	return client.ListTags(ctx, repository)
}

// --- Registry bindings ---

func (s *Service) CreateBinding(ctx context.Context, envID uuid.UUID, input CreateBindingInput) (*RegistryBinding, error) {
	registryID, err := uuid.Parse(input.RegistryID)
	if err != nil {
		return nil, fmt.Errorf("invalid registry_id: %w", err)
	}

	// Verify registry exists.
	if _, err := s.repo.FindProviderByID(registryID); err != nil {
		return nil, err
	}

	existing, err := s.repo.FindBinding(envID, registryID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrBindingExists
	}

	b := &RegistryBinding{
		EnvironmentID: envID,
		RegistryID:    registryID,
		AllowedPaths:  input.AllowedPaths,
	}
	return b, s.repo.CreateBinding(b)
}

func (s *Service) ListBindings(envID uuid.UUID) ([]BindingWithProvider, error) {
	return s.repo.ListBindingsWithProvider(envID)
}

func (s *Service) DeleteBinding(id uuid.UUID) error {
	return s.repo.DeleteBinding(id)
}

// ListBoundRepositories lists repositories for a registry that is bound to an environment.
func (s *Service) ListBoundRepositories(ctx context.Context, envID, registryID uuid.UUID) ([]registryprovider.Repo, error) {
	binding, err := s.repo.FindBinding(envID, registryID)
	if err != nil {
		return nil, err
	}
	if binding == nil {
		return nil, ErrBindingNotFound
	}

	repos, err := s.ListRepositories(ctx, registryID)
	if err != nil {
		return nil, err
	}

	if len(binding.AllowedPaths) == 0 {
		return repos, nil
	}
	return filterReposByPaths(repos, binding.AllowedPaths), nil
}

// ListBoundTags lists tags for a repository in a registry bound to an environment.
func (s *Service) ListBoundTags(ctx context.Context, envID, registryID uuid.UUID, repository string) ([]registryprovider.Tag, error) {
	binding, err := s.repo.FindBinding(envID, registryID)
	if err != nil {
		return nil, err
	}
	if binding == nil {
		return nil, ErrBindingNotFound
	}
	return s.ListTags(ctx, registryID, repository)
}

// --- internal helpers ---

func (s *Service) providerClient(ctx context.Context, providerID uuid.UUID) (registryprovider.Provider, error) {
	p, err := s.repo.FindProviderByID(providerID)
	if err != nil {
		return nil, err
	}
	var creds map[string]string
	if p.VaultPath != "" {
		creds, err = s.vault.ReadKV(ctx, p.VaultPath)
		if err != nil {
			return nil, fmt.Errorf("read registry credentials: %w", err)
		}
	}
	return newProvider(p.ProviderType, p.Endpoint, creds)
}

func newProvider(providerType, endpoint string, creds map[string]string) (registryprovider.Provider, error) {
	if creds == nil {
		creds = map[string]string{}
	}
	switch providerType {
	case ProviderTypeHarbor:
		return harbor.New(endpoint, creds)
	case ProviderTypeDockerHub:
		return dockerhub.New(creds)
	case ProviderTypeGHCR:
		return ghcr.New(creds)
	case ProviderTypeECR:
		return ecr.New(creds)
	case ProviderTypeGCR:
		return gcr.New(creds)
	default:
		return nil, ErrInvalidProvider
	}
}

func vaultPath(workspaceID, providerID uuid.UUID) string {
	return fmt.Sprintf("idp/registries/%s/%s", workspaceID, providerID)
}

func filterReposByPaths(repos []registryprovider.Repo, allowedPaths []string) []registryprovider.Repo {
	var filtered []registryprovider.Repo
	for _, repo := range repos {
		if matchesAnyPath(repo.Name, allowedPaths) {
			filtered = append(filtered, repo)
		}
	}
	return filtered
}

func matchesAnyPath(name string, patterns []string) bool {
	for _, pattern := range patterns {
		if matchPath(name, pattern) {
			return true
		}
	}
	return false
}

// matchPath supports simple glob patterns ending in "/*".
func matchPath(name, pattern string) bool {
	if pattern == name {
		return true
	}
	if len(pattern) > 2 && pattern[len(pattern)-2:] == "/*" {
		prefix := pattern[:len(pattern)-2]
		return len(name) > len(prefix) && name[:len(prefix)] == prefix && name[len(prefix)] == '/'
	}
	return false
}
