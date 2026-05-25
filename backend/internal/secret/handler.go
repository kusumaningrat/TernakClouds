package secret

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/internal/middleware"
	"github.com/kusumaningrat/idp-backend/pkg"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// isCallerOwner returns true when the authenticated user is the workspace owner.
func isCallerOwner(c *gin.Context) bool {
	userID := middleware.GetUserID(c)
	val, _ := c.Get("workspace_owner_id")
	ownerID, _ := val.(uuid.UUID)
	return userID != uuid.Nil && userID == ownerID
}

// GET .../secrets
func (h *Handler) ListGrants(c *gin.Context) {
	envID := contextEnvironmentID(c)

	grants, err := h.svc.List(envID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, err.Error())
		return
	}

	if isCallerOwner(c) {
		views := make([]AdminGrantView, len(grants))
		for i, g := range grants {
			views[i] = toAdminView(g)
		}
		pkg.RespondOK(c, http.StatusOK, views)
		return
	}

	views := make([]MemberGrantView, len(grants))
	for i, g := range grants {
		views[i] = toMemberView(g)
	}
	pkg.RespondOK(c, http.StatusOK, views)
}

// POST .../secrets
func (h *Handler) CreateGrant(c *gin.Context) {
	envID := contextEnvironmentID(c)
	wsID := contextWorkspaceID(c)
	callerID := middleware.GetUserID(c)

	var input CreateGrantInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	// Non-owners cannot set the vault path — strip it silently.
	if !isCallerOwner(c) {
		input.VaultPath = ""
	}

	g, err := h.svc.Create(c.Request.Context(), envID, wsID, callerID, input)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, err.Error())
		return
	}

	if isCallerOwner(c) {
		pkg.RespondOK(c, http.StatusCreated, toAdminView(*g))
		return
	}
	pkg.RespondOK(c, http.StatusCreated, toMemberView(*g))
}

// PUT .../secrets/:id
func (h *Handler) UpdateGrant(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid id")
		return
	}

	var input UpdateGrantInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	// Non-owners cannot change the vault path.
	if !isCallerOwner(c) {
		input.VaultPath = nil
	}

	g, err := h.svc.Update(c.Request.Context(), id, input)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "secret grant not found")
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, err.Error())
		return
	}

	if isCallerOwner(c) {
		pkg.RespondOK(c, http.StatusOK, toAdminView(*g))
		return
	}
	pkg.RespondOK(c, http.StatusOK, toMemberView(*g))
}

// DELETE .../secrets/:id
func (h *Handler) DeleteGrant(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid id")
		return
	}

	if err := h.svc.Delete(id); err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "secret grant not found")
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, gin.H{"deleted": true})
}

// PUT .../secrets/:id/value
func (h *Handler) WriteValue(c *gin.Context) {
	envID := contextEnvironmentID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid id")
		return
	}

	var input WriteSecretInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.svc.WriteValue(c.Request.Context(), envID, id, input.Path, input.Data); err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "secret grant not found")
			return
		}
		pkg.RespondErr(c, http.StatusBadGateway, "vault error: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, gin.H{"written": true})
}

// GET .../secrets/:id/value
func (h *Handler) GetValue(c *gin.Context) {
	envID := contextEnvironmentID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid id")
		return
	}

	resp, err := h.svc.ReadValue(c.Request.Context(), envID, id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "secret grant not found")
			return
		}
		pkg.RespondErr(c, http.StatusBadGateway, "vault error: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, resp)
}

func contextEnvironmentID(c *gin.Context) uuid.UUID {
	val, _ := c.Get("environment_id")
	id, _ := val.(uuid.UUID)
	return id
}

func contextWorkspaceID(c *gin.Context) uuid.UUID {
	val, _ := c.Get("workspace_id")
	id, _ := val.(uuid.UUID)
	return id
}

func toAdminView(g SecretGrant) AdminGrantView {
	return AdminGrantView{
		ID:          g.ID,
		Name:        g.Name,
		VaultPath:   g.VaultPath,
		Description: g.Description,
		CreatedBy:   g.CreatedBy,
		CreatedAt:   g.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   g.UpdatedAt.Format(time.RFC3339),
	}
}

func toMemberView(g SecretGrant) MemberGrantView {
	return MemberGrantView{
		ID:          g.ID,
		Name:        g.Name,
		Description: g.Description,
		CreatedAt:   g.CreatedAt.Format(time.RFC3339),
	}
}
