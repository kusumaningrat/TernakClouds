package accessrequest

import "github.com/gin-gonic/gin"

// RegisterRoutes wires access request routes.
// adminGuard is applied to list-pending and approve/deny endpoints (workspaces:write).
func RegisterRoutes(rg *gin.RouterGroup, h *Handler, adminGuard ...gin.HandlerFunc) {
	ar := rg.Group("/access-requests")
	{
		ar.POST("", h.Create)
		ar.GET("/mine", h.ListMine)
		ar.GET("", append(adminGuard, h.ListPending)...)
		ar.PUT("/:id/approve", append(adminGuard, h.Approve)...)
		ar.PUT("/:id/deny", append(adminGuard, h.Deny)...)
	}
}
