package user

import "github.com/gin-gonic/gin"

// RegisterRoutes wires user management routes.
// adminGuard middlewares (e.g. RequirePermission(svc, "users:read")) should be passed in.
func RegisterRoutes(rg *gin.RouterGroup, h *Handler, adminGuard ...gin.HandlerFunc) {
	rg.PUT("/users/me/password", h.ChangePassword)
	rg.GET("/users", append(adminGuard, h.List)...)
	rg.POST("/users", append(adminGuard, h.Create)...)
}
