package role

import "github.com/gin-gonic/gin"

// RegisterRoutes wires role routes. assignGuard is applied to the assign and
// revoke endpoints; pass middleware.RequirePermission(roleSvc, "roles:assign").
func RegisterRoutes(rg *gin.RouterGroup, h *RoleHandler, assignGuard ...gin.HandlerFunc) {
	rg.GET("/roles", h.ListRoles)
	rg.GET("/roles/:id", h.GetRole)

	rg.GET("/users/:id/roles", h.ListUserRoles)
	rg.POST("/users/:id/roles", append(assignGuard, h.AssignRole)...)
	rg.DELETE("/users/:id/roles/:roleId", append(assignGuard, h.RevokeRole)...)

	rg.GET("/users/:id/permissions/:permission", h.CheckPermission)
}
