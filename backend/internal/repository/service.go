package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	repoprovider "github.com/kusumaningrat/ternakclouds/internal/providers/repository"
	githubprovider "github.com/kusumaningrat/ternakclouds/internal/providers/repository/github"
	gitlabprovider "github.com/kusumaningrat/ternakclouds/internal/providers/repository/gitlab"
	"github.com/kusumaningrat/ternakclouds/internal/vault"
)

type Service struct {
	repo  *Repository
	vault vault.Client
}

func NewService(repo *Repository, vc vault.Client) *Service {
	return &Service{repo: repo, vault: vc}
}

func (s *Service) CreateProvider(ctx context.Context, workspaceID uuid.UUID, input CreateProviderInput) (*RepoProvider, error) {
	if !validProviderTypes[input.ProviderType] {
		return nil, ErrInvalidProvider
	}

	p := &RepoProvider{
		WorkspaceID:  workspaceID,
		Name:         input.Name,
		ProviderType: input.ProviderType,
		BaseURL:      input.BaseURL,
		Description:  input.Description,
		AllowedRepos: input.AllowedRepos,
	}
	if err := s.repo.Create(p); err != nil {
		return nil, err
	}

	if len(input.Credentials) > 0 {
		path := vaultPath(workspaceID, p.ID)
		if err := s.vault.WriteKV(ctx, path, input.Credentials); err != nil {
			_ = s.repo.Delete(p.ID)
			return nil, fmt.Errorf("store repo credentials: %w", err)
		}
		p.VaultPath = path
		_ = s.repo.Update(p)
	}

	return p, nil
}

func (s *Service) ListProviders(workspaceID uuid.UUID) ([]RepoProvider, error) {
	return s.repo.List(workspaceID)
}

func (s *Service) GetProvider(id uuid.UUID) (*RepoProvider, error) {
	return s.repo.FindByID(id)
}

func (s *Service) UpdateProvider(ctx context.Context, id uuid.UUID, input UpdateProviderInput) (*RepoProvider, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if input.Name != nil {
		p.Name = *input.Name
	}
	if input.BaseURL != nil {
		p.BaseURL = *input.BaseURL
	}
	if input.Description != nil {
		p.Description = *input.Description
	}
	if input.AllowedRepos != nil {
		p.AllowedRepos = *input.AllowedRepos
	}
	if len(input.Credentials) > 0 {
		path := vaultPath(p.WorkspaceID, p.ID)
		if err := s.vault.WriteKV(ctx, path, input.Credentials); err != nil {
			return nil, fmt.Errorf("update repo credentials: %w", err)
		}
		p.VaultPath = path
	}
	return p, s.repo.Update(p)
}

func (s *Service) DeleteProvider(ctx context.Context, id uuid.UUID) error {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}
	if p.VaultPath != "" {
		_ = s.vault.DeleteToken(ctx, p.VaultPath)
	}
	return s.repo.Delete(id)
}

func (s *Service) ValidateConnection(ctx context.Context, id uuid.UUID) error {
	client, err := s.providerClient(ctx, id)
	if err != nil {
		return err
	}
	return client.ValidateConnection(ctx)
}

func (s *Service) ListRepositories(ctx context.Context, id uuid.UUID) ([]repoprovider.SCMRepo, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	client, err := s.buildClient(ctx, p)
	if err != nil {
		return nil, err
	}
	repos, err := client.ListRepositories(ctx)
	if err != nil {
		return nil, err
	}
	if len(p.AllowedRepos) == 0 {
		return repos, nil
	}
	allowed := make(map[string]struct{}, len(p.AllowedRepos))
	for _, r := range p.AllowedRepos {
		allowed[r] = struct{}{}
	}
	var filtered []repoprovider.SCMRepo
	for _, r := range repos {
		if _, ok := allowed[r.FullName]; ok {
			filtered = append(filtered, r)
		}
	}
	return filtered, nil
}

func (s *Service) ListBranches(ctx context.Context, id uuid.UUID, fullName string) ([]repoprovider.Branch, error) {
	client, err := s.providerClient(ctx, id)
	if err != nil {
		return nil, err
	}
	return client.ListBranches(ctx, fullName)
}

func (s *Service) ListContents(ctx context.Context, id uuid.UUID, fullName, path, branch string) ([]repoprovider.ContentEntry, error) {
	client, err := s.providerClient(ctx, id)
	if err != nil {
		return nil, err
	}
	return client.ListContents(ctx, fullName, path, branch)
}

func (s *Service) CommitFiles(ctx context.Context, id uuid.UUID, input CommitFilesInput) (*repoprovider.CommitResult, error) {
	client, err := s.providerClient(ctx, id)
	if err != nil {
		return nil, err
	}
	files := make([]repoprovider.FileEntry, len(input.Files))
	for i, f := range input.Files {
		files[i] = repoprovider.FileEntry{Path: f.Path, Content: f.Content}
	}
	return client.CommitFiles(ctx, repoprovider.CommitRequest{
		Repository:   input.Repository,
		Branch:       input.Branch,
		Message:      input.Message,
		Files:        files,
		CreateBranch: input.CreateBranch,
	})
}

func (s *Service) CreatePullRequest(ctx context.Context, id uuid.UUID, input PullRequestInput) (*repoprovider.PullRequestResult, error) {
	client, err := s.providerClient(ctx, id)
	if err != nil {
		return nil, err
	}
	return client.CreatePullRequest(ctx, repoprovider.PullRequestRequest{
		Repository: input.Repository,
		Title:      input.Title,
		Body:       input.Body,
		Head:       input.Head,
		Base:       input.Base,
		Reviewers:  input.Reviewers,
	})
}

func (s *Service) Capabilities(ctx context.Context, id uuid.UUID) (repoprovider.ProviderCapabilities, error) {
	client, err := s.providerClient(ctx, id)
	if err != nil {
		return repoprovider.ProviderCapabilities{}, err
	}
	return client.Capabilities(), nil
}

// ── internal helpers ──────────────────────────────────────────────────────────

func (s *Service) providerClient(ctx context.Context, providerID uuid.UUID) (repoprovider.Provider, error) {
	p, err := s.repo.FindByID(providerID)
	if err != nil {
		return nil, err
	}
	return s.buildClient(ctx, p)
}

func (s *Service) buildClient(ctx context.Context, p *RepoProvider) (repoprovider.Provider, error) {
	var creds map[string]string
	if p.VaultPath != "" {
		var err error
		creds, err = s.vault.ReadKV(ctx, p.VaultPath)
		if err != nil {
			return nil, fmt.Errorf("read repo credentials: %w", err)
		}
	}
	return newProvider(p.ProviderType, p.BaseURL, creds)
}

func newProvider(providerType, baseURL string, creds map[string]string) (repoprovider.Provider, error) {
	if creds == nil {
		creds = map[string]string{}
	}
	switch providerType {
	case ProviderTypeGitHub:
		return githubprovider.New(creds)
	case ProviderTypeGitLab:
		return gitlabprovider.New(baseURL, creds)
	default:
		return nil, ErrInvalidProvider
	}
}

func vaultPath(workspaceID, providerID uuid.UUID) string {
	return fmt.Sprintf("idp/repositories/%s/%s", workspaceID, providerID)
}
