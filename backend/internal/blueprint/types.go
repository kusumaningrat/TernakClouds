package blueprint

import "errors"

var (
	ErrBlueprintNotFound = errors.New("blueprint not found")
	ErrSystemBlueprint   = errors.New("system blueprints cannot be deleted")
)

// BlueprintResponse is the HTTP response shape (with parsed runtimes slice).
type BlueprintResponse struct {
	ID                string   `json:"id"`
	Name              string   `json:"name"`
	DisplayName       string   `json:"display_name"`
	Description       string   `json:"description"`
	Category          string   `json:"category"`
	Version           string   `json:"version"`
	SupportedRuntimes []string `json:"supported_runtimes"`
	IsPublic          bool     `json:"is_public"`
	IsSystem          bool     `json:"is_system"`
	Icon              string   `json:"icon,omitempty"`
	CreatedAt         string   `json:"created_at"`
	// Developer-friendly defaults.
	DefaultImage    string `json:"default_image,omitempty"`
	DefaultTag      string `json:"default_tag,omitempty"`
	DefaultPort     int    `json:"default_port,omitempty"`
	DefaultCPU      int    `json:"default_cpu,omitempty"`
	DefaultMemoryMB int    `json:"default_memory_mb,omitempty"`
	CICDProvider    string `json:"cicd_provider,omitempty"`
}
