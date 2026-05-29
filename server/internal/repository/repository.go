package repository

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(p *RepoProvider) error {
	return r.db.Create(p).Error
}

func (r *Repository) FindByID(id uuid.UUID) (*RepoProvider, error) {
	var p RepoProvider
	err := r.db.First(&p, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	return &p, err
}

func (r *Repository) List(workspaceID uuid.UUID) ([]RepoProvider, error) {
	var providers []RepoProvider
	err := r.db.Where("workspace_id = ?", workspaceID).Find(&providers).Error
	return providers, err
}

func (r *Repository) Update(p *RepoProvider) error {
	return r.db.Save(p).Error
}

func (r *Repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&RepoProvider{}, "id = ?", id).Error
}
