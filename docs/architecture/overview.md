# Architecture Overview

---

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│                                                             │
│   ┌─────────────────────┐   ┌─────────────────────────┐    │
│   │   Admin Dashboard   │   │    Public Docs Site      │    │
│   │   TanStack + React  │   │    Docusaurus            │    │
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
   ┌───────────┼────────────────────────────────┐
   ▼           ▼                                ▼
┌──────┐  ┌─────────┐       ┌──────────────────────────────────┐
│  PG  │  │  Vault  │       │         Runtime Clusters          │
│:5432 │  │  :8200  │       │                                  │
└──────┘  └─────────┘       │  ┌───────┐ ┌───────┐ ┌────────┐ │
                             │  │  K8s  │ │ Nomad │ │ Docker │ │
Platform state               │  │  API  │ │ :4646 │ │ daemon │ │
(users, workspaces,          │  └───────┘ └───────┘ └────────┘ │
 environments,               └──────────────────────────────────┘
 capabilities,
 bindings,                   Credentials only         Proxied through
 blueprints,                 (never in PG)            backend — never
 deployments)                                         exposed to client
```

---

## Repository Structure

```
TernakClouds/
├── backend/                Go REST API
│   ├── cmd/
│   │   ├── api/            Main entrypoint
│   │   └── reset-db/       Dev utility (drop + re-migrate + seed)
│   ├── internal/           Domain packages
│   └── pkg/                Shared utilities (JWT, responses, pagination)
│
├── ui/                     Admin dashboard (TanStack Start + React)
│   └── src/
│       ├── routes/         File-based routing (TanStack Router)
│       ├── modules/        Feature modules (runtime, capabilities, deployments…)
│       ├── components/     Shared UI components
│       └── lib/            API client, auth helpers, workspace context
│
├── docs-site/              Public documentation site (Docusaurus)
│   └── src/
│       ├── pages/          Landing page
│       └── css/            Custom theme
│
├── docs/                   Documentation source (Markdown)
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
├── blueprint/        Reusable deployment templates (system + custom)
├── bootstrap/        Startup sequencing: migrate → seed → serve
├── capability/       Capability catalogue + per-environment provider bindings
├── config/           Environment variable loading (godotenv)
├── database/         GORM setup, AutoMigrate, seed data
├── department/       Organizational department CRUD
├── docker/           Docker daemon proxy (containers, images, networks, volumes)
├── environment/      Workspace-scoped environment CRUD
├── generator/        Multi-runtime manifest generators (K8s YAML, Nomad HCL, Docker, CI/CD)
├── kubernetes/       Kubernetes cluster proxy (pods, deployments, namespaces)
├── middleware/       JWT auth, RBAC checks, workspace/environment resolvers
├── models/           Shared base model (UUID PK, soft delete, timestamps)
├── nomad/            Nomad cluster proxy (jobs, allocations, nodes, logs)
├── platformapp/      Blueprint-based application provisioning + lifecycle
├── providers/        Concrete provider implementations
│   ├── registry/     DockerHub, GCR, Harbor, GHCR, ECR
│   └── repository/   GitHub, GitLab (self-hosted supported)
├── registry/         Registry management (workspace + environment binding)
├── repository/       SCM provider management + repo browser
├── role/             Platform RBAC — role definitions and permission checks
├── runtime/          Runtime abstraction and log streaming coordination
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

### Blueprint deployment (Platform Application provisioning)

```
Client
  │  POST /platform-apps
  │  {blueprint_id, runtime, workspace_id, environment_id, ...}
  ▼
platformapp.Handler.Provision
  │
platformapp.Service.Provision
  │  1. Loads blueprint spec
  │  2. Calls generator.Generate(spec, runtime)
  │     → renders Nomad HCL, Kubernetes YAML, or Docker compose
  │  3. Stores manifest + PlatformApp row (status: pending)
  │  4. If repo provider configured:
  │     a. Commits manifest to repository
  │     b. Opens pull request
  │  5. Updates status: provisioned
  ▼
Returns PlatformApp with generated manifest
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

The same SSE pattern applies to Nomad allocation logs and Docker container logs.

---

## Data Model

```
User ──────────────────── RefreshToken (1:N)
 │
 ├── UserRole (M:N) ────── Role ─── Permission
 │
 └── WorkspaceMember (M:N) ── Workspace
                                 │
                                 ├── RegistryProvider (1:N)
                                 │     └── RegistryBinding (per Environment)
                                 │
                                 ├── RepoProvider (1:N)
                                 │
                                 ├── Blueprint (1:N, custom)
                                 │
                                 └── Environment (1:N)
                                       │
                                       ├── CapabilityBinding (1:N per capability)
                                       │     └── ProviderConfig (1:N)
                                       │           └── (VaultPath → Vault KV)
                                       │
                                       ├── SecretGrant (1:N)
                                       │
                                       ├── ServiceDeployment (1:N)
                                       │
                                       └── PlatformApp (1:N)
                                             ├── Blueprint (ref)
                                             └── DeploymentRecord (1:N)
```

**Key invariants:**

- One `CapabilityBinding` per `(environment_id, capability_name)` pair (unique index)
- One `ProviderConfig` per `(capability_binding_id, provider_name)` pair (unique index)
- `ProviderConfig.VaultPath` is never returned in API responses
- `RepoProvider` tokens stored in Vault; DB stores only path
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
  │  opens streaming connection to runtime (K8s, Nomad, or Docker)
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
BindProvider / StoreRepoToken / StoreRegistryCredential (write path)
  │
  vault.StoreToken(ctx, path, token)
  │  PUT {vault}/v1/{mount}/data/{path}
  │  {"data": {"token": "<value>"}}

VerifyProvider / StreamLogs / RepoAccess (read path)
  │
  vault.RetrieveToken(ctx, path)
  │  GET {vault}/v1/{mount}/data/{path}
  │  → credentials["token"]

UnbindProvider / RemoveRepo (delete path)
  │
  vault.DeleteToken(ctx, path)
  │  DELETE {vault}/v1/{mount}/metadata/{path}
```

Vault paths follow a consistent scheme:

| Resource | Path |
|---|---|
| Runtime provider credential | `idp/capabilities/{envID}/{capability}/{provider}/token` |
| Registry credential | `idp/registries/{workspaceID}/{registryID}/token` |
| Repository PAT | `idp/repositories/{workspaceID}/{repoID}/token` |
| User secret grant | `idp/secrets/{envID}/{grantName}` |

When `VAULT_ENABLED=false`, all Vault calls are no-ops. Token fields in API requests are accepted but silently discarded. This allows running TernakClouds in development without a Vault cluster.

---

## Infrastructure Provider Support

### Container Registries

| Provider | Package |
|---|---|
| Docker Hub | `providers/registry/dockerhub` |
| Google Container Registry (GCR) | `providers/registry/gcr` |
| GitHub Container Registry (GHCR) | `providers/registry/ghcr` |
| AWS Elastic Container Registry (ECR) | `providers/registry/ecr` |
| Harbor | `providers/registry/harbor` |

### Source Control

| Provider | Package | Notes |
|---|---|---|
| GitHub | `providers/repository/github` | github.com |
| GitLab | `providers/repository/gitlab` | Cloud + self-hosted (`base_url`) |

### Runtimes

| Provider | Package | Capabilities |
|---|---|---|
| Kubernetes | `kubernetes/` | Pods, deployments, services, namespaces, scaling |
| HashiCorp Nomad | `nomad/` | Jobs, allocations, nodes, namespaces, evaluations |
| Docker | `docker/` | Containers, images, networks, volumes |
