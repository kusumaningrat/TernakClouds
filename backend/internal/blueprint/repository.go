package blueprint

import "gorm.io/gorm"

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List() ([]Blueprint, error) {
	var items []Blueprint
	return items, r.db.Where("is_public = ?", true).Order("category, name").Find(&items).Error
}

func (r *Repository) FindByName(name string) (*Blueprint, error) {
	var b Blueprint
	err := r.db.Where("name = ?", name).First(&b).Error
	if err == gorm.ErrRecordNotFound {
		return nil, ErrBlueprintNotFound
	}
	return &b, err
}

func (r *Repository) FindByID(id string) (*Blueprint, error) {
	var b Blueprint
	err := r.db.Where("id = ?", id).First(&b).Error
	if err == gorm.ErrRecordNotFound {
		return nil, ErrBlueprintNotFound
	}
	return &b, err
}

func (r *Repository) Create(b *Blueprint) error {
	return r.db.Create(b).Error
}

func (r *Repository) Delete(id string) error {
	return r.db.Delete(&Blueprint{}, "id = ?", id).Error
}
