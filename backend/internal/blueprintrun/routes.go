package blueprintrun

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts blueprint run endpoints under the workspace group.
// Trigger requires deployments:exec (passed as execMiddleware).
func RegisterRoutes(wsGroup *gin.RouterGroup, h *Handler, execMiddleware gin.HandlerFunc) {
	g := wsGroup.Group("/blueprint-runs")
	g.GET("", h.List)
	g.GET("/:id", h.Get)
	g.POST("", execMiddleware, h.Trigger)
}
