package capability

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/internal/vault"
)

var ErrVaultDisabled = errors.New("vault is not configured; cannot store provider token")

type Service struct {
	repo  *Repository
	vault vault.Client // nil when Vault is disabled
}

func NewService(repo *Repository, vc vault.Client) *Service {
	return &Service{repo: repo, vault: vc}
}

// ListForEnvironment returns the full capability catalogue annotated with
// per-environment binding status and all bound provider configs.
func (s *Service) ListForEnvironment(envID uuid.UUID) ([]CapabilityStatusResponse, error) {
	caps, err := s.repo.ListCapabilities()
	if err != nil {
		return nil, err
	}

	bindings, err := s.repo.ListBindings(envID)
	if err != nil {
		return nil, err
	}

	bindingMap := make(map[string]*CapabilityBinding, len(bindings))
	for i := range bindings {
		bindingMap[bindings[i].CapabilityName] = &bindings[i]
	}

	out := make([]CapabilityStatusResponse, 0, len(caps))
	for _, cap := range caps {
		resp := CapabilityStatusResponse{
			CapabilityName: cap.Name,
			DisplayName:    cap.DisplayName,
			Providers:      []ProviderConfigResponse{},
		}
		if b, ok := bindingMap[cap.Name]; ok {
			resp.IsEnabled = b.IsEnabled
			for i := range b.ProviderConfigs {
				resp.Providers = append(resp.Providers, toProviderConfigResponse(&b.ProviderConfigs[i]))
			}
		}
		out = append(out, resp)
	}
	return out, nil
}

// GetStatus returns binding status for a single capability with all its providers.
func (s *Service) GetStatus(envID uuid.UUID, capName string) (*CapabilityStatusResponse, error) {
	cap, err := s.repo.FindCapabilityByName(capName)
	if err != nil {
		return nil, err
	}
	if cap == nil {
		return nil, fmt.Errorf("capability %q not found", capName)
	}

	binding, err := s.repo.FindBinding(envID, capName)
	if err != nil {
		return nil, err
	}

	resp := &CapabilityStatusResponse{
		CapabilityName: cap.Name,
		DisplayName:    cap.DisplayName,
		Providers:      []ProviderConfigResponse{},
	}
	if binding != nil {
		resp.IsEnabled = binding.IsEnabled
		for i := range binding.ProviderConfigs {
			resp.Providers = append(resp.Providers, toProviderConfigResponse(&binding.ProviderConfigs[i]))
		}
	}
	return resp, nil
}

// BindProvider adds a new provider to the capability binding.
// Returns ErrProviderAlreadyBound if the same provider_name is already bound.
func (s *Service) BindProvider(ctx context.Context, envID uuid.UUID, capName string, input BindProviderInput, callerID uuid.UUID) (*CapabilityStatusResponse, error) {
	if input.Token != "" && s.vault == nil {
		return nil, ErrVaultDisabled
	}

	// Ensure capability exists in catalogue.
	cap, err := s.repo.FindCapabilityByName(capName)
	if err != nil {
		return nil, err
	}
	if cap == nil {
		return nil, fmt.Errorf("capability %q not found", capName)
	}

	// Look up the provider catalogue entry for display name.
	providerEntry, err := s.repo.FindProviderByCapAndName(capName, input.ProviderName)
	if err != nil {
		return nil, err
	}
	displayName := input.ProviderName
	if providerEntry != nil {
		displayName = providerEntry.DisplayName
	}

	// Upsert the capability binding row (enable it).
	binding := &CapabilityBinding{
		EnvironmentID:  envID,
		CapabilityName: capName,
		IsEnabled:      true,
	}
	if err := s.repo.UpsertBinding(binding); err != nil {
		return nil, fmt.Errorf("capability: upsert binding: %w", err)
	}

	// Re-fetch with preloaded providers to check for duplicates.
	existingBinding, err := s.repo.FindBinding(envID, capName)
	if err != nil {
		return nil, err
	}
	for _, pc := range existingBinding.ProviderConfigs {
		if pc.ProviderName == input.ProviderName {
			return nil, ErrProviderAlreadyBound
		}
	}

	var vaultPath string
	credentialType := "none"
	if input.Token != "" {
		vaultPath = fmt.Sprintf("idp/capabilities/%s/%s/%s/token", envID, capName, input.ProviderName)
		if err := s.vault.StoreToken(ctx, vaultPath, input.Token); err != nil {
			return nil, fmt.Errorf("capability: store token in vault: %w", err)
		}
		credentialType = "token"
	}

	cfg := &ProviderConfig{
		CapabilityBindingID: existingBinding.ID,
		ProviderName:        input.ProviderName,
		DisplayName:         displayName,
		Endpoint:            input.Endpoint,
		Region:              input.Region,
		Namespace:           input.Namespace,
		VaultPath:           vaultPath,
		CredentialType:      credentialType,
		CreatedBy:           callerID,
	}
	if err := s.repo.CreateProviderConfig(cfg); err != nil {
		if vaultPath != "" {
			if delErr := s.vault.DeleteToken(ctx, vaultPath); delErr != nil {
				slog.Error("failed to clean vault secret after provider config creation failure",
					"path", vaultPath, "err", delErr)
			}
		}
		if strings.Contains(err.Error(), "idx_binding_provider") {
			return nil, ErrProviderAlreadyBound
		}
		return nil, fmt.Errorf("capability: create provider config: %w", err)
	}

	return s.GetStatus(envID, capName)
}

// UpdateProvider updates endpoint/region/namespace for an existing provider.
// If input.Token is non-empty the vault secret is rotated.
func (s *Service) UpdateProvider(ctx context.Context, envID uuid.UUID, capName string, providerID uuid.UUID, input UpdateProviderInput) (*CapabilityStatusResponse, error) {
	// Verify the provider config belongs to this (env, capability).
	cfg, err := s.repo.FindProviderConfig(providerID)
	if err != nil {
		return nil, err
	}
	if cfg == nil {
		return nil, ErrNotFound
	}

	binding, err := s.repo.FindBinding(envID, capName)
	if err != nil {
		return nil, err
	}
	if binding == nil || cfg.CapabilityBindingID != binding.ID {
		return nil, ErrNotFound
	}

	cfg.Endpoint = input.Endpoint
	cfg.Region = input.Region
	cfg.Namespace = input.Namespace

	// Rotate the vault secret only when a new token is provided.
	if input.Token != "" {
		if s.vault == nil {
			return nil, ErrVaultDisabled
		}
		if err := s.vault.StoreToken(ctx, cfg.VaultPath, input.Token); err != nil {
			return nil, fmt.Errorf("capability: rotate token in vault: %w", err)
		}
	}

	if err := s.repo.UpdateProviderConfig(cfg); err != nil {
		return nil, fmt.Errorf("capability: update provider config: %w", err)
	}

	return s.GetStatus(envID, capName)
}

// UnbindProvider removes a specific provider config and its vault secret.
func (s *Service) UnbindProvider(ctx context.Context, envID uuid.UUID, capName string, providerID uuid.UUID) error {
	cfg, err := s.repo.FindProviderConfig(providerID)
	if err != nil {
		return err
	}
	if cfg == nil {
		return ErrNotFound
	}

	// Verify ownership: provider must belong to the right (env, capability).
	binding, err := s.repo.FindBinding(envID, capName)
	if err != nil {
		return err
	}
	if binding == nil || cfg.CapabilityBindingID != binding.ID {
		return ErrNotFound
	}

	if s.vault != nil && cfg.VaultPath != "" {
		if err := s.vault.DeleteToken(ctx, cfg.VaultPath); err != nil {
			slog.Error("failed to delete capability token from vault",
				"path", cfg.VaultPath, "err", err)
		}
	}

	if err := s.repo.DeleteProviderConfigByID(providerID); err != nil {
		return fmt.Errorf("capability: delete provider config: %w", err)
	}

	// If no providers remain, mark the binding as disabled.
	refreshed, err := s.repo.FindBinding(envID, capName)
	if err != nil {
		return err
	}
	if refreshed != nil && len(refreshed.ProviderConfigs) == 0 {
		refreshed.IsEnabled = false
		return s.repo.UpsertBinding(refreshed)
	}
	return nil
}

// ListProviders returns the provider catalogue for a capability.
func (s *Service) ListProviders(capName string) ([]Provider, error) {
	return s.repo.ListProvidersByCapability(capName)
}

// VerifyProvider checks whether the provider's endpoint is reachable.
// It uses a provider-specific probe path (e.g. /ready for Loki) and
// optionally attaches the stored bearer token if one exists in Vault.
func (s *Service) VerifyProvider(ctx context.Context, envID uuid.UUID, capName string, providerID uuid.UUID) (*VerifyProviderResult, error) {
	cfg, err := s.repo.FindProviderConfig(providerID)
	if err != nil {
		return nil, err
	}
	if cfg == nil {
		return nil, ErrNotFound
	}

	binding, err := s.repo.FindBinding(envID, capName)
	if err != nil {
		return nil, err
	}
	if binding == nil || cfg.CapabilityBindingID != binding.ID {
		return nil, ErrNotFound
	}

	probeURL := strings.TrimRight(cfg.Endpoint, "/") + "/ready"

	httpClient := &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, probeURL, nil)
	if err != nil {
		return &VerifyProviderResult{Reachable: false, Message: "invalid endpoint: " + err.Error()}, nil
	}

	if s.vault != nil && cfg.VaultPath != "" {
		if token, vErr := s.vault.RetrieveToken(ctx, cfg.VaultPath); vErr == nil && token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return &VerifyProviderResult{Reachable: false, Message: err.Error()}, nil
	}
	defer resp.Body.Close()

	reachable := resp.StatusCode < 500
	return &VerifyProviderResult{
		Reachable:  reachable,
		StatusCode: resp.StatusCode,
		Message:    http.StatusText(resp.StatusCode),
	}, nil
}

func toProviderConfigResponse(cfg *ProviderConfig) ProviderConfigResponse {
	return ProviderConfigResponse{
		ID:             cfg.ID.String(),
		ProviderName:   cfg.ProviderName,
		DisplayName:    cfg.DisplayName,
		Endpoint:       cfg.Endpoint,
		Region:         cfg.Region,
		Namespace:      cfg.Namespace,
		CredentialType: cfg.CredentialType,
		CreatedAt:      cfg.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
}
