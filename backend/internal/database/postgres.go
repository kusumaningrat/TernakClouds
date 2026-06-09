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
	"github.com/kusumaningrat/ternakclouds/internal/database/seeds"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
	"github.com/kusumaningrat/ternakclouds/internal/user"
	"github.com/kusumaningrat/ternakclouds/internal/workspace"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	if err := seedCatalog(db); err != nil {
		return err
	}
	if err := seedBlueprints(db); err != nil {
		return err
	}
	log.Println("database seeded successfully")
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
		// Storage
		{Name: "storage:read", Resource: "storage", Action: "read", Description: "List buckets and view storage provider"},
		{Name: "storage:write", Resource: "storage", Action: "write", Description: "Create buckets"},
		{Name: "storage:delete", Resource: "storage", Action: "delete", Description: "Delete buckets"},
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
				"storage:read", "storage:write", "storage:delete",
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
				"storage:read", "storage:write", "storage:delete",
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
				"storage:read", "storage:write",
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
				"storage:read",
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
		{ID: uuid.MustParse("00000005-0000-0000-0000-000000000001"), Name: "minio", DisplayName: "MinIO", CapabilityName: capability.CapStorage, Description: "S3-compatible object storage for on-premise and edge deployments"},
		{ID: uuid.MustParse("00000005-0000-0000-0000-000000000002"), Name: "s3", DisplayName: "AWS S3", CapabilityName: capability.CapStorage, Description: "Amazon Simple Storage Service — managed cloud object storage"},
		{ID: uuid.MustParse("00000005-0000-0000-0000-000000000003"), Name: "gcs", DisplayName: "Google Cloud Storage", CapabilityName: capability.CapStorage, Description: "Scalable object storage on Google Cloud (use HMAC keys for S3-compatible access)"},
		{ID: uuid.MustParse("00000005-0000-0000-0000-000000000004"), Name: "azure-blob", DisplayName: "Azure Blob Storage", CapabilityName: capability.CapStorage, Description: "Microsoft Azure object storage (credential: accountName:base64AccountKey)"},
		{ID: uuid.MustParse("00000005-0000-0000-0000-000000000005"), Name: "r2", DisplayName: "Cloudflare R2", CapabilityName: capability.CapStorage, Description: "S3-compatible object storage with zero egress fees"},
	}
	for _, p := range providers {
		if err := db.Where("name = ?", p.Name).FirstOrCreate(&p).Error; err != nil {
			return err
		}
	}

	return nil
}

func seedCatalog(db *gorm.DB) error {
	all := make([]servicecatalog.CatalogItem, 0)
	all = append(all, seeds.Applications...)
	all = append(all, seeds.Databases...)
	all = append(all, seeds.Cache...)
	all = append(all, seeds.Storage...)
	all = append(all, seeds.Messaging...)
	all = append(all, seeds.Networking...)
	for _, item := range all {
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "name"}},
			DoUpdates: clause.AssignmentColumns([]string{"display_name", "description", "category", "default_image", "default_container_port", "default_cpu", "default_memory", "health_check_type", "health_check_path", "is_public_image"}),
		}).Create(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func seedBlueprints(db *gorm.DB) error {
	items := []blueprint.Blueprint{
		// ── Legacy blueprints (kept for backwards compatibility) ────────────
		{
			Name: "web-api", DisplayName: "Web API",
			Description:       "HTTP REST or GraphQL API service. Includes health checks, rolling deployments, and optional Vault secret injection.",
			Category:          "application", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "globe",
			DefaultPort: 8080, DefaultCPU: 256, DefaultMemoryMB: 256,
		},
		{
			Name: "worker", DisplayName: "Background Worker",
			Description:       "Long-running background processor. No HTTP port exposed; suitable for queue consumers and async jobs.",
			Category:          "application", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "cpu",
			DefaultPort: 0, DefaultCPU: 256, DefaultMemoryMB: 256,
		},
		{
			Name: "cron-job", DisplayName: "Cron Job",
			Description:       "Scheduled batch task that runs on a cron schedule. Mapped to Nomad batch jobs or Kubernetes CronJobs.",
			Category:          "application", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "clock",
			DefaultPort: 0, DefaultCPU: 256, DefaultMemoryMB: 128,
		},
		{
			Name: "internal-service", DisplayName: "Internal Service",
			Description:       "Service exposed only within the cluster network. Suitable for gRPC microservices and internal APIs.",
			Category:          "application", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "network",
			DefaultPort: 8080, DefaultCPU: 256, DefaultMemoryMB: 256,
		},
		{
			Name: "static-website", DisplayName: "Static Website",
			Description:       "Static file server or SPA served via Nginx. Includes zero-downtime rolling updates.",
			Category:          "application", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "layout-dashboard",
			DefaultImage: "nginx", DefaultTag: "alpine", DefaultPort: 80, DefaultCPU: 128, DefaultMemoryMB: 128,
		},
		{
			Name: "background-processor", DisplayName: "Background Processor",
			Description:       "Event-driven processor for streaming pipelines. Suitable for Kafka consumers and stream processors.",
			Category:          "application", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "zap",
			DefaultPort: 0, DefaultCPU: 512, DefaultMemoryMB: 512,
		},
		// ── New starter blueprints ──────────────────────────────────────────
		// Applications
		{
			Name: "go-api", DisplayName: "Go API",
			Description:       "Go HTTP service. Provisioned with sensible CPU/memory defaults and health-check support.",
			Category:          "application", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "globe",
			DefaultTag: "latest", DefaultPort: 8080, DefaultCPU: 256, DefaultMemoryMB: 256,
		},
		{
			Name: "nodejs-api", DisplayName: "Node.js API",
			Description:       "Node.js HTTP/Express service. Includes health checks and rolling deployments.",
			Category:          "application", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "globe",
			DefaultTag: "latest", DefaultPort: 3000, DefaultCPU: 256, DefaultMemoryMB: 256,
		},
		{
			Name: "python-fastapi", DisplayName: "Python FastAPI",
			Description:       "Python FastAPI service. Auto-configured with uvicorn, health endpoint, and rolling deploys.",
			Category:          "application", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "globe",
			DefaultTag: "latest", DefaultPort: 8000, DefaultCPU: 256, DefaultMemoryMB: 256,
		},
		{
			Name: "nextjs", DisplayName: "Next.js",
			Description:       "Next.js full-stack application. Server-side rendering with Node.js runtime.",
			Category:          "application", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "layout-dashboard",
			DefaultTag: "latest", DefaultPort: 3000, DefaultCPU: 512, DefaultMemoryMB: 512,
		},
		// Infrastructure
		{
			Name: "postgresql", DisplayName: "PostgreSQL",
			Description:       "PostgreSQL relational database. Provisioned with persistent storage and default credentials via Vault.",
			Category:          "infrastructure", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "database",
			DefaultImage: "postgres", DefaultTag: "16-alpine", DefaultPort: 5432, DefaultCPU: 512, DefaultMemoryMB: 512,
		},
		{
			Name: "redis", DisplayName: "Redis",
			Description:       "Redis in-memory data store. Suitable for caching, pub/sub, and session storage.",
			Category:          "infrastructure", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "database",
			DefaultImage: "redis", DefaultTag: "7-alpine", DefaultPort: 6379, DefaultCPU: 256, DefaultMemoryMB: 256,
		},
		{
			Name: "rabbitmq", DisplayName: "RabbitMQ",
			Description:       "RabbitMQ message broker with management UI. Suitable for async task queues and event streaming.",
			Category:          "infrastructure", Version: "v1", SupportedRuntimes: "nomad,kubernetes",
			IsPublic: true, IsSystem: true, Icon: "zap",
			DefaultImage: "rabbitmq", DefaultTag: "3-management-alpine", DefaultPort: 5672, DefaultCPU: 512, DefaultMemoryMB: 512,
		},
		// CI/CD
		{
			Name: "github-actions", DisplayName: "GitHub Actions",
			Description:       "Generate a GitHub Actions workflow for building, testing, and deploying your service automatically.",
			Category:          "cicd", Version: "v1", SupportedRuntimes: "",
			IsPublic: true, IsSystem: true, Icon: "git-branch",
			CICDProvider: "github-actions",
		},
		{
			Name: "gitlab-ci", DisplayName: "GitLab CI",
			Description:       "Generate a GitLab CI/CD pipeline (.gitlab-ci.yml) for automated build and deploy.",
			Category:          "cicd", Version: "v1", SupportedRuntimes: "",
			IsPublic: true, IsSystem: true, Icon: "git-branch",
			CICDProvider: "gitlab-ci",
		},
		{
			Name: "jenkins", DisplayName: "Jenkins Pipeline",
			Description:       "Generate a Jenkinsfile pipeline for build, test, and deploy stages.",
			Category:          "cicd", Version: "v1", SupportedRuntimes: "",
			IsPublic: true, IsSystem: true, Icon: "git-branch",
			CICDProvider: "jenkins",
		},
	}
	for _, item := range items {
		if err := db.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "name"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"display_name", "description", "default_image", "default_tag",
				"default_port", "default_cpu", "default_memory_mb", "cicd_provider",
			}),
		}).Create(&item).Error; err != nil {
			return err
		}
	}
	return nil
}
