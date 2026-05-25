package servicecatalog

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/internal/middleware"
	"github.com/kusumaningrat/idp-backend/internal/nomad"
	"github.com/kusumaningrat/idp-backend/pkg"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GET /api/v1/service-catalog
func (h *Handler) ListCatalog(c *gin.Context) {
	items, err := h.svc.ListCatalog()
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list catalog")
		return
	}
	pkg.RespondOK(c, http.StatusOK, items)
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/service-deployments
func (h *Handler) Deploy(c *gin.Context) {
	workspaceID := contextWorkspaceID(c)
	envID := contextEnvironmentID(c)
	callerID := middleware.GetUserID(c)

	var input DeployInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	deployment, err := h.svc.Deploy(c.Request.Context(), workspaceID, envID, callerID, input)
	if err != nil {
		switch {
		case errors.Is(err, ErrCatalogNotFound):
			pkg.RespondErr(c, http.StatusNotFound, err.Error())
		case errors.Is(err, ErrRegistryRequired), errors.Is(err, ErrRegistryNotBound):
			pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, ErrNoVaultCapability):
			pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, nomad.ErrNoNomadProvider):
			pkg.RespondErr(c, http.StatusServiceUnavailable, err.Error())
		default:
			pkg.RespondErr(c, http.StatusInternalServerError, "deploy failed: "+err.Error())
		}
		return
	}

	pkg.RespondOK(c, http.StatusCreated, deployment)
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/service-deployments
func (h *Handler) ListDeployments(c *gin.Context) {
	envID := contextEnvironmentID(c)

	deployments, err := h.svc.ListDeployments(envID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list deployments")
		return
	}
	pkg.RespondOK(c, http.StatusOK, deployments)
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/service-deployments/:id
func (h *Handler) GetDeployment(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid deployment id")
		return
	}

	d, err := h.svc.GetDeployment(id)
	if err != nil {
		if errors.Is(err, ErrDeploymentNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, err.Error())
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to get deployment")
		return
	}
	pkg.RespondOK(c, http.StatusOK, d)
}

// DELETE /api/v1/workspaces/:slug/environments/:envSlug/service-deployments/:id
func (h *Handler) StopAndDelete(c *gin.Context) {
	envID := contextEnvironmentID(c)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid deployment id")
		return
	}

	if err := h.svc.StopAndDelete(c.Request.Context(), id, envID); err != nil {
		if errors.Is(err, ErrDeploymentNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, err.Error())
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to stop deployment: "+err.Error())
		return
	}
	pkg.RespondMessage(c, http.StatusOK, "deployment stopped and removed")
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
