package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/pkg"
	pkgjwt "github.com/kusumaningrat/ternakclouds/pkg/jwt"
)

const (
	CtxUserID       = "user_id"
	CtxEmail        = "email"
	CtxDepartmentID = "department_id"
)

// JWT validates the Bearer token and injects claims into the Gin context.
func JWT(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
			pkg.RespondErr(c, http.StatusUnauthorized, "Authentication required. Please sign in.")
			c.Abort()
			return
		}

		claims, err := pkgjwt.ParseAccessToken(authHeader[7:], secret)
		if err != nil {
			pkg.RespondErr(c, http.StatusUnauthorized, "invalid or expired token")
			c.Abort()
			return
		}

		c.Set(CtxUserID, claims.UserID)
		c.Set(CtxEmail, claims.Email)
		c.Set(CtxDepartmentID, claims.DepartmentID)
		c.Next()
	}
}

// GetUserID extracts the authenticated user's ID from the Gin context.
func GetUserID(c *gin.Context) uuid.UUID {
	id, _ := c.Get(CtxUserID)
	uid, _ := id.(uuid.UUID)
	return uid
}

// GetDepartmentID extracts the authenticated user's department ID from the Gin context.
func GetDepartmentID(c *gin.Context) uuid.UUID {
	id, _ := c.Get(CtxDepartmentID)
	uid, _ := id.(uuid.UUID)
	return uid
}
