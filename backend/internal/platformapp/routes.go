package platformapp

import "github.com/gin-gonic/gin"

// RegisterRoutes registers platform-app endpoints under the env group:
//
//	POST   .../platform-apps/preview
//	POST   .../platform-apps
//	GET    .../platform-apps
//	GET    .../platform-apps/:id
//	DELETE .../platform-apps/:id
func RegisterRoutes(envGroup *gin.RouterGroup, h *Handler, writeMiddleware ...gin.HandlerFunc) {
	g := envGroup.Group("/platform-apps")

	// Preview is read-like — no write permission required.
	g.POST("/preview", h.Preview)

	// List + Get are available to any workspace member.
	g.GET("", h.List)
	g.GET("/:id", h.Get)
	g.GET("/:id/deployments", h.ListDeployments)

	// Provision + Delete require write permission (e.g. deployments:exec).
	write := g.Group("")
	write.Use(writeMiddleware...)
	write.POST("", h.Provision)
	write.DELETE("/:id", h.Delete)
}
