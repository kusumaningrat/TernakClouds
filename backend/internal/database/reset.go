package database

import (
	"github.com/kusumaningrat/ternakclouds/internal/accessrequest"
	"github.com/kusumaningrat/ternakclouds/internal/blueprint"
	"github.com/kusumaningrat/ternakclouds/internal/capability"
	"github.com/kusumaningrat/ternakclouds/internal/department"
	"github.com/kusumaningrat/ternakclouds/internal/environment"
	"github.com/kusumaningrat/ternakclouds/internal/platformapp"
	"github.com/kusumaningrat/ternakclouds/internal/registry"
	"github.com/kusumaningrat/ternakclouds/internal/repository"
	"github.com/kusumaningrat/ternakclouds/internal/role"
	"github.com/kusumaningrat/ternakclouds/internal/secret"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
	"github.com/kusumaningrat/ternakclouds/internal/user"
	"github.com/kusumaningrat/ternakclouds/internal/workspace"
	"gorm.io/gorm"
)

func ResetDatabase(db *gorm.DB) error {
	// Drop all tables in reverse-dependency order (children first).
	err := db.Migrator().DropTable(
		// Secret grants reference environments + workspaces
		&secret.SecretGrant{},
		// Provider configs reference capability bindings
		&capability.ProviderConfig{},
		&capability.CapabilityBinding{},
		// Environments reference workspaces
		&environment.Environment{},
		// Workspace members reference workspaces + users
		&workspace.WorkspaceMember{},
		&workspace.Workspace{},
		// Access requests reference users/workspaces/environments
		&accessrequest.AccessRequest{},
		// Registry bindings reference registry providers
		&registry.RegistryBinding{},
		&registry.RegistryProvider{},
		// Service catalog objects
		&servicecatalog.ServiceDeployment{},
		&servicecatalog.CatalogItem{},
		// Blueprints and platform apps
		&platformapp.DeploymentRecord{},
		&platformapp.PlatformApp{},
		&blueprint.Blueprint{},
		// Repository providers
		&repository.RepoProvider{},
		// User / auth tables
		&user.RefreshToken{},
		&role.UserRole{},
		&role.RolePermission{},
		&user.User{},
		// Catalogue tables (no FKs to the above)
		&capability.Provider{},
		&capability.Capability{},
		&role.Permission{},
		&role.Role{},
		&department.Department{},
	)
	if err != nil {
		return err
	}

	return Migrate(db)
}
