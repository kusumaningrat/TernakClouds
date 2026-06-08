package storage

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts the storage endpoints on the environment router group.
// readGuard, writeGuard, deleteGuard are permission middleware produced by
// middleware.RequirePermission for "storage:read", "storage:write", "storage:delete".
func RegisterRoutes(envGroup *gin.RouterGroup, h *Handler, readGuard, writeGuard, deleteGuard gin.HandlerFunc) {
	s := envGroup.Group("/storage")
	s.GET("/provider", readGuard, h.GetProvider)
	s.GET("/buckets", readGuard, h.ListBuckets)
	s.POST("/buckets", writeGuard, h.CreateBucket)
	s.DELETE("/buckets/:name", deleteGuard, h.DeleteBucket)
}
