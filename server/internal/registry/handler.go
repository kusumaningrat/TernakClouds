package registry

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

// GET /workspaces/:slug/registries
func (h *Handler) ListProviders(c *gin.Context) {
	wsID := contextWorkspaceID(c)
	providers, err := h.svc.ListProviders(wsID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list registries")
		return
	}
	resp := make([]ProviderResponse, len(providers))
	for i, p := range providers {
		resp[i] = toProviderResponse(&p)
	}
	pkg.RespondOK(c, http.StatusOK, resp)
}

// POST /workspaces/:slug/registries
func (h *Handler) CreateProvider(c *gin.Context) {
	wsID := contextWorkspaceID(c)
	var input CreateProviderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	p, err := h.svc.CreateProvider(c.Request.Context(), wsID, input)
	if errors.Is(err, ErrInvalidProvider) {
		pkg.RespondErr(c, http.StatusBadRequest, "unsupported registry provider type")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to create registry: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusCreated, toProviderResponse(p))
}

// GET /workspaces/:slug/registries/:id
func (h *Handler) GetProvider(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid registry id")
		return
	}
	p, err := h.svc.GetProvider(id)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "registry not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to get registry")
		return
	}
	pkg.RespondOK(c, http.StatusOK, toProviderResponse(p))
}

// PUT /workspaces/:slug/registries/:id
func (h *Handler) UpdateProvider(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid registry id")
		return
	}
	var input UpdateProviderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	p, err := h.svc.UpdateProvider(c.Request.Context(), id, input)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "registry not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to update registry: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, toProviderResponse(p))
}

// DELETE /workspaces/:slug/registries/:id
func (h *Handler) DeleteProvider(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid registry id")
		return
	}
	if err := h.svc.DeleteProvider(c.Request.Context(), id); err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "registry not found")
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to delete registry")
		return
	}
	pkg.RespondMessage(c, http.StatusOK, "registry deleted")
}

// POST /workspaces/:slug/registries/:id/validate
func (h *Handler) ValidateConnection(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid registry id")
		return
	}
	if err := h.svc.ValidateConnection(c.Request.Context(), id); err != nil {
		pkg.RespondErr(c, http.StatusBadGateway, "registry connection failed: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, gin.H{"status": "ok"})
}

// GET /workspaces/:slug/registries/:id/repositories
func (h *Handler) ListRepositories(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid registry id")
		return
	}
	repos, err := h.svc.ListRepositories(c.Request.Context(), id)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "registry not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusBadGateway, "failed to list repositories: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, repos)
}

// GET /workspaces/:slug/registries/:id/tags?repo=project/repo-name
func (h *Handler) ListTags(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid registry id")
		return
	}
	repoName := c.Query("repo")
	if repoName == "" {
		pkg.RespondErr(c, http.StatusBadRequest, "query parameter 'repo' is required")
		return
	}
	tags, err := h.svc.ListTags(c.Request.Context(), id, repoName)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "registry not found")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusBadGateway, "failed to list tags: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, tags)
}

// GET /workspaces/:slug/environments/:envSlug/registries
func (h *Handler) ListBindings(c *gin.Context) {
	envID := contextEnvironmentID(c)
	bindings, err := h.svc.ListBindings(envID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list registry bindings")
		return
	}
	resp := make([]BindingResponse, len(bindings))
	for i, b := range bindings {
		resp[i] = toBindingResponse(&b)
	}
	pkg.RespondOK(c, http.StatusOK, resp)
}

// POST /workspaces/:slug/environments/:envSlug/registries
func (h *Handler) CreateBinding(c *gin.Context) {
	envID := contextEnvironmentID(c)
	var input CreateBindingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	b, err := h.svc.CreateBinding(c.Request.Context(), envID, input)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "registry not found")
		return
	}
	if errors.Is(err, ErrBindingExists) {
		pkg.RespondErr(c, http.StatusConflict, "registry already bound to this environment")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to create binding: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusCreated, gin.H{
		"id":             b.ID.String(),
		"environment_id": b.EnvironmentID.String(),
		"registry_id":    b.RegistryID.String(),
		"allowed_paths":  b.AllowedPaths,
		"created_at":     b.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	})
}

// DELETE /workspaces/:slug/environments/:envSlug/registries/:bindingId
func (h *Handler) DeleteBinding(c *gin.Context) {
	id, err := uuid.Parse(c.Param("bindingId"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid binding id")
		return
	}
	if err := h.svc.DeleteBinding(id); err != nil {
		if errors.Is(err, ErrBindingNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "binding not found")
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to delete binding")
		return
	}
	pkg.RespondMessage(c, http.StatusOK, "binding removed")
}

// GET /workspaces/:slug/environments/:envSlug/registries/:id/repositories
func (h *Handler) ListBoundRepositories(c *gin.Context) {
	envID := contextEnvironmentID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid registry id")
		return
	}
	repos, err := h.svc.ListBoundRepositories(c.Request.Context(), envID, id)
	if errors.Is(err, ErrBindingNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "registry not bound to this environment")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusBadGateway, "failed to list repositories: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, repos)
}

// GET /workspaces/:slug/environments/:envSlug/registries/:id/tags?repo=project/repo-name
func (h *Handler) ListBoundTags(c *gin.Context) {
	envID := contextEnvironmentID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid registry id")
		return
	}
	repoName := c.Query("repo")
	if repoName == "" {
		pkg.RespondErr(c, http.StatusBadRequest, "query parameter 'repo' is required")
		return
	}
	tags, err := h.svc.ListBoundTags(c.Request.Context(), envID, id, repoName)
	if errors.Is(err, ErrBindingNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "registry not bound to this environment")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusBadGateway, "failed to list tags: "+err.Error())
		return
	}
	pkg.RespondOK(c, http.StatusOK, tags)
}

// --- context helpers ---

func contextWorkspaceID(c *gin.Context) uuid.UUID {
	val, _ := c.Get("workspace_id")
	id, _ := val.(uuid.UUID)
	return id
}

func contextEnvironmentID(c *gin.Context) uuid.UUID {
	val, _ := c.Get("environment_id")
	id, _ := val.(uuid.UUID)
	return id
}

// --- response helpers ---

func toProviderResponse(p *RegistryProvider) ProviderResponse {
	return ProviderResponse{
		ID:           p.ID.String(),
		WorkspaceID:  p.WorkspaceID.String(),
		Name:         p.Name,
		ProviderType: p.ProviderType,
		Endpoint:     p.Endpoint,
		Description:  p.Description,
		CreatedAt:    p.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

func toBindingResponse(b *BindingWithProvider) BindingResponse {
	return BindingResponse{
		ID:               b.ID.String(),
		EnvironmentID:    b.EnvironmentID.String(),
		RegistryID:       b.RegistryID.String(),
		RegistryName:     b.RegistryName,
		RegistryType:     b.RegistryType,
		RegistryEndpoint: b.RegistryEndpoint,
		AllowedPaths:     b.AllowedPaths,
		CreatedAt:        b.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

