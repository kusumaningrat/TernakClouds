package role

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/pkg"
)

type RoleHandler struct {
	roleService *RoleService
}

func NewRoleHandler(roleService *RoleService) *RoleHandler {
	return &RoleHandler{roleService: roleService}
}

// GET /api/v1/roles
func (h *RoleHandler) ListRoles(c *gin.Context) {
	roles, err := h.roleService.ListRoles()
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to fetch roles")
		return
	}
	pkg.RespondOK(c, http.StatusOK, roles)
}

// GET /api/v1/roles/:id
func (h *RoleHandler) GetRole(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid role id")
		return
	}

	r, err := h.roleService.GetRole(id)
	if errors.Is(err, ErrRoleNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to fetch role")
		return
	}

	pkg.RespondOK(c, http.StatusOK, r)
}

// GET /api/v1/users/:id/roles
func (h *RoleHandler) ListUserRoles(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid user id")
		return
	}

	userRoles, err := h.roleService.ListUserRoles(userID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to fetch user roles")
		return
	}

	pkg.RespondOK(c, http.StatusOK, userRoles)
}

// POST /api/v1/users/:id/roles
func (h *RoleHandler) AssignRole(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid user id")
		return
	}

	var input AssignRoleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	roleID, err := uuid.Parse(input.RoleID)
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid role_id")
		return
	}

	if err := h.roleService.AssignRole(userID, roleID); err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to assign role")
		return
	}

	pkg.RespondMessage(c, http.StatusOK, "role assigned successfully")
}

// DELETE /api/v1/users/:id/roles/:roleId
func (h *RoleHandler) RevokeRole(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid user id")
		return
	}

	roleID, err := uuid.Parse(c.Param("roleId"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid role id")
		return
	}

	if err := h.roleService.RevokeRole(userID, roleID); err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to revoke role")
		return
	}

	pkg.RespondMessage(c, http.StatusOK, "role revoked successfully")
}

// GET /api/v1/users/:id/permissions/:permission
func (h *RoleHandler) CheckPermission(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid user id")
		return
	}

	permName := c.Param("permission")

	has, err := h.roleService.HasPermission(userID, permName)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to check permission")
		return
	}

	pkg.RespondOK(c, http.StatusOK, gin.H{
		"user_id":        userID,
		"permission":     permName,
		"has_permission": has,
	})
}
