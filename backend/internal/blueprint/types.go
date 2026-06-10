package blueprint

import "errors"

var (
	ErrBlueprintNotFound = errors.New("blueprint not found")
	ErrSystemBlueprint   = errors.New("system blueprints cannot be deleted")
)

// BlueprintResponse is the HTTP response shape for a blueprint.
type BlueprintResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Version     string `json:"version"`
	IsPublic    bool   `json:"is_public"`
	IsSystem    bool   `json:"is_system"`
	Icon        string `json:"icon,omitempty"`
	CreatedAt   string `json:"created_at"`

	InputsSchema []BlueprintInput `json:"inputs_schema"`
	StepsConfig  []BlueprintStep  `json:"steps_config"`
}
