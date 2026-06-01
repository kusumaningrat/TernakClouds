package workspace

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrNotFound = errors.New("workspace not found")
var ErrSlugTaken = errors.New("workspace slug already taken")
var ErrAlreadyMember = errors.New("user is already a member")
var ErrMemberNotFound = errors.New("member not found")
var ErrForbidden = errors.New("forbidden")

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(w *Workspace) error {
	return r.db.Create(w).Error
}

func (r *Repository) FindBySlug(slug string) (*Workspace, error) {
	var w Workspace
	err := r.db.Preload("Members").Where("slug = ?", slug).First(&w).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	return &w, err
}

func (r *Repository) FindByID(id uuid.UUID) (*Workspace, error) {
	var w Workspace
	err := r.db.Preload("Members").First(&w, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	return &w, err
}

func (r *Repository) ListByUserID(userID uuid.UUID) ([]Workspace, error) {
	var workspaces []Workspace
	err := r.db.
		Joins("JOIN workspace_members ON workspace_members.workspace_id = workspaces.id").
		Where("workspace_members.user_id = ? AND workspaces.deleted_at IS NULL", userID).
		Find(&workspaces).Error
	return workspaces, err
}

func (r *Repository) ListAll() ([]Workspace, error) {
	var workspaces []Workspace
	err := r.db.Find(&workspaces).Error
	return workspaces, err
}

func (r *Repository) Update(w *Workspace) error {
	return r.db.Save(w).Error
}

func (r *Repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&Workspace{}, "id = ?", id).Error
}

func (r *Repository) AddMember(m *WorkspaceMember) error {
	return r.db.Create(m).Error
}

func (r *Repository) FindMember(workspaceID, userID uuid.UUID) (*WorkspaceMember, error) {
	var m WorkspaceMember
	err := r.db.Where("workspace_id = ? AND user_id = ?", workspaceID, userID).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &m, err
}

func (r *Repository) RemoveMember(workspaceID, userID uuid.UUID) error {
	result := r.db.Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		Delete(&WorkspaceMember{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrMemberNotFound
	}
	return nil
}

func (r *Repository) ListMembers(workspaceID uuid.UUID) ([]WorkspaceMemberDetail, error) {
	var members []WorkspaceMemberDetail
	err := r.db.Table("workspace_members").
		Select("workspace_members.*, users.first_name, users.last_name").
		Joins("LEFT JOIN users ON users.id = workspace_members.user_id AND users.deleted_at IS NULL").
		Where("workspace_members.workspace_id = ?", workspaceID).
		Scan(&members).Error
	return members, err
}
