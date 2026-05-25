package secret

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrNotFound = errors.New("secret grant not found")

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(g *SecretGrant) error {
	return r.db.Create(g).Error
}

func (r *Repository) FindByID(id uuid.UUID) (*SecretGrant, error) {
	var g SecretGrant
	err := r.db.First(&g, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	return &g, err
}

func (r *Repository) List(envID uuid.UUID) ([]SecretGrant, error) {
	var grants []SecretGrant
	return grants, r.db.Where("environment_id = ?", envID).Order("created_at ASC").Find(&grants).Error
}

func (r *Repository) Update(g *SecretGrant) error {
	return r.db.Save(g).Error
}

func (r *Repository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&SecretGrant{}).Error
}
