package accessrequest

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrNotFound = errors.New("access request not found")

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ar *AccessRequest) error {
	return r.db.Create(ar).Error
}

func (r *Repository) FindByID(id uuid.UUID) (*AccessRequest, error) {
	var ar AccessRequest
	if err := r.db.Where("id = ?", id).First(&ar).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &ar, nil
}

func (r *Repository) Update(ar *AccessRequest) error {
	return r.db.Save(ar).Error
}

func (r *Repository) HasPendingRequest(userID, workspaceID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&AccessRequest{}).
		Where("user_id = ? AND workspace_id = ? AND status = ?", userID, workspaceID, StatusPending).
		Count(&count).Error
	return count > 0, err
}

const detailQuery = `
SELECT
    access_requests.id, access_requests.user_id, access_requests.workspace_id,
    access_requests.requested_role, access_requests.reason, access_requests.status,
    access_requests.reviewed_by, access_requests.reviewed_at, access_requests.created_at,
    users.first_name, users.last_name, users.email,
    workspaces.name AS workspace_name, workspaces.slug AS workspace_slug
FROM access_requests
JOIN users ON users.id = access_requests.user_id AND users.deleted_at IS NULL
JOIN workspaces ON workspaces.id = access_requests.workspace_id AND workspaces.deleted_at IS NULL
WHERE access_requests.deleted_at IS NULL AND `

func (r *Repository) ListByStatus(status string) ([]AccessRequestDetail, error) {
	var out []AccessRequestDetail
	err := r.db.Raw(detailQuery+"access_requests.status = ? ORDER BY access_requests.created_at DESC", status).
		Scan(&out).Error
	return out, err
}

func (r *Repository) ListByUser(userID uuid.UUID) ([]AccessRequestDetail, error) {
	var out []AccessRequestDetail
	err := r.db.Raw(detailQuery+"access_requests.user_id = ? ORDER BY access_requests.created_at DESC", userID).
		Scan(&out).Error
	return out, err
}
