package environment

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrNotFound = errors.New("environment not found")
var ErrSlugTaken = errors.New("environment slug already taken in this workspace")

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(e *Environment) error {
	// Enforce composite unique (workspace_id, slug) at the application layer.
	var count int64
	r.db.Model(&Environment{}).
		Where("workspace_id = ? AND slug = ? AND deleted_at IS NULL", e.WorkspaceID, e.Slug).
		Count(&count)
	if count > 0 {
		return ErrSlugTaken
	}
	return r.db.Create(e).Error
}

func (r *Repository) FindBySlug(workspaceID uuid.UUID, slug string) (*Environment, error) {
	var e Environment
	err := r.db.Where("workspace_id = ? AND slug = ?", workspaceID, slug).First(&e).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	return &e, err
}

func (r *Repository) FindByID(id uuid.UUID) (*Environment, error) {
	var e Environment
	err := r.db.First(&e, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	return &e, err
}

func (r *Repository) ListByWorkspace(workspaceID uuid.UUID) ([]Environment, error) {
	var envs []Environment
	err := r.db.Where("workspace_id = ?", workspaceID).
		Order("\"order\" ASC, created_at ASC").
		Find(&envs).Error
	return envs, err
}

func (r *Repository) Update(e *Environment) error {
	return r.db.Save(e).Error
}

func (r *Repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&Environment{}, "id = ?", id).Error
}
