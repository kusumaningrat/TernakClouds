# Authentication & Access Control

---

## Authentication

TernakClouds uses JWT-based authentication with short-lived access tokens and long-lived refresh tokens.

### Token Lifecycle

```
POST /api/v1/auth/login
  → access_token  (15m, JWT signed with JWT_SECRET)
  → refresh_token (168h, stored in database)

Client stores both in localStorage.

On API request:
  Authorization: Bearer <access_token>

When access_token expires:
  POST /api/v1/auth/refresh { refresh_token }
  → new access_token + new refresh_token (rotation)

On logout:
  POST /api/v1/auth/logout { refresh_token }
  → refresh_token deleted from database
  → client clears localStorage
```

Access tokens are stateless JWTs — validated by signature and expiry only, with no database lookup on each request. Refresh tokens are persisted and can be revoked.

### Token Configuration

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | — | HMAC-SHA256 signing key. Use a random 32+ character string. |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | `168h` | Refresh token lifetime (7 days) |

---

## Authorization Layers

TernakClouds uses two independent authorization layers. Both must be satisfied for privileged operations.

### Layer 1: Platform Roles (Global RBAC)

Platform roles are global. They define what a user can do across the entire platform.

| Role | Description |
|---|---|
| `admin` | Full access to everything |
| `manager` | User management, workspace management, environment configuration |
| `developer` | Deploy and operate workloads; cannot configure capabilities |
| `viewer` | Read-only access across all permitted resources |

Roles are backed by a permission system. Each role has a set of named permissions:

| Permission | Description |
|---|---|
| `users:read` | List and view users |
| `users:write` | Create and update users |
| `roles:assign` | Assign and revoke roles |
| `workspaces:read` | View all workspaces |
| `workspaces:write` | Manage workspace membership and access requests |
| `environments:read` | View environments |
| `environments:write` | Configure environment capabilities (bind/unbind providers) |
| `deployments:exec` | Execute deployments and service catalog operations |
| `departments:write` | Create and update departments |
| `departments:delete` | Delete departments |
| `secrets:read` | View secret grants |
| `secrets:write` | Manage secret grants |
| `registries:write` | Manage container registries |

A user can be assigned multiple roles. Permission checks are a union of all assigned roles' permissions.

### Layer 2: Workspace Roles (Membership-Scoped)

Workspace roles are scoped to a specific workspace. They control what a user can do within that workspace.

| Role | Description |
|---|---|
| `owner` | Full control — manage members, configure capabilities, manage environments |
| `member` | Read and operate within the workspace |

A user can have different workspace roles in different workspaces. Platform role and workspace role are independent.

### Combined Authorization

Most operations require **only one layer**:

- Reading workload lists: workspace membership only
- Reading logs: workspace membership only
- Deploying a service: `deployments:exec` platform permission

Sensitive configuration operations require **both layers**:

- Binding a capability provider: `environments:write` platform permission **AND** workspace `owner`
- Updating or removing a provider: same

```
Operation: bind runtime provider
    │
    ├── Check: platform permission environments:write
    │   → admin and manager roles have this
    │   → developer and viewer do NOT
    │
    └── Check: workspace owner
        → user must be owner of this specific workspace
        → being admin globally is not sufficient

Both must pass → operation allowed
```

This two-layer design prevents privilege escalation: an admin cannot modify a workspace they are not an owner of, and a developer who happens to be a workspace owner cannot configure capabilities they lack platform permission for.

---

## Role Assignment

Platform roles are assigned by users with `roles:assign` permission (admin or manager).

**Via dashboard:** Admin → Members → select user → Assign Role

**Via API:**
```
POST /api/v1/users/:id/roles
{ "role_id": "<uuid>" }

DELETE /api/v1/users/:id/roles/:roleId
```

---

## Workspace Membership

### Adding Members

Workspace owners can directly add members:

**Via dashboard:** Workspace → Teams → Add member

**Via API:**
```
POST /api/v1/workspaces/:slug/members
{ "user_id": "<uuid>" }
```

### Self-Service Access Requests

Users who are not workspace members can submit access requests:

1. User navigates to **Request Access** (sidebar, developer/viewer role)
2. Selects a workspace and optionally states a reason
3. Admin or manager reviews the request in **Access Requests**
4. On approval: user is automatically added as a workspace member

```
User submits request
    │
    ▼
POST /api/v1/access-requests
  { workspace_id, requested_role, reason }
    │
    ▼
Admin reviews (GET /api/v1/access-requests)
    │
    ├── Approve → PUT .../approve
    │   → user added as workspace member
    │   → request marked approved
    │
    └── Deny → PUT .../deny
        → request marked denied
```

Duplicate pending requests for the same workspace are rejected.

---

## Seeded Defaults

On first server start, the following are created automatically:

**Roles:**
- `admin` — all permissions
- `manager` — user/workspace/environment management
- `developer` — deployments + read access
- `viewer` — read-only

**Admin user:**
- Email: `ADMIN_EMAIL` env var
- Password: `ADMIN_PASSWORD` env var
- Role: `admin`

**Default workspace:**
- Name: `Platform`
- Environments: `dev`, `staging`, `production`
- Owner: the bootstrap admin user

---

## Security Considerations

- **JWT_SECRET** must be a cryptographically random string of at least 32 characters. Rotate it to invalidate all existing sessions.
- **Refresh tokens** are stored hashed in the database. Rotating the JWT_SECRET does not invalidate refresh tokens; to force all users to re-authenticate, truncate the `refresh_tokens` table.
- **Provider tokens** (Nomad ACL tokens, Kubernetes service account tokens) are stored in Vault KV v2 and never returned in API responses. The database stores only the Vault path.
- When `VAULT_ENABLED=false`, provider tokens submitted via the API are silently discarded. Do not use this in production environments where real runtime credentials are needed.
- CORS is configured to the admin dashboard origin. Do not set `GIN_MODE=debug` in production (it enables verbose logging and loose CORS).
