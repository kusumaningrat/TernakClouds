package secret

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/capability"
	"github.com/kusumaningrat/ternakclouds/internal/vault"
)

type Service struct {
	repo    *Repository
	capRepo *capability.Repository
	vault   vault.Client
}

func NewService(repo *Repository, capRepo *capability.Repository, vc vault.Client) *Service {
	return &Service{repo: repo, capRepo: capRepo, vault: vc}
}

// vaultClientForEnv resolves the Vault client for an environment.
// Resolution order:
// 1. "secrets" capability binding → "vault" provider → retrieve its token from IDP vault.
// 2. Fall back to the IDP's own vault client.
func (s *Service) vaultClientForEnv(ctx context.Context, envID uuid.UUID) (vault.Client, error) {
	binding, err := s.capRepo.FindBinding(envID, capability.CapSecrets)
	if err != nil {
		return nil, err
	}
	if binding != nil {
		for _, pc := range binding.ProviderConfigs {
			if pc.ProviderName != "vault" || pc.Endpoint == "" {
				continue
			}
			token := ""
			if s.vault != nil && pc.VaultPath != "" {
				token, err = s.vault.RetrieveToken(ctx, pc.VaultPath)
				if err != nil {
					return nil, fmt.Errorf("retrieve vault token: %w", err)
				}
			}
			kvMount := pc.Namespace
			if kvMount == "" {
				kvMount = "secret"
			}
			return vault.NewFromToken(pc.Endpoint, token, kvMount), nil
		}
	}
	if s.vault == nil {
		return nil, errors.New("no vault client configured")
	}
	return s.vault, nil
}

func (s *Service) Create(ctx context.Context, envID, workspaceID, createdBy uuid.UUID, input CreateGrantInput) (*SecretGrant, error) {
	g := &SecretGrant{
		EnvironmentID: envID,
		WorkspaceID:   workspaceID,
		Name:          input.Name,
		VaultPath:     input.VaultPath,
		Description:   input.Description,
		CreatedBy:     createdBy,
	}
	return g, s.repo.Create(g)
}

func (s *Service) List(envID uuid.UUID) ([]SecretGrant, error) {
	return s.repo.List(envID)
}

func (s *Service) Get(id uuid.UUID) (*SecretGrant, error) {
	return s.repo.FindByID(id)
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, input UpdateGrantInput) (*SecretGrant, error) {
	g, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if input.Name != nil {
		g.Name = *input.Name
	}
	if input.VaultPath != nil {
		g.VaultPath = *input.VaultPath
	}
	if input.Description != nil {
		g.Description = *input.Description
	}
	return g, s.repo.Update(g)
}

func (s *Service) Delete(id uuid.UUID) error {
	return s.repo.Delete(id)
}

// WriteValue writes key-value pairs to Vault at the grant's vault_path.
// subPath, when non-empty, is appended to vault_path (e.g. "secret-1" → "db/secret-1").
func (s *Service) WriteValue(ctx context.Context, envID, grantID uuid.UUID, subPath string, data map[string]string) error {
	g, err := s.repo.FindByID(grantID)
	if err != nil {
		return err
	}
	if g.EnvironmentID != envID {
		return ErrNotFound
	}
	if g.VaultPath == "" {
		return fmt.Errorf("vault path not configured for this grant")
	}

	fullPath := g.VaultPath
	if sub := strings.Trim(subPath, "/"); sub != "" {
		fullPath = g.VaultPath + "/" + sub
	}

	vc, err := s.vaultClientForEnv(ctx, envID)
	if err != nil {
		return fmt.Errorf("vault client: %w", err)
	}
	return vc.WriteKV(ctx, fullPath, data)
}

// ReadValue fetches the secret value from Vault for the given grant.
func (s *Service) ReadValue(ctx context.Context, envID, grantID uuid.UUID) (*SecretValueResponse, error) {
	g, err := s.repo.FindByID(grantID)
	if err != nil {
		return nil, err
	}
	if g.EnvironmentID != envID {
		return nil, ErrNotFound
	}

	vc, err := s.vaultClientForEnv(ctx, envID)
	if err != nil {
		return nil, fmt.Errorf("vault client: %w", err)
	}

	treeEntries, err := vc.ReadKVTree(ctx, g.VaultPath)
	if err != nil {
		return nil, err
	}

	entries := make([]SecretEntry, len(treeEntries))
	for i, te := range treeEntries {
		entries[i] = SecretEntry{Path: te.Path, Data: te.Data}
	}
	return &SecretValueResponse{Name: g.Name, Entries: entries}, nil
}
