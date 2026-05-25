package environment

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/pkg"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// POST /api/v1/workspaces/:slug/environments
func (h *Handler) Create(c *gin.Context) {
	wsID, ok := workspaceIDFromCtx(c)
	if !ok {
		return
	}

	var input CreateEnvironmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	env, err := h.svc.Create(wsID, input)
	if errors.Is(err, ErrSlugTaken) {
		pkg.RespondErr(c, http.StatusConflict, "environment slug already taken in this workspace")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to create environment")
		return
	}

	pkg.RespondOK(c, http.StatusCreated, toResponse(env))
}

// GET /api/v1/workspaces/:slug/environments
func (h *Handler) List(c *gin.Context) {
	wsID, ok := workspaceIDFromCtx(c)
	if !ok {
		return
	}

	envs, err := h.svc.List(wsID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list environments")
		return
	}

	resp := make([]EnvironmentResponse, len(envs))
	for i, e := range envs {
		resp[i] = toResponse(&e)
	}
	pkg.RespondOK(c, http.StatusOK, resp)
}

// GET /api/v1/workspaces/:slug/environments/:envSlug
func (h *Handler) Get(c *gin.Context) {
	wsID, ok := workspaceIDFromCtx(c)
	if !ok {
		return
	}

	env, err := h.svc.Get(wsID, c.Param("envSlug"))
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "environment not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to get environment")
		return
	}

	pkg.RespondOK(c, http.StatusOK, toResponse(env))
}

// PUT /api/v1/workspaces/:slug/environments/:envSlug
func (h *Handler) Update(c *gin.Context) {
	wsID, ok := workspaceIDFromCtx(c)
	if !ok {
		return
	}

	var input UpdateEnvironmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	env, err := h.svc.Update(wsID, c.Param("envSlug"), input)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "environment not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to update environment")
		return
	}

	pkg.RespondOK(c, http.StatusOK, toResponse(env))
}

// DELETE /api/v1/workspaces/:slug/environments/:envSlug
func (h *Handler) Delete(c *gin.Context) {
	wsID, ok := workspaceIDFromCtx(c)
	if !ok {
		return
	}

	if err := h.svc.Delete(wsID, c.Param("envSlug")); err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "environment not found")
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to delete environment")
		return
	}

	pkg.RespondMessage(c, http.StatusOK, "environment deleted")
}

// workspaceIDFromCtx reads the workspace UUID set by workspace middleware.
func workspaceIDFromCtx(c *gin.Context) (uuid.UUID, bool) {
	val, exists := c.Get("workspace_id")
	if !exists {
		pkg.RespondErr(c, http.StatusInternalServerError, "workspace context missing")
		c.Abort()
		return uuid.Nil, false
	}
	id, ok := val.(uuid.UUID)
	if !ok {
		pkg.RespondErr(c, http.StatusInternalServerError, "workspace context invalid")
		c.Abort()
		return uuid.Nil, false
	}
	return id, true
}

func toResponse(e *Environment) EnvironmentResponse {
	return EnvironmentResponse{
		ID:          e.ID.String(),
		WorkspaceID: e.WorkspaceID.String(),
		Name:        e.Name,
		Slug:        e.Slug,
		Description: e.Description,
		Order:       e.Order,
		CreatedAt:   e.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}
