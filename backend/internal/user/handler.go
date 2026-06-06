package user

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kusumaningrat/ternakclouds/pkg"
)

type Handler struct {
	svc *UserService
}

func NewHandler(svc *UserService) *Handler {
	return &Handler{svc: svc}
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
