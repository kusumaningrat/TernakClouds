package docker

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts Docker endpoints onto rg.
// rg is expected to already carry workspace + environment middleware so
// that "environment_id" is available in the context.
func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	d := rg.Group("/docker")
	d.GET("/containers", h.ListContainers)
	d.GET("/containers/:id", h.GetContainer)
	d.POST("/containers/:id/start", h.StartContainer)
	d.POST("/containers/:id/stop", h.StopContainer)
	d.POST("/containers/:id/restart", h.RestartContainer)
	d.DELETE("/containers/:id", h.RemoveContainer)
	d.GET("/containers/:id/logs", h.StreamContainerLogs)
	d.GET("/images", h.ListImages)
	d.GET("/networks", h.ListNetworks)
	d.GET("/volumes", h.ListVolumes)
}
