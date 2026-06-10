package blueprint

import "github.com/kusumaningrat/ternakclouds/internal/models"

// BlueprintInput describes a single user-facing input field for a blueprint run.
type BlueprintInput struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	// Type: "string", "env_select", "repo_provider_select", "existing_deployment_select"
	Type        string `json:"type"`
	Required    bool   `json:"required"`
	Placeholder string `json:"placeholder,omitempty"`
	HelpText    string `json:"help_text,omitempty"`
	Default     string `json:"default,omitempty"`
}

// BlueprintStep describes a single automation step within a blueprint.
type BlueprintStep struct {
	ID          string         `json:"id"`
	// Type: "deploy_catalog_item", "write_secret", "generate_cicd", "generate_repository", "configure_environment"
	Type        string         `json:"type"`
	Label       string         `json:"label"`
	Description string         `json:"description,omitempty"`
	// Config holds step-specific parameters; values support Go template syntax: {{.input_key}}
	Config      map[string]any `json:"config,omitempty"`
}

// Blueprint is a reusable automation workflow template.
// Each blueprint defines inputs the user must provide and sequential steps the platform executes.
type Blueprint struct {
	models.Base
	Name        string `gorm:"uniqueIndex;not null"           json:"name"`
	DisplayName string `gorm:"not null"                       json:"display_name"`
	Description string `                                      json:"description"`
	// Category: "provision", "bootstrap", "operate", "devops", "environment"
	Category string `gorm:"not null;default:'provision'" json:"category"`
	Version  string `gorm:"not null;default:'v1'"        json:"version"`
	IsPublic bool   `gorm:"not null;default:true"        json:"is_public"`
	// IsSystem marks blueprints seeded by the platform (cannot be deleted by users).
	IsSystem bool   `gorm:"not null;default:false" json:"is_system"`
	Icon     string `json:"icon,omitempty"`

	// InputsSchema defines what the user must fill in before running this blueprint.
	InputsSchema []BlueprintInput `gorm:"serializer:json;not null;default:'[]'" json:"inputs_schema"`
	// StepsConfig defines the ordered automation steps the platform will execute.
	StepsConfig  []BlueprintStep  `gorm:"serializer:json;not null;default:'[]'" json:"steps_config"`
}
