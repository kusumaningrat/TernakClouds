package platformapp

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

func (r *Repository) Create(app *PlatformApp) error {
	return r.db.Create(app).Error
}

func (r *Repository) List(envID uuid.UUID) ([]PlatformApp, error) {
	var apps []PlatformApp
	return apps, r.db.
		Where("environment_id = ?", envID).
		Order("created_at desc").
		Find(&apps).Error
}

func (r *Repository) FindByID(id uuid.UUID) (*PlatformApp, error) {
	var app PlatformApp
	err := r.db.Where("id = ?", id).First(&app).Error
	if err == gorm.ErrRecordNotFound {
		return nil, ErrAppNotFound
	}
	return &app, err
}

func (r *Repository) UpdateStatus(id uuid.UUID, status, runtimeJobID string) error {
	return r.db.Model(&PlatformApp{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":          status,
			"runtime_job_id": runtimeJobID,
		}).Error
}

func (r *Repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&PlatformApp{}, "id = ?", id).Error
}
