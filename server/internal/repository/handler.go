package repository

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/pkg"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GET /workspaces/:slug/repo-providers
func (h *Handler) ListProviders(c *gin.Context) {
	wsID := contextWorkspaceID(c)
	providers, err := h.svc.ListProviders(wsID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list repository providers")
		return
	}
	resp := make([]ProviderResponse, len(providers))
	for i, p := range providers {
		resp[i] = toProviderResponse(&p)
	}
	pkg.RespondOK(c, http.StatusOK, resp)
}

// POST /workspaces/:slug/repo-providers
func (h *Handler) CreateProvider(c *gin.Context) {
	wsID := contextWorkspaceID(c)
	var input CreateProviderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	p, err := h.svc.CreateProvider(c.Request.Context(), wsID, input)
	if errors.Is(err, ErrInvalidProvider) {
		pkg.RespondErr(c, http.StatusBadRequest, "unsupported repository provider type")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to create repository provider: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusCreated, toProviderResponse(p))
}

// GET /workspaces/:slug/repo-providers/:id
func (h *Handler) GetProvider(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid provider id")
		return
	}
	p, err := h.svc.GetProvider(id)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "repository provider not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to get repository provider")
		return
	}
	pkg.RespondOK(c, http.StatusOK, toProviderResponse(p))
}

// PUT /workspaces/:slug/repo-providers/:id
func (h *Handler) UpdateProvider(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid provider id")
		return
	}
	var input UpdateProviderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	p, err := h.svc.UpdateProvider(c.Request.Context(), id, input)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "repository provider not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to update repository provider: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, toProviderResponse(p))
}

// DELETE /workspaces/:slug/repo-providers/:id
func (h *Handler) DeleteProvider(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid provider id")
		return
	}
	if err := h.svc.DeleteProvider(c.Request.Context(), id); err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "repository provider not found")
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to delete repository provider")
		return
	}
	pkg.RespondMessage(c, http.StatusOK, "repository provider deleted")
}

// POST /workspaces/:slug/repo-providers/:id/validate
func (h *Handler) ValidateConnection(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid provider id")
		return
	}
	if err := h.svc.ValidateConnection(c.Request.Context(), id); err != nil {
		pkg.RespondErr(c, http.StatusBadGateway, "repository connection failed: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, gin.H{"status": "ok"})
}

// GET /workspaces/:slug/repo-providers/:id/repositories
func (h *Handler) ListRepositories(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid provider id")
		return
	}
	repos, err := h.svc.ListRepositories(c.Request.Context(), id)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "repository provider not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusBadGateway, "failed to list repositories: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, repos)
}

// GET /workspaces/:slug/repo-providers/:id/branches?repo=owner/name
func (h *Handler) ListBranches(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid provider id")
		return
	}
	fullName := c.Query("repo")
	if fullName == "" {
		pkg.RespondErr(c, http.StatusBadRequest, "query parameter 'repo' is required")
		return
	}
	branches, err := h.svc.ListBranches(c.Request.Context(), id, fullName)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "repository provider not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusBadGateway, "failed to list branches: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, branches)
}

// POST /workspaces/:slug/repo-providers/:id/commit
func (h *Handler) CommitFiles(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid provider id")
		return
	}
	var input CommitFilesInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	result, err := h.svc.CommitFiles(c.Request.Context(), id, input)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "repository provider not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusBadGateway, "failed to commit files: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, result)
}

// POST /workspaces/:slug/repo-providers/:id/pull-request
func (h *Handler) CreatePullRequest(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid provider id")
		return
	}
	var input PullRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	result, err := h.svc.CreatePullRequest(c.Request.Context(), id, input)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "repository provider not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusBadGateway, "failed to create pull request: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, result)
}

// GET /workspaces/:slug/repo-providers/:id/capabilities
func (h *Handler) GetCapabilities(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid provider id")
		return
	}
	caps, err := h.svc.Capabilities(c.Request.Context(), id)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "repository provider not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to get capabilities")
		return
	}
	pkg.RespondOK(c, http.StatusOK, caps)
}

// ── context + response helpers ────────────────────────────────────────────────

func contextWorkspaceID(c *gin.Context) uuid.UUID {
	val, _ := c.Get("workspace_id")
	id, _ := val.(uuid.UUID)
	return id
}

func toProviderResponse(p *RepoProvider) ProviderResponse {
	return ProviderResponse{
		ID:           p.ID.String(),
		WorkspaceID:  p.WorkspaceID.String(),
		Name:         p.Name,
		ProviderType: p.ProviderType,
		BaseURL:      p.BaseURL,
		Description:  p.Description,
		AllowedRepos: p.AllowedRepos,
		CreatedAt:    p.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}
