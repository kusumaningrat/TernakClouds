package capability

import "github.com/gin-gonic/gin"

// RegisterRoutes wires capability routes under the environment sub-group.
// ownerGuard is applied to mutating endpoints (bind/update/unbind).
func RegisterRoutes(rg *gin.RouterGroup, h *Handler, ownerGuard ...gin.HandlerFunc) {
	caps := rg.Group("/capabilities")
	{
		caps.GET("", h.List)
		caps.GET("/:cap", h.Get)
		caps.GET("/:cap/providers", h.ListProviders)
		caps.POST("/:cap/provider", append(ownerGuard, h.BindProvider)...)
		caps.POST("/:cap/provider/:providerID/verify", h.VerifyProvider)
		caps.PUT("/:cap/provider/:providerID", append(ownerGuard, h.UpdateProvider)...)
		caps.DELETE("/:cap/provider/:providerID", append(ownerGuard, h.UnbindProvider)...)
	}
}
