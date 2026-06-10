package blueprintrun

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/middleware"
	"github.com/kusumaningrat/ternakclouds/pkg"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// POST /api/v1/workspaces/:slug/blueprint-runs
func (h *Handler) Trigger(c *gin.Context) {
	workspaceID := contextWorkspaceID(c)
	callerID := middleware.GetUserID(c)

	var input TriggerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	envID, err := uuid.Parse(input.EnvironmentID)
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid environment_id")
		return
	}

	run, err := h.svc.Trigger(c.Request.Context(), workspaceID, envID, input.EnvironmentSlug, callerID, input)
	if err != nil {
		if errors.Is(err, ErrBlueprintNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, err.Error())
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, err.Error())
		return
	}

	pkg.RespondOK(c, http.StatusCreated, run)
}

// GET /api/v1/workspaces/:slug/blueprint-runs
func (h *Handler) List(c *gin.Context) {
	workspaceID := contextWorkspaceID(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	result, err := h.svc.List(workspaceID, page, limit)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list blueprint runs")
		return
	}

	pkg.RespondOK(c, http.StatusOK, result)
}

// GET /api/v1/workspaces/:slug/blueprint-runs/:id
func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")

	run, err := h.svc.Get(id)
	if err != nil {
		if errors.Is(err, ErrRunNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, err.Error())
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to get blueprint run")
		return
	}

	pkg.RespondOK(c, http.StatusOK, run)
}

func contextWorkspaceID(c *gin.Context) uuid.UUID {
	val, _ := c.Get("workspace_id")
	id, _ := val.(uuid.UUID)
	return id
}
