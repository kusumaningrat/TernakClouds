package servicecatalog

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

func (r *Repository) ListCatalog() ([]CatalogItem, error) {
	var items []CatalogItem
	return items, r.db.Order("name").Find(&items).Error
}

func (r *Repository) FindCatalogByName(name string) (*CatalogItem, error) {
	var item CatalogItem
	err := r.db.Where("name = ?", name).First(&item).Error
	if err == gorm.ErrRecordNotFound {
		return nil, ErrCatalogNotFound
	}
	return &item, err
}

func (r *Repository) CreateDeployment(d *ServiceDeployment) error {
	return r.db.Create(d).Error
}

func (r *Repository) ListDeployments(envID uuid.UUID) ([]ServiceDeployment, error) {
	var deployments []ServiceDeployment
	return deployments, r.db.
		Where("environment_id = ?", envID).
		Order("created_at desc").
		Find(&deployments).Error
}

func (r *Repository) FindDeployment(id uuid.UUID) (*ServiceDeployment, error) {
	var d ServiceDeployment
	err := r.db.Where("id = ?", id).First(&d).Error
	if err == gorm.ErrRecordNotFound {
		return nil, ErrDeploymentNotFound
	}
	return &d, err
}

func (r *Repository) DeleteDeployment(id uuid.UUID) error {
	return r.db.Delete(&ServiceDeployment{}, "id = ?", id).Error
}
