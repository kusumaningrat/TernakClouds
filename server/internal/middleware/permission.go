package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/pkg"
)

// PermissionChecker is satisfied by role.RoleService without creating an import cycle.
type PermissionChecker interface {
	HasPermission(userID uuid.UUID, permission string) (bool, error)
}

// RequirePermission denies the request with 403 if the authenticated user does
// not hold the given permission. Must run after the JWT middleware.
func RequirePermission(checker PermissionChecker, permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := GetUserID(c)

		ok, err := checker.HasPermission(userID, permission)
		if err != nil {
			pkg.RespondErr(c, http.StatusInternalServerError, "Something went wrong. Please try again.")
			c.Abort()
			return
		}
		if !ok {
			pkg.RespondErr(c, http.StatusForbidden, "You don't have permission to perform this action.")
			c.Abort()
			return
		}

		c.Next()
	}
}
