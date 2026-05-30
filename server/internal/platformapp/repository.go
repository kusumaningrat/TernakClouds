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

func (r *Repository) List(envID uuid.UUID, offset, limit int) ([]PlatformApp, int64, error) {
	var apps []PlatformApp
	var total int64

	base := r.db.Model(&PlatformApp{}).Where("environment_id = ?", envID)
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := base.Order("created_at desc").Offset(offset).Limit(limit).Find(&apps).Error
	return apps, total, err
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

func (r *Repository) UpdateRepoInfo(id uuid.UUID, commitSHA, prURL string, prNumber int) error {
	return r.db.Model(&PlatformApp{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"commit_sha": commitSHA,
			"pr_url":     prURL,
			"pr_number":  prNumber,
		}).Error
}

func (r *Repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&PlatformApp{}, "id = ?", id).Error
}

// ── Deployment records ────────────────────────────────────────────────────────

func (r *Repository) CreateDeployment(d *DeploymentRecord) error {
	return r.db.Create(d).Error
}

func (r *Repository) ListDeployments(appID uuid.UUID, offset, limit int) ([]DeploymentRecord, int64, error) {
	var records []DeploymentRecord
	var total int64

	base := r.db.Model(&DeploymentRecord{}).Where("platform_app_id = ?", appID)
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := base.Order("created_at desc").Offset(offset).Limit(limit).Find(&records).Error
	return records, total, err
}
