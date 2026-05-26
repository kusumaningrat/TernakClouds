# Architecture Overview

---

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│                                                             │
│   ┌─────────────────────┐   ┌─────────────────────────┐    │
│   │   Admin Dashboard   │   │    Public Website        │    │
│   │   TanStack + React  │   │    Vite + React          │    │
│   │   :3000             │   │    :4000                 │    │
│   └──────────┬──────────┘   └─────────────────────────┘    │
└──────────────┼──────────────────────────────────────────────┘
               │ /api/* (Bearer JWT)
               ▼
┌─────────────────────────────────────────────────────────────┐
│                       API Layer                             │
│                                                             │
│               Go / Gin REST API   :8022                     │
│               JWT auth middleware                           │
│               Permission + workspace resolvers              │
└──────────────┬──────────────────────────────────────────────┘
               │
   ┌───────────┼───────────────────────────┐
   ▼           ▼                           ▼
┌──────┐  ┌─────────┐       ┌─────────────────────────────┐
│  PG  │  │  Vault  │       │       Runtime Clusters       │
│:5432 │  │  :8200  │       │                             │
└──────┘  └─────────┘       │  ┌─────────┐  ┌─────────┐  │
                             │  │   K8s   │  │  Nomad  │  │
Platform state               │  │ API Srvr│  │  :4646  │  │
(users, workspaces,          │  └─────────┘  └─────────┘  │
 environments,               └─────────────────────────────┘
 capabilities,
 bindings)       Credentials only               Proxied through
                 (never in PG)                  backend — never
                                                exposed to client
```

---

## Repository Structure

```
idp/
├── server/                 Go REST API
│   ├── cmd/
│   │   ├── api/            Main entrypoint
│   │   └── reset-db/       Dev utility (drop + re-migrate + seed)
│   ├── internal/           21 domain packages
│   └── pkg/                Shared utilities (JWT, responses, pagination)
│
├── admin/                  Admin dashboard
│   └── src/
│       ├── routes/         52 route files (TanStack file-based routing)
│       ├── components/     Shared UI components
│       └── lib/            API queries, types, auth helpers
│
├── src/                    Public website (Vite + React)
├── docs/                   Platform documentation
├── docker-compose.yml
└── Makefile
```

---

## Backend Package Map

The Go backend is organized around domain packages under `internal/`. Each package owns its own models, handlers, service logic, and repository.

```
internal/
├── accessrequest/    Self-service workspace access request workflow
├── auth/             JWT login/logout/refresh, /me endpoint
├── bootstrap/        Startup sequencing: migrate → seed → serve
├── capability/       Capability catalogue + per-environment provider bindings
├── config/           Environment variable loading (godotenv)
├── database/         GORM setup, AutoMigrate, seed data
├── department/       Organizational department CRUD
├── environment/      Workspace-scoped environment CRUD
├── kubernetes/       Kubernetes cluster proxy (pods, deployments, namespaces)
├── middleware/       JWT auth, RBAC checks, workspace/environment resolvers
├── models/           Shared Base (UUID PK, soft delete, timestamps)
├── nomad/            Nomad cluster proxy (jobs, allocations, nodes, logs)
├── providers/        Provider catalogue metadata (seeded at startup)
├── registry/         Container registry management
├── role/             Platform RBAC — role definitions and permission checks
├── secret/           Vault-backed secret grants and environment access
├── server/           Gin router wiring and middleware composition
├── servicecatalog/   Service deployment templates + execution
├── user/             User CRUD, role assignment, refresh tokens
├── vault/            Vault AppRole HTTP client (KV v2)
└── workspace/        Workspace and membership management
```

---

## Request Flow

### Authentication

```
Client
  │  POST /api/v1/auth/login {email, password}
  ▼
auth.Handler.Login
  │  Verifies password (bcrypt)
  │  Issues access token (15m JWT) + refresh token (168h, stored in DB)
  ▼
Client stores tokens in localStorage
  │
  │  Subsequent requests: Authorization: Bearer <access_token>
  ▼
middleware.RequireAuth
  │  Validates JWT signature + expiry
  │  Sets user_id in Gin context
  ▼
Handler
```

### Capability binding (provider configuration)

```
Client
  │  POST /capabilities/runtime/provider
  │  {provider_name: "nomad", endpoint: "...", token: "..."}
  ▼
middleware.RequireAuth
  │
middleware.RequirePermission("environments:write")   ← platform role check
  │
middleware.RequireWorkspaceOwner                     ← workspace role check
  │
capability.Handler.BindProvider
  │
capability.Service.BindProvider
  │  1. Validates capability exists in catalogue
  │  2. Upserts CapabilityBinding row (env ↔ capability)
  │  3. If token provided: vault.StoreToken(path, token)
  │     path = idp/capabilities/{envID}/{cap}/{providerName}/token
  │  4. Creates ProviderConfig row (endpoint, region, namespace, vaultPath)
  ▼
Returns updated capability status (no token in response)
```

### Runtime log streaming

```
Client
  │  GET /kubernetes/pods/{ns}/{name}/logs?container=app&follow=true
  │  Authorization: Bearer <token>
  ▼
middleware.RequireAuth + middleware.RequireWorkspaceMember
  │
kubernetes.Handler.StreamPodLogs
  │
kubernetes.Service.StreamPodLogs
  │  1. Retrieves cluster token from Vault
  │  2. Opens streaming request to Kubernetes API server
  │     GET /api/v1/namespaces/{ns}/pods/{name}/log?follow=true
  │  3. Reads line-by-line with bufio.Scanner
  ▼
SSE stream → Client
  event: connected
  event: log
  data: <log line>
```

---

## Data Model

```
User ──────────────────── RefreshToken (1:N)
 │
 ├── UserRole (M:N) ────── Role ─── Permission
 │
 └── WorkspaceMember (M:N) ── Workspace
                                 │
                                 └── Environment (1:N)
                                       │
                                       └── CapabilityBinding (1:N per capability)
                                             │
                                             └── ProviderConfig (1:N)
                                                   │
                                                   └── (VaultPath → Vault KV)
```

**Key invariants:**

- One `CapabilityBinding` per `(environment_id, capability_name)` pair (unique index)
- One `ProviderConfig` per `(capability_binding_id, provider_name)` pair (unique index)
- `ProviderConfig.VaultPath` is never returned in API responses
- Soft deletes on all entities (GORM `DeletedAt`)

---

## Authorization Model

Two independent layers must both pass for sensitive operations:

```
Request
  │
  ├── Layer 1: Platform RBAC
  │   middleware.RequirePermission("environments:write")
  │   Checks: user has role with this permission globally
  │
  └── Layer 2: Workspace ownership
      middleware.RequireWorkspaceOwner
      Checks: user is an owner of this specific workspace

Both must pass → handler runs
Either fails → 403 Forbidden
```

This means a `developer` role user who is set as workspace owner **still cannot** bind capability providers — they lack `environments:write`. And an `admin` who is not a workspace member cannot modify workspace resources — they lack workspace ownership.

---

## Streaming Architecture

Log streaming uses Server-Sent Events (SSE) over HTTP. The backend acts as a proxy:

```
Browser
  │  fetch(url, {signal: abortController.signal})
  │  reads response body as stream
  ▼
Backend SSE handler
  │  sets Content-Type: text/event-stream
  │  opens streaming connection to runtime (K8s or Nomad)
  │  reads frames/lines and re-emits as SSE events
  │
  │  event: connected
  │  data: {}
  │
  │  event: log
  │  data: <line>
  │
  │  event: error
  │  data: <message>
  ▼
Browser EventSource parser
  │  dispatches to React state → rendered in terminal
```

The abort signal from the browser propagates as context cancellation in Go, closing the upstream runtime connection cleanly.

---

## Vault Integration

```
BindProvider (write path)
  │
  vault.StoreToken(ctx, path, token)
  │  PUT {vault}/v1/{mount}/data/{path}
  │  {"data": {"token": "<value>"}}

VerifyProvider / StreamLogs (read path)
  │
  vault.RetrieveToken(ctx, path)
  │  GET {vault}/v1/{mount}/data/{path}
  │  → credentials["token"]

UnbindProvider (delete path)
  │
  vault.DeleteToken(ctx, path)
  │  DELETE {vault}/v1/{mount}/metadata/{path}
```

When `VAULT_ENABLED=false`, all Vault calls are no-ops. Token fields in API requests are accepted but silently discarded. This allows running TernakClouds in development without a Vault cluster.
