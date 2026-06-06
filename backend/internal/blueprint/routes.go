package blueprint

import "github.com/gin-gonic/gin"

func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	g := rg.Group("/blueprints")
	g.GET("", h.List)
	g.GET("/:name", h.Get)
	g.DELETE("/:name", h.Delete)
}
