package user

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Register(u *User) error {
	return r.db.Create(u).Error
}

func (r *UserRepository) FindByID(id uuid.UUID) (*User, error) {
	var u User
	err := r.db.First(&u, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &u, err
}

func (r *UserRepository) FindByEmail(email string) (*User, error) {
	var u User
	err := r.db.First(&u, "email = ?", email).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &u, err
}

func (r *UserRepository) List(page, limit int) ([]User, int64, error) {
	var users []User
	var total int64
	r.db.Model(&User{}).Count(&total)
	err := r.db.Offset((page - 1) * limit).Limit(limit).Find(&users).Error
	return users, total, err
}

// ListWithDetails returns a paginated, filterable list of users enriched with
// their department name, assigned roles, and workspace memberships.
func (r *UserRepository) ListWithDetails(f ListFilters) ([]UserSummary, int64, error) {
	page, limit := f.Page, f.Limit
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	// ── 1. Base query: users joined with departments ──────────────────────────
	q := r.db.Table("users").
		Select(`users.id, users.email, users.first_name, users.last_name,
		        users.is_active, users.department_id, users.created_at, users.updated_at,
		        COALESCE(d.name, '') as department_name`).
		Joins("LEFT JOIN departments d ON d.id = users.department_id").
		Where("users.deleted_at IS NULL")

	if f.DepartmentID != "" {
		q = q.Where("users.department_id = ?", f.DepartmentID)
	}
	if f.IsActive != nil {
		q = q.Where("users.is_active = ?", *f.IsActive)
	}
	if f.WorkspaceSlug != "" {
		q = q.Where(`users.id IN (
			SELECT wm.user_id FROM workspace_members wm
			JOIN workspaces w ON w.id = wm.workspace_id
			WHERE w.slug = ? AND w.deleted_at IS NULL
		)`, f.WorkspaceSlug)
	}
	if f.RoleID != "" {
		q = q.Where("users.id IN (SELECT ur.user_id FROM user_roles ur WHERE ur.role_id = ?)", f.RoleID)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var baseRows []userBaseRow
	if err := q.Offset((page-1)*limit).Limit(limit).
		Order("users.created_at DESC").
		Scan(&baseRows).Error; err != nil {
		return nil, 0, err
	}
	if len(baseRows) == 0 {
		return []UserSummary{}, total, nil
	}

	// ── 2. Collect user IDs for batch sub-queries ─────────────────────────────
	ids := make([]uuid.UUID, len(baseRows))
	for i, row := range baseRows {
		ids[i] = row.ID
	}

	// ── 3. Batch-load roles ───────────────────────────────────────────────────
	var roleRows []userRoleRow
	r.db.Table("user_roles").
		Select(`user_roles.user_id, user_roles.role_id, user_roles.assigned_at,
		        roles.name as role_name, COALESCE(roles.description,'') as description`).
		Joins("JOIN roles ON roles.id = user_roles.role_id").
		Where("user_roles.user_id IN ?", ids).
		Scan(&roleRows)

	// ── 4. Batch-load workspace memberships ───────────────────────────────────
	var wsRows []userWorkspaceRow
	r.db.Table("workspace_members").
		Select(`workspace_members.user_id, workspace_members.workspace_id,
		        workspace_members.role as ws_role, workspace_members.joined_at,
		        workspaces.name as workspace_name, workspaces.slug as workspace_slug`).
		Joins("JOIN workspaces ON workspaces.id = workspace_members.workspace_id").
		Where("workspace_members.user_id IN ? AND workspaces.deleted_at IS NULL", ids).
		Scan(&wsRows)

	// ── 5. Index by user ID ───────────────────────────────────────────────────
	rolesByUser := map[uuid.UUID][]UserRoleSummary{}
	for _, r := range roleRows {
		rolesByUser[r.UserID] = append(rolesByUser[r.UserID], UserRoleSummary{
			RoleID:      r.RoleID,
			RoleName:    r.RoleName,
			Description: r.Description,
			AssignedAt:  r.AssignedAt,
		})
	}
	wsByUser := map[uuid.UUID][]UserWorkspaceSummary{}
	for _, w := range wsRows {
		wsByUser[w.UserID] = append(wsByUser[w.UserID], UserWorkspaceSummary{
			WorkspaceID:   w.WorkspaceID,
			WorkspaceName: w.WorkspaceName,
			WorkspaceSlug: w.WorkspaceSlug,
			Role:          w.WsRole,
			JoinedAt:      w.JoinedAt,
		})
	}

	// ── 6. Assemble final response ────────────────────────────────────────────
	summaries := make([]UserSummary, len(baseRows))
	for i, u := range baseRows {
		roles := rolesByUser[u.ID]
		if roles == nil {
			roles = []UserRoleSummary{}
		}
		ws := wsByUser[u.ID]
		if ws == nil {
			ws = []UserWorkspaceSummary{}
		}
		summaries[i] = UserSummary{
			ID:             u.ID,
			Email:          u.Email,
			FirstName:      u.FirstName,
			LastName:       u.LastName,
			IsActive:       u.IsActive,
			DepartmentID:   u.DepartmentID,
			DepartmentName: u.DepartmentName,
			CreatedAt:      u.CreatedAt,
			UpdatedAt:      u.UpdatedAt,
			Roles:          roles,
			Workspaces:     ws,
		}
	}
	return summaries, total, nil
}

func (r *UserRepository) Update(u *User) error {
	return r.db.Save(u).Error
}

func (r *UserRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&User{}, "id = ?", id).Error
}

type RefreshTokenRepository struct {
	db *gorm.DB
}

func NewRefreshTokenRepository(db *gorm.DB) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

func (r *RefreshTokenRepository) Create(rt *RefreshToken) error {
	return r.db.Create(rt).Error
}

func (r *RefreshTokenRepository) FindByHash(hash string) (*RefreshToken, error) {
	var rt RefreshToken
	err := r.db.First(&rt, "token_hash = ?", hash).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &rt, err
}

func (r *RefreshTokenRepository) RevokeOne(id uuid.UUID) error {
	return r.db.Model(&RefreshToken{}).Where("id = ?", id).Update("revoked", true).Error
}

func (r *RefreshTokenRepository) RevokeByUserID(userID uuid.UUID) error {
	return r.db.Model(&RefreshToken{}).
		Where("user_id = ? AND revoked = false", userID).
		Update("revoked", true).Error
}

func (r *RefreshTokenRepository) DeleteExpired() error {
	return r.db.Delete(&RefreshToken{}, "expires_at < ?", time.Now()).Error
}
