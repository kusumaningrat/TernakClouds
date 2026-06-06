package platformapp

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/blueprint"
	"github.com/kusumaningrat/ternakclouds/internal/middleware"
	"github.com/kusumaningrat/ternakclouds/internal/nomad"
	"github.com/kusumaningrat/ternakclouds/pkg"
)

func queryInt(c *gin.Context, key string, def int) int {
	v, err := strconv.Atoi(c.Query(key))
	if err != nil || v < 1 {
		return def
	}
	return v
}

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/platform-apps/preview
func (h *Handler) Preview(c *gin.Context) {
	wsSlug := c.Param("slug")
	envSlug := c.Param("envSlug")

	var input PreviewInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	resources, err := h.svc.Preview(input, wsSlug, envSlug)
	if err != nil {
		switch {
		case errors.Is(err, blueprint.ErrBlueprintNotFound):
			pkg.RespondErr(c, http.StatusNotFound, err.Error())
		case errors.Is(err, ErrUnsupportedRuntime):
			pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		default:
			pkg.RespondErr(c, http.StatusInternalServerError, "preview failed: "+err.Error())
		}
		return
	}
	pkg.RespondOK(c, http.StatusOK, resources)
}

// POST /api/v1/workspaces/:slug/environments/:envSlug/platform-apps
func (h *Handler) Provision(c *gin.Context) {
	wsSlug := c.Param("slug")
	envSlug := c.Param("envSlug")
	wsID := contextWorkspaceID(c)
	envID := contextEnvironmentID(c)
	callerID := middleware.GetUserID(c)

	var input ProvisionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	app, err := h.svc.Provision(c.Request.Context(), wsID, envID, callerID, wsSlug, envSlug, input)
	if err != nil {
		switch {
		case errors.Is(err, blueprint.ErrBlueprintNotFound):
			pkg.RespondErr(c, http.StatusNotFound, err.Error())
		case errors.Is(err, ErrUnsupportedRuntime):
			pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, nomad.ErrNoNomadProvider):
			pkg.RespondErr(c, http.StatusServiceUnavailable, err.Error())
		default:
			pkg.RespondErr(c, http.StatusInternalServerError, "provision failed: "+err.Error())
		}
		return
	}
	pkg.RespondOK(c, http.StatusCreated, app)
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/platform-apps?page=1&limit=5
func (h *Handler) List(c *gin.Context) {
	envID := contextEnvironmentID(c)
	pageNum := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 5)

	result, err := h.svc.List(envID, pageNum, limit)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list applications")
		return
	}
	pkg.RespondOK(c, http.StatusOK, result)
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/platform-apps/:id/deployments?page=1&limit=5
func (h *Handler) ListDeployments(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid application id")
		return
	}

	pageNum := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 5)

	result, err := h.svc.ListDeployments(id, pageNum, limit)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list deployments")
		return
	}
	pkg.RespondOK(c, http.StatusOK, result)
}

// GET /api/v1/workspaces/:slug/environments/:envSlug/platform-apps/:id
func (h *Handler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid application id")
		return
	}

	app, err := h.svc.Get(id)
	if err != nil {
		if errors.Is(err, ErrAppNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, err.Error())
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to get application")
		return
	}
	pkg.RespondOK(c, http.StatusOK, app)
}

// DELETE /api/v1/workspaces/:slug/environments/:envSlug/platform-apps/:id
func (h *Handler) Delete(c *gin.Context) {
	envID := contextEnvironmentID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid application id")
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id, envID); err != nil {
		if errors.Is(err, ErrAppNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, err.Error())
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to delete application: "+err.Error())
		return
	}
	pkg.RespondMessage(c, http.StatusOK, "application stopped and removed")
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
