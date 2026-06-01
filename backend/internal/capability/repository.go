package capability

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrNotFound = errors.New("capability binding not found")
var ErrProviderAlreadyBound = errors.New("this provider is already bound to this capability")

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// ListCapabilities returns the seeded capability catalogue.
func (r *Repository) ListCapabilities() ([]Capability, error) {
	var caps []Capability
	return caps, r.db.Find(&caps).Error
}

// FindCapabilityByName returns a single capability from the catalogue.
func (r *Repository) FindCapabilityByName(name string) (*Capability, error) {
	var cap Capability
	err := r.db.Where("name = ?", name).First(&cap).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &cap, err
}

// ListProvidersByCapability returns all catalogue providers for a given capability.
func (r *Repository) ListProvidersByCapability(capName string) ([]Provider, error) {
	var providers []Provider
	return providers, r.db.Where("capability_name = ?", capName).Find(&providers).Error
}

// FindProviderByCapAndName returns the catalogue provider entry by capability + name.
func (r *Repository) FindProviderByCapAndName(capName, providerName string) (*Provider, error) {
	var p Provider
	err := r.db.Where("capability_name = ? AND name = ?", capName, providerName).First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &p, err
}

// ListBindings returns all capability bindings for an environment with all ProviderConfigs preloaded.
func (r *Repository) ListBindings(envID uuid.UUID) ([]CapabilityBinding, error) {
	var bindings []CapabilityBinding
	return bindings, r.db.
		Where("environment_id = ?", envID).
		Preload("ProviderConfigs").
		Find(&bindings).Error
}

// FindBinding returns the binding for a specific (environment, capability) pair.
func (r *Repository) FindBinding(envID uuid.UUID, capName string) (*CapabilityBinding, error) {
	var b CapabilityBinding
	err := r.db.
		Where("environment_id = ? AND capability_name = ?", envID, capName).
		Preload("ProviderConfigs").
		First(&b).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &b, err
}

// UpsertBinding creates or updates a CapabilityBinding row.
func (r *Repository) UpsertBinding(b *CapabilityBinding) error {
	return r.db.
		Where("environment_id = ? AND capability_name = ?", b.EnvironmentID, b.CapabilityName).
		Assign(CapabilityBinding{IsEnabled: b.IsEnabled}).
		FirstOrCreate(b).Error
}

// CreateProviderConfig inserts a new ProviderConfig.
func (r *Repository) CreateProviderConfig(cfg *ProviderConfig) error {
	return r.db.Create(cfg).Error
}

// UpdateProviderConfig saves changes to an existing ProviderConfig.
func (r *Repository) UpdateProviderConfig(cfg *ProviderConfig) error {
	return r.db.Save(cfg).Error
}

// FindProviderConfig returns a single ProviderConfig by its primary key.
func (r *Repository) FindProviderConfig(id uuid.UUID) (*ProviderConfig, error) {
	var cfg ProviderConfig
	err := r.db.First(&cfg, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &cfg, err
}

// DeleteProviderConfigByID removes a ProviderConfig by its primary key.
func (r *Repository) DeleteProviderConfigByID(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&ProviderConfig{}).Error
}
