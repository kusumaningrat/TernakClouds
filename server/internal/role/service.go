package role

import (
	"errors"

	"github.com/google/uuid"
)

var (
	ErrRoleNotFound = errors.New("role not found")
)

type RoleService struct {
	roleRepo *RoleRepository
}

func NewRoleService(roleRepo *RoleRepository) *RoleService {
	return &RoleService{roleRepo: roleRepo}
}

func (s *RoleService) GetRole(id uuid.UUID) (*Role, error) {
	r, err := s.roleRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if r == nil {
		return nil, ErrRoleNotFound
	}
	return r, nil
}

func (s *RoleService) ListRoles() ([]Role, error) {
	return s.roleRepo.List()
}

func (s *RoleService) AssignRole(userID, roleID uuid.UUID) error {
	return s.roleRepo.AssignRole(userID, roleID)
}

func (s *RoleService) RevokeRole(userID, roleID uuid.UUID) error {
	return s.roleRepo.RevokeRole(userID, roleID)
}

func (s *RoleService) ListUserRoles(userID uuid.UUID) ([]UserRole, error) {
	return s.roleRepo.ListUserRoles(userID)
}

func (s *RoleService) HasPermission(userID uuid.UUID, permissionName string) (bool, error) {
	userRoles, err := s.roleRepo.ListUserRoles(userID)
	if err != nil {
		return false, err
	}
	for _, ur := range userRoles {
		if ur.Role == nil {
			continue
		}
		for _, rp := range ur.Role.RolePermissions {
			if rp.Permission != nil && rp.Permission.Name == permissionName {
				return true, nil
			}
		}
	}
	return false, nil
}
