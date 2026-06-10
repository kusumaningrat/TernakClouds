package blueprintrun

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(run *BlueprintRun) error {
	return r.db.Create(run).Error
}

func (r *Repository) CreateSteps(steps []BlueprintRunStep) error {
	if len(steps) == 0 {
		return nil
	}
	return r.db.Create(&steps).Error
}

func (r *Repository) FindByID(id string) (*BlueprintRun, error) {
	var run BlueprintRun
	err := r.db.Where("id = ?", id).First(&run).Error
	if err == gorm.ErrRecordNotFound {
		return nil, ErrRunNotFound
	}
	return &run, err
}

func (r *Repository) FindWithSteps(id string) (*BlueprintRun, error) {
	var run BlueprintRun
	err := r.db.Preload("Steps", func(db *gorm.DB) *gorm.DB {
		return db.Order("created_at ASC")
	}).Where("id = ?", id).First(&run).Error
	if err == gorm.ErrRecordNotFound {
		return nil, ErrRunNotFound
	}
	return &run, err
}

func (r *Repository) ListByWorkspace(workspaceID uuid.UUID, page, limit int) ([]BlueprintRun, int64, error) {
	var runs []BlueprintRun
	var total int64
	offset := (page - 1) * limit

	q := r.db.Model(&BlueprintRun{}).Where("workspace_id = ?", workspaceID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&runs).Error
	return runs, total, err
}

func (r *Repository) UpdateStatus(id string, status string) error {
	return r.db.Model(&BlueprintRun{}).Where("id = ?", id).Update("status", status).Error
}

func (r *Repository) UpdateRunCompleted(id string, status string) error {
	return r.db.Model(&BlueprintRun{}).Where("id = ?", id).
		Updates(map[string]any{"status": status, "completed_at": gorm.Expr("NOW()")}).Error
}

func (r *Repository) UpdateStep(step *BlueprintRunStep) error {
	return r.db.Save(step).Error
}

func (r *Repository) FindStep(stepID uuid.UUID) (*BlueprintRunStep, error) {
	var step BlueprintRunStep
	err := r.db.Where("id = ?", stepID).First(&step).Error
	if err == gorm.ErrRecordNotFound {
		return nil, ErrRunNotFound
	}
	return &step, err
}

func (r *Repository) FindStepsByRun(runID uuid.UUID) ([]BlueprintRunStep, error) {
	var steps []BlueprintRunStep
	err := r.db.Where("run_id = ?", runID).Order("created_at ASC").Find(&steps).Error
	return steps, err
}
