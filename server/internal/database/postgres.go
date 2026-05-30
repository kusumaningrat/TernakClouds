package database

import (
	"log"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/accessrequest"
	"github.com/kusumaningrat/ternakclouds/internal/blueprint"
	"github.com/kusumaningrat/ternakclouds/internal/capability"
	"github.com/kusumaningrat/ternakclouds/internal/config"
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
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(dataSource string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(dataSource), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(10)

	return db, nil
}

func Migrate(db *gorm.DB) error {
	// Drop the old 1:1 unique index on capability_binding_id so the schema can
	// transition to a 1:many model (unique per (capability_binding_id, provider_name)).
	db.Exec("DROP INDEX IF EXISTS uni_provider_configs_capability_binding_id")
	// Add display_name with a default so existing rows don't violate NOT NULL.
	db.Exec("ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS display_name VARCHAR NOT NULL DEFAULT ''")

	return db.AutoMigrate(
		&department.Department{},
		&user.User{},
		&role.Role{},
		&role.UserRole{},
		&role.Permission{},
		&role.RolePermission{},
		&user.RefreshToken{},
		&workspace.Workspace{},
		&workspace.WorkspaceMember{},
		&environment.Environment{},
		&capability.Capability{},
		&capability.Provider{},
		&capability.CapabilityBinding{},
		&capability.ProviderConfig{},
		&secret.SecretGrant{},
		&accessrequest.AccessRequest{},
		&registry.RegistryProvider{},
		&registry.RegistryBinding{},
		&servicecatalog.CatalogItem{},
		&servicecatalog.ServiceDeployment{},
		&blueprint.Blueprint{},
		&platformapp.PlatformApp{},
		&platformapp.DeploymentRecord{},
		&repository.RepoProvider{},
	)
}

// Seed creates default permissions, roles, the bootstrap admin user, and the
// capability + provider catalogue.
func Seed(db *gorm.DB, cfg *config.Config) error {
	if err := seedPermissionsAndRoles(db); err != nil {
		return err
	}
	if err := seedAdminUser(db, cfg.Admin); err != nil {
		return err
	}
	if err := seedCapabilityCatalogue(db); err != nil {
		return err
	}
	if err := seedServiceCatalog(db); err != nil {
		return err
	}
	if err := seedBlueprints(db); err != nil {
		return err
	}
	if err := seedDefaultWorkspace(db, cfg.Admin.Email); err != nil {
		return err
	}
	log.Println("database seeded successfully")
	return nil
}

func seedDefaultWorkspace(db *gorm.DB, adminEmail string) error {
	var adminUser user.User
	if err := db.Where("email = ?", adminEmail).First(&adminUser).Error; err != nil {
		return err
	}

	ws := workspace.Workspace{
		Name:        "Platform",
		Slug:        "platform",
		Description: "Default platform workspace",
		OwnerID:     adminUser.ID,
	}
	if err := db.Where("slug = ?", ws.Slug).FirstOrCreate(&ws).Error; err != nil {
		return err
	}

	member := workspace.WorkspaceMember{
		WorkspaceID: ws.ID,
		UserID:      adminUser.ID,
		Role:        workspace.MemberRoleOwner,
	}
	if err := db.Where("workspace_id = ? AND user_id = ?", member.WorkspaceID, member.UserID).
		FirstOrCreate(&member).Error; err != nil {
		return err
	}

	defaults := []struct {
		name  string
		slug  string
		order int
	}{
		{"dev", "dev", 1},
		{"staging", "staging", 2},
		{"production", "production", 3},
	}
	for _, d := range defaults {
		env := environment.Environment{
			WorkspaceID: ws.ID,
			Name:        d.name,
			Slug:        d.slug,
			Order:       d.order,
		}
		_ = db.Where("workspace_id = ? AND slug = ?", ws.ID, d.slug).FirstOrCreate(&env).Error
	}

	return nil
}

func seedPermissionsAndRoles(db *gorm.DB) error {
	permissions := []role.Permission{
		// Users
		{Name: "users:read", Resource: "users", Action: "read", Description: "Read user data"},
		{Name: "users:write", Resource: "users", Action: "write", Description: "Create/update users"},
		{Name: "users:delete", Resource: "users", Action: "delete", Description: "Delete users"},
		// Departments
		{Name: "departments:read", Resource: "departments", Action: "read"},
		{Name: "departments:write", Resource: "departments", Action: "write"},
		{Name: "departments:delete", Resource: "departments", Action: "delete"},
		// Roles
		{Name: "roles:read", Resource: "roles", Action: "read"},
		{Name: "roles:write", Resource: "roles", Action: "write"},
		{Name: "roles:assign", Resource: "roles", Action: "assign", Description: "Assign roles to users"},
		// Deployments (IDP-specific)
		{Name: "deployments:read", Resource: "deployments", Action: "read"},
		{Name: "deployments:write", Resource: "deployments", Action: "write"},
		{Name: "deployments:exec", Resource: "deployments", Action: "exec", Description: "Execute deployments"},
		// Workspaces
		{Name: "workspaces:read", Resource: "workspaces", Action: "read"},
		{Name: "workspaces:write", Resource: "workspaces", Action: "write"},
		{Name: "workspaces:delete", Resource: "workspaces", Action: "delete"},
		// Environments
		{Name: "environments:read", Resource: "environments", Action: "read"},
		{Name: "environments:write", Resource: "environments", Action: "write"},
		{Name: "environments:delete", Resource: "environments", Action: "delete"},
		// Integrations
		{Name: "integrations:read", Resource: "integrations", Action: "read"},
		{Name: "integrations:write", Resource: "integrations", Action: "write"},
		{Name: "integrations:delete", Resource: "integrations", Action: "delete"},
	}

	for _, p := range permissions {
		if err := db.Where("name = ?", p.Name).FirstOrCreate(&p).Error; err != nil {
			return err
		}
	}

	permMap := map[string]*role.Permission{}
	var dbPerms []role.Permission
	if err := db.Find(&dbPerms).Error; err != nil {
		return err
	}
	for i := range dbPerms {
		permMap[dbPerms[i].Name] = &dbPerms[i]
	}

	roleDefs := []struct {
		name        string
		description string
		perms       []string
	}{
		{
			name:        role.Admin,
			description: "Full access to all resources",
			perms: []string{
				"users:read", "users:write", "users:delete",
				"departments:read", "departments:write", "departments:delete",
				"roles:read", "roles:write", "roles:assign",
				"deployments:read", "deployments:write", "deployments:exec",
				"workspaces:read", "workspaces:write", "workspaces:delete",
				"environments:read", "environments:write", "environments:delete",
				"integrations:read", "integrations:write", "integrations:delete",
			},
		},
		{
			name:        role.Manager,
			description: "Manage team members and deployments",
			perms: []string{
				"users:read", "users:write",
				"departments:read",
				"roles:read", "roles:assign",
				"deployments:read", "deployments:write", "deployments:exec",
				"workspaces:read", "workspaces:write",
				"environments:read", "environments:write", "environments:delete",
				"integrations:read", "integrations:write",
			},
		},
		{
			name:        role.Developer,
			description: "Read and trigger deployments",
			perms: []string{
				"users:read",
				"departments:read",
				"roles:read",
				"deployments:read", "deployments:write", "deployments:exec",
				"workspaces:read",
				"environments:read",
				"integrations:read", "integrations:write", "integrations:delete",
			},
		},
		{
			name:        role.Viewer,
			description: "Read-only access",
			perms: []string{
				"users:read",
				"departments:read",
				"roles:read",
				"deployments:read",
				"workspaces:read",
				"environments:read",
				"integrations:read",
			},
		},
	}

	for _, rd := range roleDefs {
		r := role.Role{Name: rd.name, Description: rd.description}
		if err := db.Where("name = ?", r.Name).FirstOrCreate(&r).Error; err != nil {
			return err
		}
		for _, permName := range rd.perms {
			p, ok := permMap[permName]
			if !ok {
				log.Printf("warning: permission %q not found during seeding", permName)
				continue
			}
			rp := role.RolePermission{RoleID: r.ID, PermissionID: p.ID}
			if err := db.Where("role_id = ? AND permission_id = ?", rp.RoleID, rp.PermissionID).
				FirstOrCreate(&rp).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

func seedAdminUser(db *gorm.DB, cfg config.AdminConfig) error {
	// Ensure a "Platform" department exists for the admin
	dept := department.Department{Name: "Platform", Slug: "platform"}
	if err := db.Where("slug = ?", dept.Slug).FirstOrCreate(&dept).Error; err != nil {
		return err
	}

	// Find or create the admin user
	var adminUser user.User
	result := db.Where("email = ?", cfg.Email).First(&adminUser)
	if result.Error == nil {
		return nil // admin already exists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(cfg.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	adminUser = user.User{
		Email:        cfg.Email,
		PasswordHash: string(hash),
		FirstName:    "Platform",
		LastName:     "Admin",
		DepartmentID: dept.ID,
	}
	if err := db.Create(&adminUser).Error; err != nil {
		return err
	}

	// Assign admin role
	var adminRole role.Role
	if err := db.Where("name = ?", role.Admin).First(&adminRole).Error; err != nil {
		return err
	}

	ur := role.UserRole{UserID: adminUser.ID, RoleID: adminRole.ID}
	if err := db.Where("user_id = ? AND role_id = ?", ur.UserID, ur.RoleID).FirstOrCreate(&ur).Error; err != nil {
		return err
	}

	// log.Printf("admin user created: %s (change the default password via ADMIN_PASSWORD env)", cfg.Email)
	return nil
}

func seedCapabilityCatalogue(db *gorm.DB) error {
	caps := []capability.Capability{
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000000001"), Name: capability.CapRuntime, DisplayName: "Runtime", Description: "Workload scheduling and execution (Nomad, Kubernetes)"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000000002"), Name: capability.CapSecrets, DisplayName: "Secrets", Description: "Secret management and dynamic credentials (Vault)"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000000003"), Name: capability.CapNetworking, DisplayName: "Networking", Description: "Service mesh and networking (Consul, Istio)"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000000004"), Name: capability.CapObservability, DisplayName: "Observability", Description: "Metrics and traces (Prometheus, Grafana)"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000000005"), Name: capability.CapStorage, DisplayName: "Storage", Description: "Persistent storage (MinIO, Ceph)"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000000006"), Name: capability.CapLogs, DisplayName: "Logs", Description: "Centralized logs ingestion, storage, and search (Loki, OpenSearch, Elasticsearch)"},
	}
	for _, c := range caps {
		if err := db.Where("name = ?", c.Name).FirstOrCreate(&c).Error; err != nil {
			return err
		}
	}

	providers := []capability.Provider{
		// Runtime
		{ID: uuid.MustParse("00000001-0000-0000-0000-000000000001"), Name: "nomad", DisplayName: "HashiCorp Nomad", CapabilityName: capability.CapRuntime, Description: "Flexible workload orchestrator"},
		{ID: uuid.MustParse("00000001-0000-0000-0000-000000000002"), Name: "kubernetes", DisplayName: "Kubernetes", CapabilityName: capability.CapRuntime, Description: "Container orchestration platform"},
		{ID: uuid.MustParse("00000001-0000-0000-0000-000000000003"), Name: "docker", DisplayName: "Docker Engine", CapabilityName: capability.CapRuntime, Description: "Lightweight container runtime for VPS, edge, and local deployments"},
		// Secrets
		{ID: uuid.MustParse("00000002-0000-0000-0000-000000000001"), Name: "vault", DisplayName: "HashiCorp Vault", CapabilityName: capability.CapSecrets, Description: "Secrets management and encryption"},
		// Networking
		{ID: uuid.MustParse("00000003-0000-0000-0000-000000000001"), Name: "consul", DisplayName: "HashiCorp Consul", CapabilityName: capability.CapNetworking, Description: "Service mesh and service discovery"},
		// Observability
		{ID: uuid.MustParse("00000004-0000-0000-0000-000000000001"), Name: "prometheus", DisplayName: "Prometheus + Grafana", CapabilityName: capability.CapObservability, Description: "Metrics and dashboards"},
		// Storage
		{ID: uuid.MustParse("00000005-0000-0000-0000-000000000001"), Name: "minio", DisplayName: "MinIO", CapabilityName: capability.CapStorage, Description: "S3-compatible object storage"},
		// Logs
		{ID: uuid.MustParse("00000006-0000-0000-0000-000000000001"), Name: "loki", DisplayName: "Grafana Loki", CapabilityName: capability.CapLogs, Description: "Scalable label-based log aggregation"},
		{ID: uuid.MustParse("00000006-0000-0000-0000-000000000002"), Name: "opensearch", DisplayName: "OpenSearch", CapabilityName: capability.CapLogs, Description: "Distributed search and analytics for logs"},
		{ID: uuid.MustParse("00000006-0000-0000-0000-000000000003"), Name: "elasticsearch", DisplayName: "Elasticsearch", CapabilityName: capability.CapLogs, Description: "Search engine for full-text log indexing"},
	}
	for _, p := range providers {
		if err := db.Where("name = ?", p.Name).FirstOrCreate(&p).Error; err != nil {
			return err
		}
	}

	return nil
}

func seedServiceCatalog(db *gorm.DB) error {
	items := []servicecatalog.CatalogItem{
		{
			ID:                   uuid.MustParse("00000010-0000-0000-0000-000000000001"),
			Name:                 "redis",
			DisplayName:          "Redis",
			Description:          "In-memory data structure store (cache, message broker)",
			DefaultImage:         "redis:7-alpine",
			DefaultContainerPort: 6379,
			DefaultCPU:           100,
			DefaultMemory:        256,
			HealthCheckType:      "tcp",
			IsPublicImage:        true,
		},
		{
			ID:                   uuid.MustParse("00000010-0000-0000-0000-000000000002"),
			Name:                 "postgres",
			DisplayName:          "PostgreSQL",
			Description:          "Open source relational database",
			DefaultImage:         "postgres:16-alpine",
			DefaultContainerPort: 5432,
			DefaultCPU:           200,
			DefaultMemory:        512,
			HealthCheckType:      "tcp",
			IsPublicImage:        true,
		},
		{
			ID:                   uuid.MustParse("00000010-0000-0000-0000-000000000003"),
			Name:                 "nginx",
			DisplayName:          "Nginx",
			Description:          "High-performance web server and reverse proxy",
			DefaultImage:         "nginx:alpine",
			DefaultContainerPort: 80,
			DefaultCPU:           100,
			DefaultMemory:        128,
			HealthCheckType:      "http",
			HealthCheckPath:      "/",
			IsPublicImage:        true,
		},
		{
			ID:                   uuid.MustParse("00000010-0000-0000-0000-000000000004"),
			Name:                 "minio",
			DisplayName:          "MinIO",
			Description:          "S3-compatible object storage",
			DefaultImage:         "minio/minio:latest",
			DefaultContainerPort: 9000,
			DefaultCPU:           200,
			DefaultMemory:        512,
			HealthCheckType:      "http",
			HealthCheckPath:      "/minio/health/live",
			IsPublicImage:        true,
		},
		{
			ID:                   uuid.MustParse("00000010-0000-0000-0000-000000000005"),
			Name:                 "app",
			DisplayName:          "Custom Application",
			Description:          "Deploy a custom application image from a registered registry",
			DefaultImage:         "",
			DefaultContainerPort: 8080,
			DefaultCPU:           256,
			DefaultMemory:        512,
			HealthCheckType:      "http",
			HealthCheckPath:      "/health",
			IsPublicImage:        false,
		},
	}
	for _, item := range items {
		if err := db.Where("name = ?", item.Name).FirstOrCreate(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func seedBlueprints(db *gorm.DB) error {
	items := []blueprint.Blueprint{
		{
			Name:              "web-api",
			DisplayName:       "Web API",
			Description:       "HTTP REST or GraphQL API service. Includes health checks, rolling deployments, and optional Vault secret injection.",
			Category:          "application",
			Version:           "v1",
			SupportedRuntimes: "nomad,kubernetes",
			IsPublic:          true,
			IsSystem:          true,
			Icon:              "globe",
		},
		{
			Name:              "worker",
			DisplayName:       "Background Worker",
			Description:       "Long-running background processor. No HTTP port exposed; suitable for queue consumers and async jobs.",
			Category:          "application",
			Version:           "v1",
			SupportedRuntimes: "nomad,kubernetes",
			IsPublic:          true,
			IsSystem:          true,
			Icon:              "cpu",
		},
		{
			Name:              "cron-job",
			DisplayName:       "Cron Job",
			Description:       "Scheduled batch task that runs on a cron schedule. Mapped to Nomad batch jobs or Kubernetes CronJobs.",
			Category:          "application",
			Version:           "v1",
			SupportedRuntimes: "nomad,kubernetes",
			IsPublic:          true,
			IsSystem:          true,
			Icon:              "clock",
		},
		{
			Name:              "internal-service",
			DisplayName:       "Internal Service",
			Description:       "Service exposed only within the cluster network. Suitable for gRPC microservices and internal APIs.",
			Category:          "application",
			Version:           "v1",
			SupportedRuntimes: "nomad,kubernetes",
			IsPublic:          true,
			IsSystem:          true,
			Icon:              "network",
		},
		{
			Name:              "static-website",
			DisplayName:       "Static Website",
			Description:       "Static file server or SPA served via Nginx. Includes zero-downtime rolling updates.",
			Category:          "application",
			Version:           "v1",
			SupportedRuntimes: "nomad,kubernetes",
			IsPublic:          true,
			IsSystem:          true,
			Icon:              "layout-dashboard",
		},
		{
			Name:              "background-processor",
			DisplayName:       "Background Processor",
			Description:       "Event-driven processor for streaming pipelines. Suitable for Kafka consumers and stream processors.",
			Category:          "application",
			Version:           "v1",
			SupportedRuntimes: "nomad,kubernetes",
			IsPublic:          true,
			IsSystem:          true,
			Icon:              "zap",
		},
	}
	for _, item := range items {
		if err := db.Where("name = ?", item.Name).FirstOrCreate(&item).Error; err != nil {
			return err
		}
	}
	return nil
}
