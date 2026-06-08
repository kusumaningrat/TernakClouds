package user

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/middleware"
	"github.com/kusumaningrat/ternakclouds/pkg"
)

// RoleAssigner is satisfied by role.RoleService.
type RoleAssigner interface {
	AssignRoleByName(userID uuid.UUID, roleName string) error
}

// WorkspaceAdder is satisfied by workspace.Service.
type WorkspaceAdder interface {
	AddMemberDirect(workspaceID, userID uuid.UUID) error
}

type Handler struct {
	svc     *UserService
	roleSvc RoleAssigner
	wsSvc   WorkspaceAdder
}

func NewHandler(svc *UserService, roleSvc RoleAssigner, wsSvc WorkspaceAdder) *Handler {
	return &Handler{svc: svc, roleSvc: roleSvc, wsSvc: wsSvc}
}

// GET /api/v1/users
// Query params: workspace, department_id, role_id, status (active|inactive), page, limit
func (h *Handler) List(c *gin.Context) {
	f := ListFilters{
		WorkspaceSlug: c.Query("workspace"),
		DepartmentID:  c.Query("department_id"),
		RoleID:        c.Query("role_id"),
		Page:          1,
		Limit:         20,
	}

	if s := c.Query("status"); s == "active" {
		t := true
		f.IsActive = &t
	} else if s == "inactive" {
		t := false
		f.IsActive = &t
	}

	if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
		f.Page = p
	}
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		f.Limit = l
	}

	users, total, err := h.svc.ListWithDetails(f)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list users")
		return
	}

	pkg.RespondOK(c, http.StatusOK, UserListResponse{
		Items: users,
		Total: total,
		Page:  f.Page,
		Limit: f.Limit,
	})
}

// POST /api/v1/users
func (h *Handler) Create(c *gin.Context) {
	var input CreateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "Invalid request. Please check your input.")
		return
	}

	deptID, err := uuid.Parse(input.DepartmentID)
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid department_id")
		return
	}

	wsID, err := uuid.Parse(input.WorkspaceID)
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid workspace_id")
		return
	}

	u, err := h.svc.Register(input.Email, input.Password, input.FirstName, input.LastName, deptID, true)
	if errors.Is(err, ErrEmailTaken) {
		pkg.RespondErr(c, http.StatusConflict, "email already in use")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to create user")
		return
	}

	if h.roleSvc != nil && input.Role != "" {
		_ = h.roleSvc.AssignRoleByName(u.ID, input.Role)
	}

	if h.wsSvc != nil {
		if err := h.wsSvc.AddMemberDirect(wsID, u.ID); err != nil {
			pkg.RespondErr(c, http.StatusInternalServerError, "user created but failed to assign to workspace")
			return
		}
	}

	pkg.RespondOK(c, http.StatusCreated, u)
}

// PUT /api/v1/users/me/password
func (h *Handler) ChangePassword(c *gin.Context) {
	var input ChangePasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "Invalid request. Please check your input.")
		return
	}

	userID := middleware.GetUserID(c)

	err := h.svc.ChangePassword(userID, input.CurrentPassword, input.NewPassword)
	if errors.Is(err, ErrWrongPassword) {
		pkg.RespondErr(c, http.StatusUnauthorized, "Current password is incorrect.")
		return
	}
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "User not found.")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "Failed to change password.")
		return
	}

	pkg.RespondOK(c, http.StatusOK, gin.H{"message": "Password updated successfully."})
}
