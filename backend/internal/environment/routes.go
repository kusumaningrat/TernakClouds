package environment

import "github.com/gin-gonic/gin"

// RegisterRoutes wires environment routes under /workspaces/:slug/environments.
// wsMiddleware resolves the workspace and sets workspace_id in context.
// writeGuard is applied to mutating endpoints; pass middleware.RequireWorkspaceOwner(svc).
func RegisterRoutes(rg *gin.RouterGroup, h *Handler, wsMiddleware gin.HandlerFunc, writeGuard ...gin.HandlerFunc) {
	envs := rg.Group("/workspaces/:slug/environments", wsMiddleware)
	{
		envs.GET("", h.List)
		envs.GET("/:envSlug", h.Get)
		envs.POST("", append(writeGuard, h.Create)...)
		envs.PUT("/:envSlug", append(writeGuard, h.Update)...)
		envs.DELETE("/:envSlug", append(writeGuard, h.Delete)...)
	}
}
