package blueprintrun

import (
	"time"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/models"
)

const (
	RunStatusPending   = "pending"
	RunStatusRunning   = "running"
	RunStatusCompleted = "completed"
	RunStatusFailed    = "failed"

	StepStatusPending   = "pending"
	StepStatusRunning   = "running"
	StepStatusCompleted = "completed"
	StepStatusFailed    = "failed"
	StepStatusSkipped   = "skipped"
)

// BlueprintRun is a single execution instance of a Blueprint.
type BlueprintRun struct {
	models.Base
	BlueprintID   uuid.UUID `gorm:"type:uuid;not null"       json:"blueprint_id"`
	BlueprintName string    `gorm:"not null"                 json:"blueprint_name"`
	WorkspaceID   uuid.UUID `gorm:"type:uuid;not null;index" json:"workspace_id"`
	EnvironmentID uuid.UUID `gorm:"type:uuid;not null;index" json:"environment_id"`
	// EnvironmentSlug is cached to avoid extra join on status queries.
	EnvironmentSlug string    `gorm:"not null;default:''" json:"environment_slug"`
	TriggeredBy     uuid.UUID `gorm:"type:uuid;not null"  json:"triggered_by"`
	Status          string    `gorm:"not null;default:'pending'" json:"status"`
	// Inputs stores the user-provided key/value pairs for this run.
	Inputs      map[string]any `gorm:"serializer:json;not null;default:'{}'" json:"inputs"`
	CompletedAt *time.Time     `json:"completed_at,omitempty"`

	Steps []BlueprintRunStep `gorm:"foreignKey:RunID" json:"steps,omitempty"`
}

// BlueprintRunStep tracks the execution state of one step within a BlueprintRun.
type BlueprintRunStep struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey"      json:"id"`
	RunID       uuid.UUID `gorm:"type:uuid;not null;index"  json:"run_id"`
	StepID      string    `gorm:"not null"                  json:"step_id"`
	StepType    string    `gorm:"not null"                  json:"step_type"`
	Label       string    `gorm:"not null"                  json:"label"`
	Status      string    `gorm:"not null;default:'pending'" json:"status"`
	// Output stores key/value results from this step, available to subsequent steps.
	Output      map[string]any `gorm:"serializer:json;not null;default:'{}'" json:"output"`
	ErrorMsg    string         `gorm:"type:text"                            json:"error,omitempty"`
	StartedAt   *time.Time     `json:"started_at,omitempty"`
	CompletedAt *time.Time     `json:"completed_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
}

func (s *BlueprintRunStep) BeforeCreate(_ interface{}) {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
}
