package registry

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

// --- RegistryProvider ---

func (r *Repository) CreateProvider(p *RegistryProvider) error {
	return r.db.Create(p).Error
}

func (r *Repository) FindProviderByID(id uuid.UUID) (*RegistryProvider, error) {
	var p RegistryProvider
	err := r.db.First(&p, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	return &p, err
}

func (r *Repository) ListProviders(workspaceID uuid.UUID) ([]RegistryProvider, error) {
	var providers []RegistryProvider
	err := r.db.Where("workspace_id = ?", workspaceID).Find(&providers).Error
	return providers, err
}

func (r *Repository) UpdateProvider(p *RegistryProvider) error {
	return r.db.Save(p).Error
}

func (r *Repository) DeleteProvider(id uuid.UUID) error {
	return r.db.Delete(&RegistryProvider{}, "id = ?", id).Error
}

// --- RegistryBinding ---

func (r *Repository) CreateBinding(b *RegistryBinding) error {
	return r.db.Create(b).Error
}

func (r *Repository) FindBindingByID(id uuid.UUID) (*RegistryBinding, error) {
	var b RegistryBinding
	err := r.db.First(&b, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrBindingNotFound
	}
	return &b, err
}

func (r *Repository) FindBinding(envID, registryID uuid.UUID) (*RegistryBinding, error) {
	var b RegistryBinding
	err := r.db.Where("environment_id = ? AND registry_id = ?", envID, registryID).First(&b).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &b, err
}

func (r *Repository) ListBindingsWithProvider(envID uuid.UUID) ([]BindingWithProvider, error) {
	var results []BindingWithProvider
	err := r.db.Table("registry_bindings").
		Select("registry_bindings.*, registry_providers.name as registry_name, registry_providers.provider_type as registry_type, registry_providers.endpoint as registry_endpoint").
		Joins("LEFT JOIN registry_providers ON registry_providers.id = registry_bindings.registry_id AND registry_providers.deleted_at IS NULL").
		Where("registry_bindings.environment_id = ? AND registry_bindings.deleted_at IS NULL", envID).
		Scan(&results).Error
	return results, err
}

func (r *Repository) DeleteBinding(id uuid.UUID) error {
	result := r.db.Delete(&RegistryBinding{}, "id = ?", id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrBindingNotFound
	}
	return nil
}

func (r *Repository) DeleteBindingsByRegistry(registryID uuid.UUID) error {
	return r.db.Where("registry_id = ?", registryID).Delete(&RegistryBinding{}).Error
}
