package registry

import "github.com/gin-gonic/gin"

// RegisterWorkspaceRoutes mounts workspace-level registry routes under /workspaces/:slug.
// resolveWS sets workspace_id in context; memberGuard enforces membership;
// ownerGuard restricts write operations to workspace owners.
func RegisterWorkspaceRoutes(rg *gin.RouterGroup, h *Handler, resolveWS, memberGuard, ownerGuard gin.HandlerFunc) {
	base := rg.Group("/workspaces/:slug", resolveWS, memberGuard)
	{
		base.GET("/registries", h.ListProviders)
		base.GET("/registries/:id", h.GetProvider)
		base.GET("/registries/:id/repositories", h.ListRepositories)
		base.GET("/registries/:id/tags", h.ListTags) // ?repo=project/repo-name

		base.POST("/registries", ownerGuard, h.CreateProvider)
		base.PUT("/registries/:id", ownerGuard, h.UpdateProvider)
		base.DELETE("/registries/:id", ownerGuard, h.DeleteProvider)
		base.POST("/registries/:id/validate", ownerGuard, h.ValidateConnection)
	}
}

// RegisterEnvironmentRoutes mounts environment-level registry routes on an existing envGroup
// (which already has ResolveWorkspace, RequireWorkspaceMember, ResolveEnvironment applied).
// ownerGuard restricts binding mutations to workspace owners.
func RegisterEnvironmentRoutes(envGroup *gin.RouterGroup, h *Handler, ownerGuard gin.HandlerFunc) {
	envGroup.GET("/registries", h.ListBindings)
	envGroup.GET("/registries/:id/repositories", h.ListBoundRepositories)
	envGroup.GET("/registries/:id/tags", h.ListBoundTags) // ?repo=project/repo-name

	envGroup.POST("/registries", ownerGuard, h.CreateBinding)
	envGroup.DELETE("/registries/:bindingId", ownerGuard, h.DeleteBinding)
}
