package capability

import (
	"errors"
	"log/slog"
	"net/http"

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

// GET /api/v1/workspaces/:slug/environments/:envSlug/capabilities
func (h *Handler) List(c *gin.Context) {
	envID := contextEnvironmentID(c)

	caps, err := h.svc.ListForEnvironment(envID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list capabilities")
		return
	}

	pkg.RespondOK(c, http.StatusOK, caps)
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap
func (h *Handler) Get(c *gin.Context) {
	envID := contextEnvironmentID(c)
	capName := c.Param("cap")

	status, err := h.svc.GetStatus(envID, capName)
	if err != nil {
		pkg.RespondErr(c, http.StatusNotFound, err.Error())
		return
	}

	pkg.RespondOK(c, http.StatusOK, status)
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/providers
func (h *Handler) ListProviders(c *gin.Context) {
	capName := c.Param("cap")

	providers, err := h.svc.ListProviders(capName)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list providers")
		return
	}

	pkg.RespondOK(c, http.StatusOK, providers)
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/provider
func (h *Handler) BindProvider(c *gin.Context) {
	envID := contextEnvironmentID(c)
	capName := c.Param("cap")
	callerID := middleware.GetUserID(c)

	var input BindProviderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	status, err := h.svc.BindProvider(c.Request.Context(), envID, capName, input, callerID)
	if err != nil {
		if errors.Is(err, ErrVaultDisabled) {
			pkg.RespondErr(c, http.StatusServiceUnavailable, err.Error())
			return
		}
		if errors.Is(err, ErrProviderAlreadyBound) {
			pkg.RespondErr(c, http.StatusConflict, err.Error())
			return
		}
		slog.Error("bind provider failed", "err", err, "env_id", envID, "cap", capName)
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to bind provider: "+err.Error())
		return
	}

	pkg.RespondOK(c, http.StatusOK, status)
}

// PUT /api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/provider/:providerID
func (h *Handler) UpdateProvider(c *gin.Context) {
	envID := contextEnvironmentID(c)
	capName := c.Param("cap")

	providerID, err := uuid.Parse(c.Param("providerID"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid provider id")
		return
	}

	var input UpdateProviderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	status, err := h.svc.UpdateProvider(c.Request.Context(), envID, capName, providerID, input)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "provider not found")
			return
		}
		if errors.Is(err, ErrVaultDisabled) {
			pkg.RespondErr(c, http.StatusServiceUnavailable, err.Error())
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to update provider")
		return
	}

	pkg.RespondOK(c, http.StatusOK, status)
}

// DELETE /api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/provider/:providerID
func (h *Handler) UnbindProvider(c *gin.Context) {
	envID := contextEnvironmentID(c)
	capName := c.Param("cap")

	providerID, err := uuid.Parse(c.Param("providerID"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid provider id")
		return
	}

	if err := h.svc.UnbindProvider(c.Request.Context(), envID, capName, providerID); err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "provider not found")
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to unbind provider")
		return
	}

	pkg.RespondMessage(c, http.StatusOK, "provider unbound")
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/provider/:providerID/verify
func (h *Handler) VerifyProvider(c *gin.Context) {
	envID := contextEnvironmentID(c)
	capName := c.Param("cap")

	providerID, err := uuid.Parse(c.Param("providerID"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid provider id")
		return
	}

	result, err := h.svc.VerifyProvider(c.Request.Context(), envID, capName, providerID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "provider not found")
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "verification failed")
		return
	}

	pkg.RespondOK(c, http.StatusOK, result)
}

func contextEnvironmentID(c *gin.Context) uuid.UUID {
	val, _ := c.Get("environment_id")
	id, _ := val.(uuid.UUID)
	return id
}
