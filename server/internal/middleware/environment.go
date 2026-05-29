package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/pkg"
)

// EnvironmentResolver resolves an environment slug within a workspace to its UUID.
type EnvironmentResolver interface {
	FindBySlugAndWorkspace(workspaceID uuid.UUID, slug string) (uuid.UUID, error)
}

// ResolveEnvironment resolves :envSlug to an environment and sets "environment_id" in context.
// Must run after ResolveWorkspace.
func ResolveEnvironment(resolver EnvironmentResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		wsID := getWorkspaceID(c)
		envSlug := c.Param("envSlug")

		envID, err := resolver.FindBySlugAndWorkspace(wsID, envSlug)
		if err != nil {
			pkg.RespondErr(c, http.StatusNotFound, "environment not found")
			c.Abort()
			return
		}
		c.Set("environment_id", envID)
		c.Next()
	}
}
