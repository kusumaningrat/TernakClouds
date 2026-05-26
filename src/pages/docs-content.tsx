import { CheckCircle2 } from "lucide-react";

type Article = {
  id: string;
  title: string;
  content: React.ReactNode;
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      className="glass rounded-lg p-4 text-xs font-mono leading-relaxed overflow-x-auto my-4"
      style={{ color: "var(--color-foreground)" }}
    >
      {children.trim()}
    </pre>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xl font-semibold mt-8 mb-3"
      style={{ color: "var(--color-foreground)" }}
    >
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-sm leading-7 my-3"
      style={{ color: "var(--muted-foreground)" }}
    >
      {children}
    </p>
  );
}

function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul
      className="space-y-2 my-3 text-sm"
      style={{ color: "var(--muted-foreground)" }}
    >
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <CheckCircle2
            className="size-4 mt-0.5 shrink-0"
            style={{ color: "var(--color-success)" }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="glass rounded-lg p-4 my-4 border-l-2"
      style={{ borderLeftColor: "var(--color-primary)" }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-1"
        style={{ color: "var(--color-primary)" }}
      >
        {title}
      </p>
      <p
        className="text-sm leading-6"
        style={{ color: "var(--muted-foreground)" }}
      >
        {children}
      </p>
    </div>
  );
}

export const articles: Article[] = [
  {
    id: "introduction",
    title: "Introduction & overview",
    content: (
      <div>
        <H2>What is TernakClouds?</H2>
        <P>
          TernakClouds is a self-hosted Internal Developer Platform (IDP) that
          gives engineering teams a single control plane to deploy services,
          manage secrets, govern access, and observe infrastructure — across
          Kubernetes, Nomad, and any runtime.
        </P>
        <P>
          Instead of giving developers direct access to{" "}
          <code className="font-mono text-xs">kubectl</code>, Nomad CLIs, or
          Vault, TernakClouds centralizes all platform operations behind a
          clean, permission-controlled interface.
        </P>
        <UL
          items={[
            "Deploy and inspect workloads without runtime-specific knowledge",
            "Stream logs from any workload in real time",
            "Request secret access without touching Vault directly",
            "Submit self-service workspace access requests",
            "Manage multiple environments (dev, staging, production) per workspace",
          ]}
        />

        <H2>Core concepts</H2>
        <P>
          <strong>Workspace</strong> — an isolated organizational tenant with
          its own environments, members, and capability bindings.
        </P>
        <P>
          <strong>Environment</strong> — a named deployment target within a
          workspace (e.g. dev, staging, production). Each environment
          independently configures its own providers.
        </P>
        <P>
          <strong>Capability</strong> — a platform service type:{" "}
          <code className="font-mono text-xs">runtime</code>,{" "}
          <code className="font-mono text-xs">secrets</code>,{" "}
          <code className="font-mono text-xs">logs</code>,{" "}
          <code className="font-mono text-xs">networking</code>,{" "}
          <code className="font-mono text-xs">storage</code>.
        </P>
        <P>
          <strong>Provider</strong> — a concrete implementation of a capability
          (e.g. Nomad for runtime, Loki for logs, Vault for secrets). Providers
          are bound per-environment and configured with an endpoint and optional
          credentials stored in Vault.
        </P>

        <H2>System architecture</H2>
        <CodeBlock>{`
┌──────────────────────┐     ┌──────────────────────┐
│  Admin dashboard     │     │  Public website      │
│  React + TanStack    │     │  Vite + React        │
│  :3000               │     │  :4000               │
└──────────┬───────────┘     └──────────────────────┘
           │ /api/*  Bearer JWT
           ▼
┌──────────────────────┐
│  Go / Gin REST API   │
│  :8022               │
└──────────┬───────────┘
           │
  ┌────────┼──────────────────┐
  ▼        ▼                  ▼
┌─────┐ ┌───────┐  ┌─────────────────────┐
│ PG  │ │ Vault │  │  Runtime clusters   │
│5432 │ │ 8200  │  │  Kubernetes / Nomad │
└─────┘ └───────┘  └─────────────────────┘
        `}</CodeBlock>
        <P>
          The API is stateless. All platform state lives in PostgreSQL. Provider
          credentials are stored exclusively in Vault KV v2 and never in the
          database.
        </P>

        <H2>What these docs cover</H2>
        <UL
          items={[
            "Installation — prerequisites, configuration, first run",
            "Architecture — system components, request flows, data model",
            "Runtimes — Kubernetes and Nomad provider setup and operations",
            "Logs platform — centralized streaming, Loki integration, search",
            "Authentication & RBAC — roles, permissions, access requests",
            "Contributing — development setup, conventions, PR workflow",
          ]}
        />
      </div>
    ),
  },

  {
    id: "installation",
    title: "Installation & setup",
    content: (
      <div>
        <H2>Prerequisites</H2>
        <UL
          items={[
            "Go 1.22+ — backend API",
            "Node.js 20+ and npm 10+ — frontend apps",
            "Docker 24+ and Docker Compose v2 — PostgreSQL",
            "HashiCorp Vault 1.15+ — optional, only needed for real provider credentials",
          ]}
        />

        <H2>1. Clone and configure</H2>
        <CodeBlock>{`
git clone <repo-url> idp
cd idp

# Backend config
cp server/.env.example server/.env

# Admin dashboard config
cp admin/.env.example admin/.env
        `}</CodeBlock>
        <P>
          Edit <code className="font-mono text-xs">server/.env</code> and set
          the required values:
        </P>
        <CodeBlock>{`
APP_PORT=8022
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=idp_platform
JWT_SECRET=change-me-to-a-long-random-string
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme123
VAULT_ENABLED=false
        `}</CodeBlock>
        <Callout title="VITE_API_URL">
          Leave <code className="font-mono text-xs">VITE_API_URL</code> empty in{" "}
          <code className="font-mono text-xs">admin/.env</code> during
          development — the Vite dev server automatically proxies{" "}
          <code className="font-mono text-xs">/api/*</code> to the backend.
        </Callout>

        <H2>2. Start infrastructure</H2>
        <CodeBlock>{`
make docker-up
# starts PostgreSQL on :5432
        `}</CodeBlock>

        <H2>3. Install dependencies and run</H2>
        <CodeBlock>{`
make install   # npm install for site + admin dashboard
make dev       # starts API (:8022) + admin dashboard (:3000)
        `}</CodeBlock>
        <P>Or start services individually:</P>
        <CodeBlock>{`
make dev-backend   # Go API on :8022
make dev-admin     # Admin dashboard on :3000
make dev-site      # Public website on :4000
        `}</CodeBlock>

        <H2>4. First login</H2>
        <P>
          Open{" "}
          <a
            href="http://localhost:3000"
            className="underline underline-offset-2"
            style={{ color: "var(--color-primary)" }}
          >
            http://localhost:3000
          </a>{" "}
          and log in with the{" "}
          <code className="font-mono text-xs">ADMIN_EMAIL</code> and{" "}
          <code className="font-mono text-xs">ADMIN_PASSWORD</code> you set. On
          first start the server auto-migrates the database and seeds default
          roles, a bootstrap admin user, and a Platform workspace with dev /
          staging / production environments.
        </P>

        <H2>Reset the database</H2>
        <P>During development you can wipe and re-seed at any time:</P>
        <CodeBlock>{`
make reset-db-dev
        `}</CodeBlock>

        <H2>Environment variable reference</H2>
        <CodeBlock>{`
# server/.env
APP_PORT            API listen port (default: 8022)
GIN_MODE            debug | release
DB_HOST / DB_PORT   PostgreSQL connection
DB_USER / DB_PASSWORD / DB_NAME
DB_SSLMODE          disable (dev) | require (prod)
JWT_SECRET          HMAC-SHA256 key — min 32 chars
JWT_ACCESS_EXPIRY   Access token TTL (default: 15m)
JWT_REFRESH_EXPIRY  Refresh token TTL (default: 168h)
ADMIN_EMAIL         Bootstrap admin email
ADMIN_PASSWORD      Bootstrap admin password
VAULT_ENABLED       true | false (default: false)
VAULT_ADDR          Vault server URL
VAULT_ROLE_ID       AppRole role ID
VAULT_SECRET_ID     AppRole secret ID
VAULT_KV_MOUNT      KV v2 mount path (default: secret)

# admin/.env
VITE_API_URL        Backend URL (empty in dev)
        `}</CodeBlock>
      </div>
    ),
  },

  {
    id: "auth-basics",
    title: "Authentication basics",
    content: (
      <div>
        <H2>Token architecture</H2>
        <P>
          TernakClouds IDP uses a two-token scheme: a short-lived{" "}
          <strong>access token</strong> (15 minutes) and a long-lived{" "}
          <strong>refresh token</strong> (7 days). Access tokens are sent on
          every API request; refresh tokens are used only to mint a new access
          token when the old one expires.
        </P>
        <CodeBlock>{`
// Access token payload (JWT claims)
{
  "sub":   "usr_01HZ...",
  "email": "alex@peternakclouds.com",
  "dept":  "payments",
  "roles": ["developer"],
  "iat":   1716000000,
  "exp":   1716000900   // 15 min from now
}
        `}</CodeBlock>

        <H2>Login flow</H2>
        <P>
          POST your credentials to{" "}
          <code className="font-mono text-xs">/api/v1/auth/login</code>. On
          success the server returns both tokens:
        </P>
        <CodeBlock>{`
POST /api/v1/auth/login
Content-Type: application/json

{
  "email":    "alex@peternakclouds.com",
  "password": "••••••••"
}

// 200 OK
{
  "access_token":  "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in":    900
}
        `}</CodeBlock>
        <P>
          Store the access token in memory (never in localStorage). The refresh
          token can be stored in an HTTP-only cookie or secure storage.
        </P>

        <H2>Authenticating requests</H2>
        <P>
          Include the access token in the{" "}
          <code className="font-mono text-xs">Authorization</code> header of
          every API request:
        </P>
        <CodeBlock>{`
GET /api/v1/deployments
Authorization: Bearer eyJ...
        `}</CodeBlock>

        <H2>Refreshing the access token</H2>
        <P>
          When a request returns{" "}
          <code className="font-mono text-xs">401 Unauthorized</code>, use the
          refresh token to get a new access token:
        </P>
        <CodeBlock>{`
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJ..."
}

// 200 OK — new pair issued, old refresh token invalidated
{
  "access_token":  "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in":    900
}
        `}</CodeBlock>
        <Callout title="Rotation">
          Each refresh issues a new refresh token and immediately invalidates
          the previous one. If you detect a refresh token being reused (replay
          attack), the entire session family is revoked automatically.
        </Callout>

        <H2>Logging out</H2>
        <CodeBlock>{`
POST /api/v1/auth/logout
Authorization: Bearer eyJ...

// 204 No Content — both tokens revoked server-side
        `}</CodeBlock>
        <P>
          Logout revokes the access token and adds the refresh token to the
          server-side deny list. All subsequent requests with either token will
          return 401.
        </P>
      </div>
    ),
  },

  {
    id: "rbac-concepts",
    title: "RBAC concepts",
    content: (
      <div>
        <H2>Permissions, roles, and assignments</H2>
        <P>The RBAC model has three layers:</P>
        <UL
          items={[
            "Permissions — atomic capabilities like deploy_services or manage_users",
            "Roles — named groups of permissions (e.g. developer, team_lead, sre)",
            "Assignments — a user is assigned one or more roles within a department",
          ]}
        />
        <P>
          On every protected action, the server evaluates: does the actor's role
          set include the required permission for the target resource's
          department?
        </P>

        <H2>Built-in roles</H2>
        <CodeBlock>{`
// superadmin — platform-wide, bypasses dept scope
permissions: [*]

// admin — manages users and roles within their dept
permissions: [
  manage_users, assign_roles, view_audit_logs,
  view_deployments
]

// team_lead — can approve and trigger deploys
permissions: [
  deploy_services, restart_services,
  approve_deployments, view_audit_logs
]

// developer — day-to-day ops within their dept
permissions: [
  deploy_services, restart_services,
  view_deployments
]

// viewer — read-only access
permissions: [
  view_deployments, view_audit_logs
]
        `}</CodeBlock>

        <H2>Creating a custom role</H2>
        <CodeBlock>{`
POST /api/v1/roles
Authorization: Bearer eyJ...
Content-Type: application/json

{
  "name": "release_manager",
  "description": "Can approve and rollback releases",
  "permissions": [
    "approve_deployments",
    "rollback_deployments",
    "view_deployments",
    "view_audit_logs"
  ]
}

// 201 Created
{
  "id":   "rol_01HZ...",
  "name": "release_manager"
}
        `}</CodeBlock>

        <H2>Assigning a role to a user</H2>
        <CodeBlock>{`
POST /api/v1/users/usr_01HZ.../roles
Authorization: Bearer eyJ...
Content-Type: application/json

{
  "role_id":    "rol_01HZ...",
  "department": "payments"
}
        `}</CodeBlock>
        <Callout title="Department scoping">
          A role assignment is always scoped to a department. A user can hold
          different roles in different departments — e.g. developer in payments
          but viewer in infra.
        </Callout>

        <H2>Checking permissions at the API layer</H2>
        <P>
          Every protected endpoint declares the required permission via
          middleware. The check happens server-side; the client cannot override
          it:
        </P>
        <CodeBlock>{`
// Example middleware declaration in the backend
r.With(RequirePermission("deploy_services")).
  Post("/deployments", handlers.CreateDeployment)
        `}</CodeBlock>
        <P>
          If the actor lacks the permission, the server returns{" "}
          <code className="font-mono text-xs">403 Forbidden</code> with a
          structured error body.
        </P>
      </div>
    ),
  },

  {
    id: "inviting-users",
    title: "Inviting users",
    content: (
      <div>
        <H2>Overview</H2>
        <P>
          New users are onboarded via a server-generated invite link. The
          invited user clicks the link, sets their password, and is immediately
          assigned to the department and role the admin specified. No
          self-registration is allowed.
        </P>

        <H2>Sending an invite</H2>
        <P>
          Only users with the{" "}
          <code className="font-mono text-xs">manage_users</code> permission can
          invite new members.
        </P>
        <CodeBlock>{`
POST /api/v1/invites
Authorization: Bearer eyJ...
Content-Type: application/json

{
  "email":      "new.dev@peternakclouds.com",
  "department": "payments",
  "role_id":    "rol_01HZ..."   // optional — defaults to "developer"
}

// 201 Created
{
  "invite_id":  "inv_01HZ...",
  "invite_url": "https://idp.peternakclouds.com/accept/inv_01HZ...",
  "expires_at": "2026-06-01T00:00:00Z"
}
        `}</CodeBlock>
        <P>
          Share the <code className="font-mono text-xs">invite_url</code> with
          the new team member via your preferred channel (email, Slack, etc).
          The link expires after 7 days.
        </P>

        <H2>Accepting an invite</H2>
        <P>
          The invite recipient visits the URL and submits a name and password.
          The platform creates the account, assigns the specified role and
          department, and issues the first session tokens.
        </P>
        <CodeBlock>{`
POST /api/v1/invites/inv_01HZ.../accept
Content-Type: application/json

{
  "name":     "New Developer",
  "password": "••••••••"
}

// 200 OK — returns the same token pair as /login
{
  "access_token":  "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in":    900
}
        `}</CodeBlock>

        <H2>Listing pending invites</H2>
        <CodeBlock>{`
GET /api/v1/invites?status=pending
Authorization: Bearer eyJ...

// 200 OK
{
  "invites": [
    {
      "id":         "inv_01HZ...",
      "email":      "new.dev@peternakclouds.com",
      "department": "payments",
      "role":       "developer",
      "expires_at": "2026-06-01T00:00:00Z"
    }
  ]
}
        `}</CodeBlock>

        <H2>Revoking an invite</H2>
        <CodeBlock>{`
DELETE /api/v1/invites/inv_01HZ...
Authorization: Bearer eyJ...

// 204 No Content
        `}</CodeBlock>
        <Callout title="Audit trail">
          Every invite event — sent, accepted, expired, revoked — is recorded in
          the audit log with the actor's identity, so admins always know who
          invited whom and when.
        </Callout>
      </div>
    ),
  },

  {
    id: "managing-teams",
    title: "Managing teams",
    content: (
      <div>
        <H2>Departments vs teams</H2>
        <P>
          A <strong>department</strong> is the top-level isolation boundary
          (e.g. payments, infrastructure, data). A <strong>team</strong> is an
          optional sub-group within a department for organizational clarity.
          Resource ownership and permission scoping is always at the department
          level.
        </P>

        <H2>Listing members of a department</H2>
        <CodeBlock>{`
GET /api/v1/departments/payments/members
Authorization: Bearer eyJ...

// 200 OK
{
  "members": [
    {
      "id":    "usr_01HZ...",
      "name":  "Alex Dev",
      "email": "alex@peternakclouds.com",
      "roles": ["developer"]
    }
  ]
}
        `}</CodeBlock>

        <H2>Removing a user from a department</H2>
        <CodeBlock>{`
DELETE /api/v1/departments/payments/members/usr_01HZ...
Authorization: Bearer eyJ...

// 204 No Content
        `}</CodeBlock>
        <P>
          Removing a user revokes all their role assignments within that
          department and immediately invalidates any active sessions scoped to
          it.
        </P>

        <H2>Transferring a user to another department</H2>
        <CodeBlock>{`
POST /api/v1/users/usr_01HZ.../transfer
Authorization: Bearer eyJ...
Content-Type: application/json

{
  "from_department": "payments",
  "to_department":   "infrastructure",
  "role_id":         "rol_01HZ..."
}
        `}</CodeBlock>
        <Callout title="Sessions">
          Active sessions are not invalidated by a transfer, but the department
          claim in subsequent access tokens will reflect the new department on
          the next refresh.
        </Callout>
      </div>
    ),
  },

  {
    id: "audit-logs",
    title: "Audit logs",
    content: (
      <div>
        <H2>What is audited</H2>
        <P>
          Every privileged action — login, logout, deploy, role change, invite —
          produces an immutable audit event. Events cannot be deleted or
          modified.
        </P>
        <UL
          items={[
            "Authentication events: login, logout, refresh, revocation",
            "RBAC events: role created/deleted, assignment added/removed",
            "User events: invite sent/accepted/revoked, transfer, removal",
            "Deployment events: queued, approved, rejected, started, succeeded, failed, rolled back",
          ]}
        />

        <H2>Querying the audit log</H2>
        <CodeBlock>{`
GET /api/v1/audit?department=payments&limit=50
Authorization: Bearer eyJ...

// 200 OK
{
  "events": [
    {
      "id":         "evt_01HZ...",
      "actor":      "alex@peternakclouds.com",
      "action":     "deploy_services",
      "resource":   "payments-api",
      "department": "payments",
      "status":     "success",
      "created_at": "2026-05-25T10:04:22Z"
    }
  ],
  "next_cursor": "evt_01HY..."
}
        `}</CodeBlock>

        <H2>Filtering options</H2>
        <CodeBlock>{`
// Filter by actor
GET /api/v1/audit?actor=alex@peternakclouds.com

// Filter by action
GET /api/v1/audit?action=deploy_services

// Filter by time range
GET /api/v1/audit?from=2026-05-01T00:00:00Z&to=2026-05-31T23:59:59Z

// Combine filters
GET /api/v1/audit?department=payments&action=deploy_services&limit=20
        `}</CodeBlock>
        <Callout title="Retention">
          Audit events are retained indefinitely by default. Contact your
          platform admin to configure a retention window if storage becomes a
          concern.
        </Callout>
      </div>
    ),
  },

  {
    id: "architecture",
    title: "Architecture",
    content: (
      <div>
        <H2>System components</H2>
        <P>
          TernakClouds is a Go/Gin REST API backed by PostgreSQL and HashiCorp
          Vault. The admin dashboard is a React + TanStack Router SPA. All
          communication between dashboard and API uses JWT bearer tokens.
        </P>
        <CodeBlock>{`
┌──────────────────────────────────────────────────────┐
│  Admin dashboard  React + TanStack  :3000            │
└───────────────────────────┬──────────────────────────┘
                            │ /api/*  Bearer JWT
                            ▼
┌──────────────────────────────────────────────────────┐
│  Go / Gin REST API  :8022                            │
│  internal/                                           │
│    auth/       workspace/    capability/             │
│    user/       environment/  runtime/  secrets/      │
└──────┬──────────────┬────────────────────────────────┘
       │              │
  ┌────▼────┐   ┌─────▼──────────────────────────────┐
  │Postgres │   │ Vault KV v2                        │
  │ :5432   │   │ idp/capabilities/{envID}/{cap}/... │
  └─────────┘   └────────────────────────────────────┘
        `}</CodeBlock>

        <H2>Backend package structure</H2>
        <P>
          Each domain lives under{" "}
          <code className="font-mono text-xs">server/internal/</code> as an
          independent package. Every package follows the same layout:
        </P>
        <CodeBlock>{`
internal/<domain>/
  models.go      GORM model definitions
  types.go       Request/response DTOs
  repository.go  Database queries and writes
  service.go     Business logic
  handler.go     HTTP handlers
  routes.go      Route registration
        `}</CodeBlock>
        <P>
          Routes are registered in{" "}
          <code className="font-mono text-xs">internal/server/server.go</code>.
          Each package exposes a{" "}
          <code className="font-mono text-xs">RegisterRoutes</code> function —
          never register routes inline in{" "}
          <code className="font-mono text-xs">server.go</code>.
        </P>

        <H2>Request flow — capability binding</H2>
        <CodeBlock>{`
POST /api/v1/workspaces/:slug/environments/:envSlug
     /capabilities/:cap/provider

1. JWT middleware validates token, extracts user + roles
2. ownerGuard checks workspace membership (owner required)
3. Permission middleware checks environments:write platform role
4. Handler calls capability.Service.BindProvider
5. Service writes ProviderConfig to Postgres
6. If token present: Service stores it in Vault at
   idp/capabilities/{envID}/{cap}/{providerName}/token
7. Vault path saved to ProviderConfig (not the token itself)
        `}</CodeBlock>

        <H2>Request flow — log streaming</H2>
        <CodeBlock>{`
GET /api/v1/workspaces/:slug/environments/:envSlug
    /runtime/kubernetes/pods/:ns/:name/logs?container=app&follow=true

1. Auth + workspace membership verified
2. Handler fetches K8s provider config for environment
3. Retrieves K8s service account token from Vault
4. Opens streaming connection to K8s API server
5. Reads lines with bufio.Scanner
6. Emits each line as SSE event: log
7. On disconnect: cleans up upstream connection
        `}</CodeBlock>

        <H2>Data model</H2>
        <UL
          items={[
            "Workspace — top-level tenant; has members (users) and environments",
            "Environment — deployment target (dev/staging/prod) within a workspace",
            "CapabilityType — platform-defined capability slot: runtime, secrets, logs, networking, storage",
            "ProviderCatalogue — available implementations seeded at startup (kubernetes, nomad, loki, vault, …)",
            "ProviderConfig — a bound provider: capability + provider + endpoint + Vault path (per environment)",
          ]}
        />

        <H2>Authorization model</H2>
        <P>All privileged mutations require both layers simultaneously:</P>
        <CodeBlock>{`
Layer 1: Platform role permission
  e.g. environments:write → admin and manager only

Layer 2: Workspace ownership
  user must be workspace owner (not just member)

Both must pass. Being admin globally is not enough
to modify a workspace you do not own.
        `}</CodeBlock>
        <Callout title="Vault credential isolation">
          Provider tokens are stored in Vault and retrieved at request time.
          They are never returned in API responses and never persisted in
          PostgreSQL. The database stores only the Vault path.
        </Callout>
      </div>
    ),
  },

  {
    id: "runtimes",
    title: "Runtimes",
    content: (
      <div>
        <H2>Overview</H2>
        <P>
          A runtime provider connects an environment to a workload orchestrator.
          Two providers are supported: <strong>Kubernetes</strong> and{" "}
          <strong>Nomad</strong>. Each environment binds exactly one runtime
          provider. Operations — listing workloads, streaming logs, inspecting
          pods — are proxied through the TernakClouds API; developers never call
          the runtime APIs directly.
        </P>

        <H2>Binding a Kubernetes provider</H2>
        <P>
          Navigate to <strong>Platform → Runtime</strong> in any environment,
          then click <strong>Add provider → Kubernetes</strong>.
        </P>
        <UL
          items={[
            "Endpoint — Kubernetes API server URL (e.g. https://k8s.internal:6443)",
            "Token — service account bearer token with namespace read + pod log access",
            "Namespace — optional default namespace (can be overridden per request)",
          ]}
        />
        <P>Required RBAC for the service account:</P>
        <CodeBlock>{`
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ternak-clouds-reader
rules:
  - apiGroups: [""]
    resources: [namespaces, pods]
    verbs: [get, list, watch]
  - apiGroups: [""]
    resources: [pods/log]
    verbs: [get]
  - apiGroups: [apps]
    resources: [deployments, replicasets]
    verbs: [get, list, watch]
        `}</CodeBlock>

        <H2>Binding a Nomad provider</H2>
        <P>
          Navigate to <strong>Platform → Runtime</strong>, then click{" "}
          <strong>Add provider → Nomad</strong>.
        </P>
        <UL
          items={[
            "Endpoint — Nomad HTTP API base URL (e.g. https://nomad.internal:4646)",
            "Token — Nomad ACL token with read:job + alloc access",
            "Namespace — optional Nomad namespace (default: default)",
          ]}
        />
        <P>Minimum Nomad ACL policy:</P>
        <CodeBlock>{`
namespace "default" {
  policy       = "read"
  capabilities = ["read-job", "alloc-exec", "read-logs"]
}
        `}</CodeBlock>

        <H2>Runtime operations</H2>
        <CodeBlock>{`
# Kubernetes
GET /runtime/kubernetes/namespaces
GET /runtime/kubernetes/pods/:namespace
GET /runtime/kubernetes/pods/:namespace/:name
GET /runtime/kubernetes/pods/:namespace/:name/logs
    ?container=app&follow=true

# Nomad
GET /runtime/nomad/namespaces
GET /runtime/nomad/jobs
GET /runtime/nomad/jobs/:jobID
GET /runtime/nomad/allocations/:allocID/logs
    ?task=server&type=stdout&follow=true
        `}</CodeBlock>
        <P>
          All paths above are prefixed with{" "}
          <code className="font-mono text-xs">
            /api/v1/workspaces/:slug/environments/:envSlug
          </code>
          .
        </P>

        <H2>Workload model</H2>
        <P>
          Both runtimes expose their workloads through the same normalized shape
          in the dashboard. Kubernetes pods and Nomad allocations both appear in
          the same workload selector without runtime-specific UI.
        </P>
        <CodeBlock>{`
// Kubernetes pod → normalized
{
  id:        "default/payments-api-8f4d9b",
  runtime:   "kubernetes",
  type:      "pod",
  name:      "payments-api-8f4d9b",
  namespace: "default",
  status:    "Running",
  containers: ["app", "sidecar"]
}

// Nomad allocation → normalized
{
  id:       "a3f2c1d0-...",
  runtime:  "nomad",
  type:     "allocation",
  name:     "payments-api",
  job:      "payments-api",
  status:   "running",
  tasks:    ["server", "migrations"]
}
        `}</CodeBlock>

        <H2>Verifying a provider</H2>
        <P>
          Use the <strong>Verify</strong> button on any bound provider card. It
          probes <code className="font-mono text-xs">{"{endpoint}/ready"}</code>{" "}
          with a 5-second timeout and reports <strong>reachable</strong> (green)
          or <strong>unreachable</strong> (red).
        </P>
      </div>
    ),
  },

  {
    id: "logs-platform",
    title: "Logs platform",
    content: (
      <div>
        <H2>Overview</H2>
        <P>
          The logs platform gives developers a single place to tail, search, and
          filter logs from any workload — without{" "}
          <code className="font-mono text-xs">kubectl logs</code>, direct
          allocation access, or infrastructure knowledge.
        </P>
        <CodeBlock>{`
Runtime workloads (pods / allocations)
            │  native log API
            ▼
TernakClouds backend (proxy + SSE emitter)
            │  Server-Sent Events
            ▼
Admin dashboard — Logs page
live tail · search · filter · highlight
        `}</CodeBlock>

        <H2>Live streaming</H2>
        <P>
          The primary mode. Works as long as a runtime provider is bound — no
          logs backend needed.
        </P>
        <UL
          items={[
            "Kubernetes: proxies pod log streaming via the K8s API server",
            "Nomad: proxies allocation log streaming via the Nomad client HTTP API; decodes base64 LogFrame objects",
            "Stream is forwarded as SSE — browser receives events in real time",
            "Logs capped at 3,000 lines; older lines drop automatically",
          ]}
        />

        <H2>Using the Logs page</H2>
        <P>
          Navigate to any environment → <strong>Logs</strong> in the sidebar.
        </P>
        <UL
          items={[
            "Runtime — select the runtime provider (Kubernetes or Nomad)",
            "Namespace — dropdown populated from the cluster; changing it resets the workload selection",
            "Workload — select a pod (K8s) or job (Nomad)",
            "Container / Task — auto-populated from the selected workload",
            "Source — stdout or stderr",
            "Stream / Stop — start and stop live tailing",
          ]}
        />

        <H2>Search and filter</H2>
        <P>
          Type a term in the Search bar and press{" "}
          <code className="font-mono text-xs">Enter</code> (or click Search).
          Only matching lines are shown; matches are highlighted in yellow. The
          counter shows <code className="font-mono text-xs">N / Total</code>{" "}
          when a filter is active. Press{" "}
          <code className="font-mono text-xs">Escape</code> or click ✕ to clear.
          Search is client-side and does not affect the streaming connection.
        </P>

        <H2>SSE protocol</H2>
        <CodeBlock>{`
event: connected
data: {}

event: log
data: 2026-05-26T10:00:00Z INFO starting server port=8080

event: log
data: 2026-05-26T10:00:01Z INFO request path=/health status=200

event: error
data: connection refused
        `}</CodeBlock>
        <P>
          Events are split by double newline. The client reads the response body
          as a byte stream, parses SSE blocks, and dispatches to React state.
        </P>

        <H2>Logs backend (Loki)</H2>
        <P>
          A logs backend enables historical log queries independent of live
          streaming. Navigate to <strong>Platform → Logs Backend</strong> and
          bind a Loki provider.
        </P>
        <UL
          items={[
            "Endpoint — Loki base URL (e.g. https://loki.internal:3100)",
            "Token — optional bearer token (leave blank for unauthenticated Loki)",
            "Use Verify to confirm the /ready endpoint responds",
          ]}
        />
        <Callout title="Architecture boundary">
          The frontend never communicates with Loki directly. All queries go
          through the TernakClouds API, which translates them into LogQL. Loki
          is never exposed to the public network.
        </Callout>

        <H2>Structured log recommendations</H2>
        <P>
          Applications should emit structured JSON logs for the best search
          experience:
        </P>
        <CodeBlock>{`
{
  "timestamp": "2026-05-26T10:00:00Z",
  "level":     "error",
  "service":   "payments",
  "message":   "database timeout after 30s",
  "traceId":   "abc123",
  "requestId": "req-456"
}
        `}</CodeBlock>
        <P>
          Use low-cardinality values as Loki labels (
          <code className="font-mono text-xs">namespace</code>,{" "}
          <code className="font-mono text-xs">environment</code>,{" "}
          <code className="font-mono text-xs">app</code>). High-cardinality
          values like <code className="font-mono text-xs">traceId</code> belong
          in the log payload, not labels.
        </P>
      </div>
    ),
  },

  {
    id: "contributing",
    title: "Contributing",
    content: (
      <div>
        <H2>Development setup</H2>
        <CodeBlock>{`
git clone <repo-url> idp && cd idp
cp server/.env.example server/.env   # edit DB_* and JWT_SECRET
cp admin/.env.example admin/.env
make docker-up   # start PostgreSQL
make install     # npm install for site + admin
make dev         # API :8022 + dashboard :3000
        `}</CodeBlock>
        <P>
          Vault is not required for local development — set{" "}
          <code className="font-mono text-xs">VAULT_ENABLED=false</code>.
        </P>

        <H2>Backend conventions</H2>
        <P>
          Follow the package layout described in the Architecture article. Key
          rules:
        </P>
        <UL
          items={[
            "Route registration belongs in the package routes.go — never inline in server.go",
            "Use pkg.RespondOK / pkg.RespondErr / pkg.RespondMessage for all HTTP responses",
            "Return typed sentinel errors from services (ErrNotFound, ErrAlreadyExists) and map them to HTTP codes in handlers",
            "All models embed models.Base (UUID primary key, CreatedAt, UpdatedAt, DeletedAt soft delete)",
            "Never use integer auto-increment IDs",
          ]}
        />
        <P>Vault token paths follow this convention:</P>
        <CodeBlock>{`
idp/capabilities/{environmentID}/{capabilityName}/{providerName}/token

# Example
idp/capabilities/550e8400.../runtime/nomad/token
        `}</CodeBlock>

        <H2>Frontend conventions</H2>
        <UL
          items={[
            "All API calls go through TanStack Query hooks in src/lib/queries.ts — never call fetch directly in components",
            "All types live in src/lib/types.ts — use exact field names from the Go JSON tags",
            "Routes follow TanStack Router file-based naming: dashboard.environments.$envId.logs.tsx → /dashboard/environments/:envId/logs",
            "Use Tailwind CSS utility classes; follow the dark-mode-first approach with CSS variable tokens",
          ]}
        />
        <CodeBlock>{`
// Query hook pattern
export function useMyResource(slug: string, id: string) {
  return useQuery<MyResource, ApiError>({
    queryKey: ["workspaces", slug, "my-resource", id],
    queryFn:  () => api.get(\`/api/v1/workspaces/\${slug}/my-resource/\${id}\`),
    enabled:  !!slug && !!id,
  });
}
        `}</CodeBlock>

        <H2>Makefile reference</H2>
        <CodeBlock>{`
make dev              # API + admin dashboard
make dev-backend      # Go API only (:8022)
make dev-admin        # Admin dashboard only (:3000)
make dev-site         # Public website only (:4000)

make build            # Build all artifacts
make test             # go test ./...
make fmt              # go fmt + prettier
make lint             # eslint (admin)

make docker-up        # Start Postgres
make docker-down      # Stop all Docker services
make reset-db-dev     # Drop + re-migrate + re-seed (dev only)
        `}</CodeBlock>

        <H2>Pull request guidelines</H2>
        <UL
          items={[
            "Branch from main — use descriptive names: feature/logs-search, fix/nomad-allocation-resolver",
            "Keep backend and frontend changes together when they are coupled",
            "Run make test, make fmt, and cd admin && npm run lint before opening a PR",
            "PR description must include what changed and why, any API contract changes, and how to test manually",
            "Do not amend published commits — push new commits for review feedback",
          ]}
        />
        <Callout title="Database migrations">
          The project uses GORM AutoMigrate. Add or modify fields in models.go —
          the schema updates on next server start. For destructive changes (drop
          column, rename), write a manual migration or use{" "}
          <code className="font-mono text-xs">make reset-db-dev</code> during
          development. Do not write raw SQL migration files.
        </Callout>
      </div>
    ),
  },
];

export type { Article };
