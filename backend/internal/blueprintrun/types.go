package blueprintrun

import "errors"

var (
	ErrRunNotFound       = errors.New("blueprint run not found")
	ErrBlueprintNotFound = errors.New("blueprint not found")
	ErrNoEnvironment     = errors.New("environment not configured")
)

// TriggerInput is the request body for POST /blueprint-runs.
type TriggerInput struct {
	BlueprintName   string         `json:"blueprint_name"   binding:"required"`
	EnvironmentID   string         `json:"environment_id"   binding:"required"`
	EnvironmentSlug string         `json:"environment_slug"`
	Inputs          map[string]any `json:"inputs"`
}

// RunResponse is the HTTP response shape for a BlueprintRun (with steps embedded).
type RunResponse struct {
	ID              string             `json:"id"`
	BlueprintID     string             `json:"blueprint_id"`
	BlueprintName   string             `json:"blueprint_name"`
	WorkspaceID     string             `json:"workspace_id"`
	EnvironmentID   string             `json:"environment_id"`
	EnvironmentSlug string             `json:"environment_slug"`
	TriggeredBy     string             `json:"triggered_by"`
	Status          string             `json:"status"`
	Inputs          map[string]any     `json:"inputs"`
	Steps           []StepResponse     `json:"steps"`
	CompletedAt     *string            `json:"completed_at,omitempty"`
	CreatedAt       string             `json:"created_at"`
}

// StepResponse is the HTTP response shape for a single BlueprintRunStep.
type StepResponse struct {
	ID          string         `json:"id"`
	StepID      string         `json:"step_id"`
	StepType    string         `json:"step_type"`
	Label       string         `json:"label"`
	Status      string         `json:"status"`
	Output      map[string]any `json:"output"`
	Error       string         `json:"error,omitempty"`
	StartedAt   *string        `json:"started_at,omitempty"`
	CompletedAt *string        `json:"completed_at,omitempty"`
}

// RunListPage is the paginated list response.
type RunListPage struct {
	Items []RunResponse `json:"items"`
	Total int64         `json:"total"`
	Page  int           `json:"page"`
	Limit int           `json:"limit"`
}
