package bootstrap

import (
	"fmt"
	"log/slog"

	"github.com/kusumaningrat/ternakclouds/internal/config"
	"github.com/kusumaningrat/ternakclouds/internal/vault"
)

// InitVault authenticates with Vault using AppRole and returns a ready Client.
// Returns (nil, nil) when VAULT_ENABLED=false so callers can detect disabled state.
func InitVault(cfg config.VaultConfig) (vault.Client, error) {
	if !cfg.Enabled {
		slog.Warn("vault disabled — integration token storage unavailable")
		return nil, nil
	}

	client, err := vault.NewFromAppRole(cfg.Address, cfg.RoleID, cfg.SecretID, cfg.KVMount)
	if err != nil {
		return nil, fmt.Errorf("vault bootstrap: %w", err)
	}

	slog.Info("vault ready", "address", cfg.Address, "kv_mount", cfg.KVMount)
	return client, nil
}
