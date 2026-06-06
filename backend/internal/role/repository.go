package role

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RoleRepository struct {
	db *gorm.DB
}

func NewRoleRepository(db *gorm.DB) *RoleRepository {
	return &RoleRepository{db: db}
}

func (r *RoleRepository) FindByID(id uuid.UUID) (*Role, error) {
	var role Role
	err := r.db.Preload("RolePermissions.Permission").First(&role, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &role, err
}

func (r *RoleRepository) FindByName(name string) (*Role, error) {
	var role Role
	err := r.db.Preload("RolePermissions.Permission").First(&role, "name = ?", name).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &role, err
}

func (r *RoleRepository) List() ([]Role, error) {
	var roles []Role
	err := r.db.Preload("RolePermissions.Permission").Find(&roles).Error
	return roles, err
}

func (r *RoleRepository) Create(role *Role) error {
	return r.db.Create(role).Error
}

func (r *RoleRepository) Update(role *Role) error {
	return r.db.Save(role).Error
}

func (r *RoleRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&Role{}, "id = ?", id).Error
}

func (r *RoleRepository) AssignRole(userID, roleID uuid.UUID) error {
	ur := &UserRole{UserID: userID, RoleID: roleID}
	return r.db.Where("user_id = ? AND role_id = ?", userID, roleID).FirstOrCreate(ur).Error
}

func (r *RoleRepository) RevokeRole(userID, roleID uuid.UUID) error {
	return r.db.Delete(&UserRole{}, "user_id = ? AND role_id = ?", userID, roleID).Error
}

func (r *RoleRepository) ListUserRoles(userID uuid.UUID) ([]UserRole, error) {
	var userRoles []UserRole
	err := r.db.Preload("Role.RolePermissions.Permission").
		Where("user_id = ?", userID).Find(&userRoles).Error
	return userRoles, err
}

func (r *RoleRepository) FindPermissionByName(name string) (*Permission, error) {
	var p Permission
	err := r.db.First(&p, "name = ?", name).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &p, err
}
