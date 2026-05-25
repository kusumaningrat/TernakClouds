package nomad

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts Nomad endpoints onto rg.
// rg is expected to already carry workspace + environment middleware so
// that "environment_id" is available in the context.
func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	n := rg.Group("/nomad")
	n.GET("/nodes", h.ListNodes)
	n.GET("/namespaces", h.ListNamespaces)
	n.GET("/jobs", h.ListJobs)
	n.GET("/jobs/:jobID", h.GetJob)
	n.GET("/jobs/:jobID/allocations", h.ListAllocations)
	n.GET("/jobs/:jobID/evaluations", h.ListEvaluations)
	n.GET("/jobs/:jobID/deployments", h.ListDeployments)
	n.POST("/jobs/:jobID/stop", h.StopJob)
	n.POST("/jobs/:jobID/start", h.StartJob)
	n.GET("/allocations/:allocID", h.GetAllocation)
	n.GET("/allocations/:allocID/logs", h.StreamLogs)
}
