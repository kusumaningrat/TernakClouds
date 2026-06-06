package secret

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts secret endpoints onto rg.
// rg already carries workspace + environment middleware.
// All workspace members can CRUD; vault_path is visible only to owners (handled in handler).
func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	s := rg.Group("/secrets")
	s.GET("", h.ListGrants)
	s.POST("", h.CreateGrant)
	s.PUT("/:id", h.UpdateGrant)
	s.DELETE("/:id", h.DeleteGrant)
	s.GET("/:id/value", h.GetValue)
	s.PUT("/:id/value", h.WriteValue)
}
