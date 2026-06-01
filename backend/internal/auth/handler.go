package auth

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kusumaningrat/ternakclouds/internal/middleware"
	"github.com/kusumaningrat/ternakclouds/internal/role"
	"github.com/kusumaningrat/ternakclouds/internal/user"
	"github.com/kusumaningrat/ternakclouds/pkg"
)

type MeResponse struct {
	*UserProfile
	Roles []role.UserRole `json:"roles"`
}

type AuthHandler struct {
	authService *AuthService
	roleService *role.RoleService
}

func NewAuthHandler(authService *AuthService, roleService *role.RoleService) *AuthHandler {
	return &AuthHandler{authService: authService, roleService: roleService}
}

// GET /api/v1/auth/me
func (h *AuthHandler) Me(c *gin.Context) {
	userID := middleware.GetUserID(c)

	profile, err := h.authService.Profile(userID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to fetch profile")
		return
	}

	roles, err := h.roleService.ListUserRoles(userID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to fetch roles")
		return
	}

	pkg.RespondOK(c, http.StatusOK, MeResponse{UserProfile: profile, Roles: roles})
}

// POST /api/v1/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "Invalid request. Please check your input.")
		return
	}

	registered, err := h.authService.Register(input)
	if errors.Is(err, user.ErrEmailTaken) {
		pkg.RespondErr(c, http.StatusConflict, err.Error())
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "registration failed")
		return
	}

	pkg.RespondOK(c, http.StatusCreated, registered)
}

// POST /api/v1/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "Invalid request. Please check your input.")
		return
	}

	tokens, err := h.authService.Login(input)
	if errors.Is(err, user.ErrInvalidCreds) {
		pkg.RespondErr(c, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "login failed")
		return
	}

	pkg.RespondOK(c, http.StatusOK, tokens)
}

// POST /api/v1/auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	var input LogoutInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "Invalid request. Please check your input.")
		return
	}

	if err := h.authService.Logout(input.RefreshToken); err != nil {
		pkg.RespondErr(c, http.StatusUnauthorized, err.Error())
		return
	}

	pkg.RespondMessage(c, http.StatusOK, "logged out successfully")
}

// POST /api/v1/auth/refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var input RefreshInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "Invalid request. Please check your input.")
		return
	}

	tokens, err := h.authService.RefreshToken(input.RefreshToken)
	if errors.Is(err, ErrInvalidToken) {
		pkg.RespondErr(c, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "token refresh failed")
		return
	}

	pkg.RespondOK(c, http.StatusOK, tokens)
}
