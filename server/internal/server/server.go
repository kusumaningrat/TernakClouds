package server

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/accessrequest"
	"github.com/kusumaningrat/ternakclouds/internal/auth"
	"github.com/kusumaningrat/ternakclouds/internal/blueprint"
	"github.com/kusumaningrat/ternakclouds/internal/capability"
	"github.com/kusumaningrat/ternakclouds/internal/config"
	"github.com/kusumaningrat/ternakclouds/internal/department"
	"github.com/kusumaningrat/ternakclouds/internal/environment"
	"github.com/kusumaningrat/ternakclouds/internal/docker"
	"github.com/kusumaningrat/ternakclouds/internal/kubernetes"
	"github.com/kusumaningrat/ternakclouds/internal/middleware"
	"github.com/kusumaningrat/ternakclouds/internal/nomad"
	"github.com/kusumaningrat/ternakclouds/internal/platformapp"
	"github.com/kusumaningrat/ternakclouds/internal/registry"
	"github.com/kusumaningrat/ternakclouds/internal/role"
	"github.com/kusumaningrat/ternakclouds/internal/secret"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
	"github.com/kusumaningrat/ternakclouds/internal/user"
	"github.com/kusumaningrat/ternakclouds/internal/vault"
	"github.com/kusumaningrat/ternakclouds/internal/workspace"
	"gorm.io/gorm"
)

type Server struct {
	cfg    *config.Config
	engine *gin.Engine
}

func New(cfg *config.Config, db *gorm.DB, vc vault.Client) *Server {
	gin.SetMode(cfg.Server.GinMode)
	engine := gin.Default()

	engine.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.Server.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	registerRoutes(engine, cfg, db, vc)

	return &Server{cfg: cfg, engine: engine}
}

func (s *Server) Run() error {
	return s.engine.Run(":" + s.cfg.Server.Port)
}

func registerRoutes(r *gin.Engine, cfg *config.Config, db *gorm.DB, vc vault.Client) {
	// ── Repositories ────────────────────────────────────────────────────────
	userRepo := user.NewUserRepository(db)
	tokenRepo := user.NewRefreshTokenRepository(db)
	deptRepo := department.NewDepartmentRepository(db)
	roleRepo := role.NewRoleRepository(db)
	wsRepo := workspace.NewRepository(db)
	envRepo := environment.NewRepository(db)
	capRepo := capability.NewRepository(db)
	arRepo := accessrequest.NewRepository(db)
	registryRepo := registry.NewRepository(db)
	catalogRepo := servicecatalog.NewRepository(db)
	blueprintRepo := blueprint.NewRepository(db)
	platformAppRepo := platformapp.NewRepository(db)

	// ── Services ─────────────────────────────────────────────────────────────
	userService := user.NewUserService(userRepo, tokenRepo)
	deptService := department.NewDepartmentService(deptRepo)
	roleService := role.NewRoleService(roleRepo)
	authService := auth.NewAuthService(userService, deptService, tokenRepo, cfg.JWT)
	envService := environment.NewService(envRepo)
	wsService := workspace.NewService(wsRepo, roleService, envService)
	capService := capability.NewService(capRepo, vc)
	arService := accessrequest.NewService(arRepo, wsService, roleService)
	nomadService := nomad.NewService(capRepo, vc)
	k8sService := kubernetes.NewService(capRepo, vc)
	dockerService := docker.NewService(capRepo, vc)
	secretService := secret.NewService(secret.NewRepository(db), capRepo, vc)
	registryService := registry.NewService(registryRepo, vc)
	catalogService := servicecatalog.NewService(catalogRepo, nomadService, registryRepo, capRepo, vc)
	blueprintService := blueprint.NewService(blueprintRepo)
	platformAppService := platformapp.NewService(platformAppRepo, blueprintService, nomadService)

	// ── Handlers ─────────────────────────────────────────────────────────────
	authHandler := auth.NewAuthHandler(authService, roleService)
	deptHandler := department.NewDepartmentHandler(deptService)
	roleHandler := role.NewRoleHandler(roleService)
	userHandler := user.NewHandler(userService)
	wsHandler := workspace.NewHandler(wsService)
	envHandler := environment.NewHandler(envService)
	capHandler := capability.NewHandler(capService)
	nomadHandler := nomad.NewHandler(nomadService)
	k8sHandler := kubernetes.NewHandler(k8sService)
	dockerHandler := docker.NewHandler(dockerService)
	secretHandler := secret.NewHandler(secretService)
	arHandler := accessrequest.NewHandler(arService)
	registryHandler := registry.NewHandler(registryService)
	catalogHandler := servicecatalog.NewHandler(catalogService)
	blueprintHandler := blueprint.NewHandler(blueprintService)
	platformAppHandler := platformapp.NewHandler(platformAppService)

	v1 := r.Group("/api/v1")

	// Public routes — no auth required
	auth.RegisterRoutes(v1, authHandler)

	// Protected routes — JWT required
	protected := v1.Group("")
	protected.Use(middleware.JWT(cfg.JWT.Secret))
	{
		auth.RegisterProtectedRoutes(protected, authHandler)
		department.RegisterRoutes(protected, deptHandler)
		role.RegisterRoutes(protected, roleHandler,
			middleware.RequirePermission(roleService, "roles:assign"),
		)
		user.RegisterRoutes(protected, userHandler,
			middleware.RequirePermission(roleService, "users:read"),
		)

		wsAdapter := &workspaceAccessAdapter{svc: wsService}

		// Workspace routes: service-layer auth handles ownership/member checks.
		workspace.RegisterRoutes(protected, wsHandler)

		// Environment routes: ResolveWorkspace sets workspace_id in context;
		// RequireWorkspaceOwner guards write operations.
		environment.RegisterRoutes(
			protected,
			envHandler,
			middleware.ResolveWorkspace(wsAdapter),
			middleware.RequireWorkspaceOwner(wsAdapter),
		)

		// Integration routes: ResolveWorkspace + ResolveEnvironment set IDs in context;
		// integrations:write permission guards mutating endpoints.
		envAdapter := &environmentResolverAdapter{svc: envService}
		// integration.RegisterRoutes(
		// 	protected,
		// 	integHandler,
		// 	middleware.ResolveWorkspace(wsAdapter),
		// 	middleware.RequireWorkspaceMember(wsAdapter),
		// 	middleware.ResolveEnvironment(envAdapter),
		// 	middleware.RequirePermission(roleService, "integrations:write"),
		// )

		// Capability routes: same workspace + member + environment resolution.
		// Bind/unbind requires both workspace ownership AND environments:write permission
		// (admin + manager only) — developers and viewers are blocked at the platform level.
		envGroup := protected.Group("/workspaces/:slug/environments/:envSlug",
			middleware.ResolveWorkspace(wsAdapter),
			middleware.RequireWorkspaceMember(wsAdapter),
			middleware.ResolveEnvironment(envAdapter),
		)
		capability.RegisterRoutes(envGroup, capHandler,
			middleware.RequirePermission(roleService, "environments:write"),
			middleware.RequireWorkspaceOwner(wsAdapter),
		)
		nomad.RegisterRoutes(envGroup, nomadHandler)
		kubernetes.RegisterRoutes(envGroup, k8sHandler)
		docker.RegisterRoutes(envGroup, dockerHandler)
		secret.RegisterRoutes(envGroup, secretHandler)

		registry.RegisterWorkspaceRoutes(protected, registryHandler,
			middleware.ResolveWorkspace(wsAdapter),
			middleware.RequireWorkspaceMember(wsAdapter),
			middleware.RequireWorkspaceOwner(wsAdapter),
		)
		registry.RegisterEnvironmentRoutes(envGroup, registryHandler,
			middleware.RequireWorkspaceOwner(wsAdapter),
		)

		// Access request routes: any auth user can create/view their own;
		// workspaces:write (admin + manager) gates list-pending and approve/deny.
		accessrequest.RegisterRoutes(protected, arHandler,
			middleware.RequirePermission(roleService, "workspaces:write"),
		)

		// Service catalog: global listing for any authenticated user.
		// Deployments live under the env group; deploy + delete require deployments:exec.
		servicecatalog.RegisterCatalogRoutes(protected, catalogHandler)
		servicecatalog.RegisterDeploymentRoutes(envGroup, catalogHandler,
			middleware.RequirePermission(roleService, "deployments:exec"),
		)

		// Blueprints: global read-only listing for any authenticated user.
		blueprint.RegisterRoutes(protected, blueprintHandler)

		// Platform applications: provision + delete require deployments:exec.
		platformapp.RegisterRoutes(envGroup, platformAppHandler,
			middleware.RequirePermission(roleService, "deployments:exec"),
		)
	}
}

// environmentResolverAdapter bridges environment.Service to middleware.EnvironmentResolver.
type environmentResolverAdapter struct {
	svc *environment.Service
}

func (a *environmentResolverAdapter) FindBySlugAndWorkspace(workspaceID uuid.UUID, slug string) (uuid.UUID, error) {
	env, err := a.svc.Get(workspaceID, slug)
	if err != nil {
		return uuid.Nil, err
	}
	return env.ID, nil
}

// workspaceAccessAdapter bridges workspace.Service to middleware.WorkspaceAccessChecker.
// workspace.Service.FindBySlug returns *workspace.Workspace; the middleware needs *middleware.WorkspaceRef.
type workspaceAccessAdapter struct {
	svc *workspace.Service
}

func (a *workspaceAccessAdapter) FindBySlug(slug string) (*middleware.WorkspaceRef, error) {
	w, err := a.svc.FindBySlug(slug)
	if err != nil {
		return nil, err
	}
	return &middleware.WorkspaceRef{ID: w.ID, OwnerID: w.OwnerID}, nil
}

func (a *workspaceAccessAdapter) IsMember(userID, workspaceID uuid.UUID) (bool, error) {
	return a.svc.IsMember(userID, workspaceID)
}

func (a *workspaceAccessAdapter) IsOwner(userID, workspaceID uuid.UUID) (bool, error) {
	return a.svc.IsOwner(userID, workspaceID)
}

func (a *workspaceAccessAdapter) HasWorkspaceAccess(userID, workspaceID uuid.UUID) (bool, error) {
	return a.svc.HasWorkspaceAccess(userID, workspaceID)
}
