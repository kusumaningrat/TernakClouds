package servicecatalog

import "github.com/gin-gonic/gin"

// RegisterCatalogRoutes mounts the read-only service catalog listing.
// No workspace or environment context is needed — any authenticated user can browse.
func RegisterCatalogRoutes(rg *gin.RouterGroup, h *Handler) {
	rg.GET("/service-catalog", h.ListCatalog)
}

// RegisterDeploymentRoutes mounts deployment routes under the environment sub-group.
// rg is expected to already carry workspace + environment middleware.
// deployGuard restricts deploy and delete to callers with deployments:exec permission.
func RegisterDeploymentRoutes(rg *gin.RouterGroup, h *Handler, deployGuard ...gin.HandlerFunc) {
	d := rg.Group("/service-deployments")
	d.GET("", h.ListDeployments)
	d.GET("/:id", h.GetDeployment)
	d.POST("", append(deployGuard, h.Deploy)...)
	d.DELETE("/:id", append(deployGuard, h.StopAndDelete)...)
}
