package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/pkg"
)

// WorkspaceRef holds the minimal workspace fields needed by the middleware.
type WorkspaceRef struct {
	ID      uuid.UUID
	OwnerID uuid.UUID
}

// WorkspaceAccessChecker is satisfied by workspace.Service without creating an import cycle.
type WorkspaceAccessChecker interface {
	FindBySlug(slug string) (*WorkspaceRef, error)
	IsMember(userID, workspaceID uuid.UUID) (bool, error)
	IsOwner(userID, workspaceID uuid.UUID) (bool, error)
	// HasWorkspaceAccess returns true for workspace members AND platform admins.
	HasWorkspaceAccess(userID, workspaceID uuid.UUID) (bool, error)
}

// ResolveWorkspace resolves :slug to a workspace and sets "workspace_id" in context.
// Must run after JWT middleware.
func ResolveWorkspace(checker WorkspaceAccessChecker) gin.HandlerFunc {
	return func(c *gin.Context) {
		slug := c.Param("slug")
		ws, err := checker.FindBySlug(slug)
		if err != nil {
			pkg.RespondErr(c, http.StatusNotFound, "workspace not found")
			c.Abort()
			return
		}
		c.Set("workspace_id", ws.ID)
		c.Set("workspace_owner_id", ws.OwnerID)
		c.Next()
	}
}

// RequireWorkspaceMember denies access unless the caller is a member of the workspace
// or a platform admin. Must run after ResolveWorkspace.
func RequireWorkspaceMember(checker WorkspaceAccessChecker) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := GetUserID(c)
		wsID := getWorkspaceID(c)

		ok, err := checker.HasWorkspaceAccess(userID, wsID)
		if err != nil {
			pkg.RespondErr(c, http.StatusInternalServerError, "Something went wrong. Please try again.")
			c.Abort()
			return
		}
		if !ok {
			pkg.RespondErr(c, http.StatusForbidden, "you are not a member of this workspace")
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequireWorkspaceOwner denies access unless the caller is the workspace owner.
// Must run after ResolveWorkspace.
func RequireWorkspaceOwner(checker WorkspaceAccessChecker) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := GetUserID(c)
		wsID := getWorkspaceID(c)

		ok, err := checker.IsOwner(userID, wsID)
		if err != nil {
			pkg.RespondErr(c, http.StatusInternalServerError, "Something went wrong. Please try again.")
			c.Abort()
			return
		}
		if !ok {
			pkg.RespondErr(c, http.StatusForbidden, "only the workspace owner can perform this action")
			c.Abort()
			return
		}
		c.Next()
	}
}

func getWorkspaceID(c *gin.Context) uuid.UUID {
	val, _ := c.Get("workspace_id")
	id, _ := val.(uuid.UUID)
	return id
}
