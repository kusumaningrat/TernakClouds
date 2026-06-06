package department

import "github.com/gin-gonic/gin"

func RegisterRoutes(rg *gin.RouterGroup, h *DepartmentHandler) {
	g := rg.Group("/departments")
	{
		g.POST("", h.Create)
		g.GET("", h.List)
		g.GET("/:id", h.GetByID)
		g.PUT("/:id", h.Update)
		g.DELETE("/:id", h.Delete)
	}
}
