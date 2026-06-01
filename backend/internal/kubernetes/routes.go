package kubernetes

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts Kubernetes endpoints onto rg.
// rg is expected to already carry workspace + environment middleware so
// that "environment_id" is available in the context.
func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	k := rg.Group("/kubernetes")
	k.GET("/nodes", h.ListNodes)
	k.GET("/namespaces", h.ListNamespaces)
	k.GET("/pods", h.ListPods)
	k.GET("/deployments", h.ListDeployments)
	k.GET("/services", h.ListServices)
	k.GET("/deployments/:namespace/:name", h.GetDeployment)
	k.GET("/pods/:namespace/:name", h.GetPod)
	k.GET("/services/:namespace/:name", h.GetService)
	k.PATCH("/deployments/:namespace/:name/scale", h.ScaleDeployment)
	k.GET("/pods/:namespace/:name/logs", h.StreamPodLogs)
}
