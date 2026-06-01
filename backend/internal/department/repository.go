package department

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DepartmentRepository struct {
	db *gorm.DB
}

func NewDepartmentRepository(db *gorm.DB) *DepartmentRepository {
	return &DepartmentRepository{db: db}
}

func (r *DepartmentRepository) Create(dept *Department) error {
	return r.db.Create(dept).Error
}

func (r *DepartmentRepository) FindByID(id uuid.UUID) (*Department, error) {
	var dept Department
	err := r.db.First(&dept, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &dept, err
}

func (r *DepartmentRepository) FindBySlug(slug string) (*Department, error) {
	var dept Department
	err := r.db.First(&dept, "slug = ?", slug).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &dept, err
}

func (r *DepartmentRepository) List(page, limit int) ([]Department, int64, error) {
	var depts []Department
	var total int64
	r.db.Model(&Department{}).Count(&total)
	err := r.db.Offset((page - 1) * limit).Limit(limit).Find(&depts).Error
	return depts, total, err
}

func (r *DepartmentRepository) Update(dept *Department) error {
	return r.db.Save(dept).Error
}

func (r *DepartmentRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&Department{}, "id = ?", id).Error
}
