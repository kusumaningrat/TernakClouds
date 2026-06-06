package config

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/subosito/gotenv"
)

// Database config
func (d DatabaseConfig) DataSource() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s TimeZone=UTC",
		d.Host, d.Port, d.User, d.Pass, d.Name, d.SSLMode,
	)
}

// Load Environment
func Load() (*Config, error) {
	_ = gotenv.Load()

	accessExpiry, err := time.ParseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m"))
	if err != nil {
		accessExpiry = 15 * time.Minute
	}
	refreshExpiry, err := time.ParseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h"))
	if err != nil {
		refreshExpiry = 15 * time.Minute
	}

	return &Config{
		Server: ServerConfig{
			Port:           getEnv("APP_PORT", "8022"),
			GinMode:        getEnv("GIN_MODE", "release"),
			AllowedOrigins: parseList(getEnv("ALLOWED_CORS", "http://localhost:3000,http://localhost:8080")),
		},
		Vault: VaultConfig{
			Enabled:  getEnv("VAULT_ENABLED", "false") == "true",
			Address:  getEnv("VAULT_ADDR", "http://localhost:8200"),
			RoleID:   getEnv("VAULT_ROLE_ID", ""),
			SecretID: getEnv("VAULT_SECRET_ID", ""),
			KVMount:  getEnv("VAULT_KV_MOUNT", "secret"),
		},
		Database: DatabaseConfig{
			Host:    getEnv("DB_HOST", "localhost"),
			Port:    getEnv("DB_PORT", "5432"),
			User:    getEnv("DB_USER", "postgres"),
			Pass:    getEnv("DB_PASSWORD", ""),
			Name:    getEnv("DB_NAME", "idp_platform"),
			SSLMode: getEnv("DB_SSLMODE", "disable"),
		},
		JWT: JWTConfig{
			Secret:        getEnv("JWT_SECRET", "change-me-in-production"),
			AccessExpiry:  accessExpiry,
			RefreshExpiry: refreshExpiry,
		},
		Admin: AdminConfig{
			Email:    getEnv("ADMIN_EMAIL", "admin@idp.local"),
			Password: getEnv("ADMIN_PASSWORD", "Admin@12345"),
		},
	}, nil
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}

	return defaultVal
}

func parseList(s string) []string {
	var out []string
	for item := range strings.SplitSeq(s, ",") {
		if t := strings.TrimSpace(item); t != "" {
			out = append(out, t)
		}
	}
	return out
}
