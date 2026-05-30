package repository

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts workspace-level repository provider routes under /workspaces/:slug.
// resolveWS sets workspace_id in context; memberGuard enforces membership;
// ownerGuard restricts write operations to workspace owners.
func RegisterRoutes(rg *gin.RouterGroup, h *Handler, resolveWS, memberGuard, ownerGuard gin.HandlerFunc) {
	base := rg.Group("/workspaces/:slug", resolveWS, memberGuard)
	{
		base.GET("/repo-providers", h.ListProviders)
		base.GET("/repo-providers/:id", h.GetProvider)
		base.GET("/repo-providers/:id/repositories", h.ListRepositories)
		base.GET("/repo-providers/:id/branches", h.ListBranches) // ?repo=owner/name
		base.GET("/repo-providers/:id/capabilities", h.GetCapabilities)

		base.POST("/repo-providers", ownerGuard, h.CreateProvider)
		base.PUT("/repo-providers/:id", ownerGuard, h.UpdateProvider)
		base.DELETE("/repo-providers/:id", ownerGuard, h.DeleteProvider)
		base.POST("/repo-providers/:id/validate", ownerGuard, h.ValidateConnection)
		base.POST("/repo-providers/:id/commit", ownerGuard, h.CommitFiles)
		base.POST("/repo-providers/:id/pull-request", ownerGuard, h.CreatePullRequest)
	}
}
