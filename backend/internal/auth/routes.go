package auth

import "github.com/gin-gonic/gin"

func RegisterRoutes(rg *gin.RouterGroup, h *AuthHandler) {
	g := rg.Group("/auth")
	{
		g.POST("/register", h.Register)
		g.POST("/login", h.Login)
		g.POST("/logout", h.Logout)
		g.POST("/refresh", h.RefreshToken)
	}
}

// RegisterProtectedRoutes registers routes that require a valid JWT.
func RegisterProtectedRoutes(rg *gin.RouterGroup, h *AuthHandler) {
	rg.GET("/auth/me", h.Me)
}
