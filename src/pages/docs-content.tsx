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
        <H2>What is TernakClouds IDP?</H2>
        <P>
          TernakClouds IDP (Internal Developer Platform) is a centralized
          developer control plane designed to standardize application delivery,
          infrastructure access, and operational workflows across environments
          and runtime providers.
        </P>
        <P>The platform provides a unified, auditable interface for:</P>
        <UL
          items={[
            "Authentication and access control",
            "Workspace and environment isolation",
            "Runtime orchestration (Nomad, Kubernetes, and future providers)",
            "Service lifecycle management",
            "Deployment automation",
            "Secrets and registry integrations",
            "Centralized observability and operational visibility",
          ]}
        />
        <P>
          Instead of relying on scattered scripts, manually managed
          infrastructure access, runtime-specific tooling, and inconsistent
          deployment workflows, TernakClouds enables teams to operate through a
          governed self-service platform with reusable templates, policy
          enforcement, and provider-agnostic abstractions.
        </P>

        <H2>Platform principles</H2>
        <P>The platform is built around:</P>
        <UL
          items={[
            "Environment-scoped infrastructure",
            "Service-centric operations",
            "Runtime abstraction",
            "Deployment standardization",
            "Centralized observability",
            "Extensible provider integrations",
          ]}
        />
        <P>
          This allows organizations to scale developer operations without
          tightly coupling workflows to specific infrastructure technologies.
        </P>

        <H2>Architecture overview</H2>
        <CodeBlock>{`
┌─────────────────────────────────────┐
│          IDP Frontend (this app)    │
│   React 19 · TanStack Router        │
└──────────────┬──────────────────────┘
               │ REST / JWT
┌──────────────▼──────────────────────┐
│           IDP Backend               │
│   Go · Chi router · PostgreSQL      │
│   JWT auth · RBAC middleware        │
└─────────────────────────────────────┘
        `}</CodeBlock>

        <H2>What's covered in these docs</H2>
        <UL
          items={[
            "Getting started: installation, environment setup, and your first login",
            "Authentication: token lifecycle, refresh rotation, and session revocation",
            "RBAC: designing roles, assigning permissions, and department scoping",
            "User management: inviting teammates and managing teams",
            "Deployments: triggering, approving, and rolling back deploys",
            "API reference: full endpoint catalogue with examples",
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
            "Go 1.22+ for the backend service",
            "Node 20+ and pnpm for the frontend",
            "PostgreSQL 15+ for the database",
            "Docker (optional, for local infra)",
          ]}
        />

        <H2>Clone the repositories</H2>
        <CodeBlock>{`
# Backend
git clone https://github.com/ternak-clouds/idp-backend
cd idp-backend

# Frontend (this repo)
git clone https://github.com/ternak-clouds/idp
cd idp
        `}</CodeBlock>

        <H2>Backend setup</H2>
        <P>Copy the example environment file and fill in your values:</P>
        <CodeBlock>{`
cp .env.example .env

# .env
DATABASE_URL=postgres://user:pass@localhost:5432/idp
JWT_ACCESS_SECRET=<random-256-bit-secret>
JWT_REFRESH_SECRET=<different-random-256-bit-secret>
PORT=8080
        `}</CodeBlock>
        <P>Run migrations and start the server:</P>
        <CodeBlock>{`
go run ./cmd/migrate up
go run ./cmd/server
# → listening on :8080
        `}</CodeBlock>

        <H2>Frontend setup</H2>
        <CodeBlock>{`
pnpm install
pnpm dev
# → http://localhost:4000
        `}</CodeBlock>

        <Callout title="Note">
          The frontend expects the backend to be reachable at{" "}
          <code className="font-mono text-xs">http://localhost:8080</code>. You
          can override this with a{" "}
          <code className="font-mono text-xs">VITE_API_URL</code> env variable
          in <code className="font-mono text-xs">.env.local</code>.
        </Callout>

        <H2>Seed a superadmin</H2>
        <P>
          On a fresh database there are no users. Use the seed command to create
          the first superadmin account:
        </P>
        <CodeBlock>{`
go run ./cmd/seed --email admin@ternak.io --password changeme
        `}</CodeBlock>
        <P>
          Log in with those credentials to access the admin console and invite
          your team.
        </P>
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
  "email": "alex@ternak.io",
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
  "email":    "alex@ternak.io",
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
  "email":      "new.dev@ternak.io",
  "department": "payments",
  "role_id":    "rol_01HZ..."   // optional — defaults to "developer"
}

// 201 Created
{
  "invite_id":  "inv_01HZ...",
  "invite_url": "https://idp.ternak.io/accept/inv_01HZ...",
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
      "email":      "new.dev@ternak.io",
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
      "email": "alex@ternak.io",
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
      "actor":      "alex@ternak.io",
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
GET /api/v1/audit?actor=alex@ternak.io

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
];

export type { Article };
