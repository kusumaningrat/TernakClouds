package config

import "time"

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	Admin    AdminConfig
	Vault    VaultConfig
}

type VaultConfig struct {
	Enabled  bool
	Address  string
	RoleID   string
	SecretID string
	KVMount  string
}

type AdminConfig struct {
	Email    string
	Password string
}

type ServerConfig struct {
	Port           string
	GinMode        string
	AllowedOrigins []string
}

type DatabaseConfig struct {
	Host    string
	Port    string
	User    string
	Pass    string
	Name    string
	SSLMode string
}

type JWTConfig struct {
	Secret        string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
}
