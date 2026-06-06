package workspace

import "github.com/gin-gonic/gin"

// RegisterRoutes wires workspace routes.
// ownerGuard is applied to mutating endpoints; pass middleware.RequireWorkspaceOwner(svc).
func RegisterRoutes(rg *gin.RouterGroup, h *Handler, ownerGuard ...gin.HandlerFunc) {
	rg.POST("/workspaces", h.Create)
	rg.GET("/workspaces", h.List)
	rg.GET("/workspaces/mine", h.Mine)            // must be before /:slug
	rg.GET("/workspaces/directory", h.Directory)  // must be before /:slug
	rg.GET("/workspaces/:slug", h.Get)
	rg.PUT("/workspaces/:slug", append(ownerGuard, h.Update)...)
	rg.DELETE("/workspaces/:slug", append(ownerGuard, h.Delete)...)
	rg.GET("/workspaces/:slug/members", h.ListMembers)
	rg.POST("/workspaces/:slug/members", append(ownerGuard, h.AddMember)...)
	rg.DELETE("/workspaces/:slug/members/:userId", append(ownerGuard, h.RemoveMember)...)
}
