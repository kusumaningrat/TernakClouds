# ForgeIDP — Backend

REST API for the Internal Developer Platform. Built with Go, Gin, GORM, and PostgreSQL. Provides workspace-scoped environments, capability-based infrastructure bindings, role-based access control, and a self-service workspace access request workflow.

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Database](#database)
- [API Overview](#api-overview)
- [Domain Packages](#domain-packages)
- [Access Control](#access-control)
- [Vault Integration](#vault-integration)
- [Running with Docker](#running-with-docker)

---

## Architecture

```
cmd/
  api/          — main entrypoint (HTTP server)
  reset-db/     — dev utility: drop + re-migrate + seed

internal/
  accessrequest/  — self-service access request workflow
  auth/           — JWT login/logout/refresh + /me endpoint
  bootstrap/      — startup sequencing (migrate, seed)
  capability/     — capability catalogue + per-env provider bindings
  config/         — env-var configuration
  database/       — GORM connect, AutoMigrate, seed data
  department/     — org department CRUD
  environment/    — workspace-scoped environment CRUD
  integration/    — generic workspace integrations
  middleware/     — JWT auth, permission, workspace + environment resolvers
  models/         — shared Base model (UUID PK, soft delete)
  nomad/          — Nomad cluster proxy (jobs, allocations, nodes)
  role/           — platform roles + permissions RBAC
  secret/         — Vault-backed secret grants
  server/         — Gin router wiring
  user/           — user CRUD + refresh tokens
  vault/          — Vault AppRole client (KV v2)
  workspace/      — workspace + membership management

pkg/
  jwt/            — token sign/verify
  response.go     — RespondOK / RespondErr helpers
  pagination.go   — page/limit query parsing
```

The server is stateless; all persistent state lives in PostgreSQL. Provider credentials (Nomad tokens, Vault tokens) are stored only in Vault KV v2 and never in the database.

---

## Prerequisites

| Tool            | Version          |
| --------------- | ---------------- |
| Go              | 1.21+            |
| PostgreSQL      | 15+              |
| HashiCorp Vault | 1.14+ (optional) |

---

## Quick Start

```bash
# 1. Clone and enter
git clone https://github.com/kusumaningrat/idp-backend
cd idp-backend

# 2. Start vault instance
docker compose -f docker-compose-vault.yml up -d

# 3. Init vault keys
export VAULT_ADDR=<vault_addr>
export VAULT_TOKEN=<vault_root_token>
vault status

vault operator init # save the unseal and root keys

# 4. Create vault policy with AppRole
vault auth enable approle
vault secrets enable -path=secret -version=2 kv

# Copy vault-policy-example.hcl in your local

vault policy write 'idp' 'policy.hcl'

# Generate Role & Secret ID
vault read auth/approle/role/idp/role-id
vault write -f auth/approle/role/idp/secret-id

# 5. Copy and edit environment
cp .env.example .env   # edit DB_PASSWORD, JWT_SECRET, ADMIN_PASSWORD, VAULT_ROLE_ID, VAULT_SECRET_ID

# 6. Start PostgreSQL (or use docker-compose)
docker compose up postgres -d

# 7. Run the API
make run
# Server starts on :8022 by default
```

---

## Configuration

All configuration is loaded from environment variables (or a `.env` file in the working directory).

| Variable             | Default                   | Description              |
| -------------------- | ------------------------- | ------------------------ |
| `SERVER_PORT`        | `8022`                    | HTTP listen port         |
| `GIN_MODE`           | `release`                 | `debug` or `release`     |
| `DB_HOST`            | `localhost`               | PostgreSQL host          |
| `DB_PORT`            | `5432`                    | PostgreSQL port          |
| `DB_USER`            | `postgres`                | PostgreSQL user          |
| `DB_PASSWORD`        | _(empty)_                 | PostgreSQL password      |
| `DB_NAME`            | `idp_platform`            | Database name            |
| `DB_SSLMODE`         | `disable`                 | `disable` / `require`    |
| `JWT_SECRET`         | `change-me-in-production` | HMAC-SHA256 signing key  |
| `JWT_ACCESS_EXPIRY`  | `15m`                     | Access token TTL         |
| `JWT_REFRESH_EXPIRY` | `168h`                    | Refresh token TTL        |
| `ADMIN_EMAIL`        | `admin@idp.local`         | Bootstrap admin email    |
| `ADMIN_PASSWORD`     | `Admin@12345`             | Bootstrap admin password |
| `VAULT_ENABLED`      | `false`                   | Enable Vault integration |
| `VAULT_ADDR`         | `http://localhost:8200`   | Vault server address     |
| `VAULT_ROLE_ID`      | _(empty)_                 | AppRole role ID          |
| `VAULT_SECRET_ID`    | _(empty)_                 | AppRole secret ID        |
| `VAULT_KV_MOUNT`     | `secret`                  | KV v2 mount path         |

---

## Database

### Migrate and seed

On first start the server auto-migrates and seeds the database with:

- Default permissions and roles (admin, manager, developer, viewer)
- Bootstrap admin user (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- Capability catalogue (runtime, secrets, networking, observability, storage)
- Provider catalogue (Nomad, Kubernetes, Vault, Consul, Prometheus, MinIO)
- A default **Platform** workspace with dev / staging / production environments (owned by the admin)

### Reset for development

```bash
make reset-db-dev
# or
go run ./cmd/reset-db
```

This drops all tables, re-runs migrations, and re-seeds. Safe to run repeatedly during development.

---

## API Overview

All protected routes require `Authorization: Bearer <access_token>`.

### Auth

| Method | Path                    | Description                           |
| ------ | ----------------------- | ------------------------------------- |
| POST   | `/api/v1/auth/register` | Register a new user                   |
| POST   | `/api/v1/auth/login`    | Login → access + refresh tokens       |
| POST   | `/api/v1/auth/refresh`  | Rotate access token via refresh token |
| POST   | `/api/v1/auth/logout`   | Revoke refresh token                  |
| GET    | `/api/v1/auth/me`       | Current user profile + roles          |

### Users

| Method | Path                              | Permission     |
| ------ | --------------------------------- | -------------- |
| GET    | `/api/v1/users`                   | `users:read`   |
| GET    | `/api/v1/users/:id`               | `users:read`   |
| GET    | `/api/v1/users/:id/roles`         | `users:read`   |
| POST   | `/api/v1/users/:id/roles`         | `roles:assign` |
| DELETE | `/api/v1/users/:id/roles/:roleId` | `roles:assign` |

### Workspaces

| Method | Path                                       | Guard                                                                     |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------- |
| GET    | `/api/v1/workspaces`                       | Authenticated — admins/managers see all; developers/viewers see their own |
| GET    | `/api/v1/workspaces/mine`                  | Authenticated — always returns caller's memberships only                  |
| GET    | `/api/v1/workspaces/directory`             | Authenticated — lightweight list for access request picker                |
| POST   | `/api/v1/workspaces`                       | Authenticated                                                             |
| GET    | `/api/v1/workspaces/:slug`                 | Workspace member                                                          |
| PUT    | `/api/v1/workspaces/:slug`                 | Workspace owner                                                           |
| DELETE | `/api/v1/workspaces/:slug`                 | Workspace owner                                                           |
| GET    | `/api/v1/workspaces/:slug/members`         | Workspace member                                                          |
| POST   | `/api/v1/workspaces/:slug/members`         | Workspace owner                                                           |
| DELETE | `/api/v1/workspaces/:slug/members/:userId` | Workspace owner                                                           |

### Environments

| Method | Path                                             | Guard            |
| ------ | ------------------------------------------------ | ---------------- |
| GET    | `/api/v1/workspaces/:slug/environments`          | Workspace member |
| POST   | `/api/v1/workspaces/:slug/environments`          | Workspace owner  |
| GET    | `/api/v1/workspaces/:slug/environments/:envSlug` | Workspace member |
| PUT    | `/api/v1/workspaces/:slug/environments/:envSlug` | Workspace owner  |
| DELETE | `/api/v1/workspaces/:slug/environments/:envSlug` | Workspace owner  |

### Capabilities (Platform Configuration)

Capability mutations require **both** `environments:write` platform permission **and** workspace ownership. Developer and viewer roles cannot configure capabilities regardless of workspace role.

| Method | Path                                                                                    | Description                             |
| ------ | --------------------------------------------------------------------------------------- | --------------------------------------- |
| GET    | `/api/v1/workspaces/:slug/environments/:envSlug/capabilities`                           | List all capabilities + bound providers |
| GET    | `/api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap`                      | Single capability status                |
| GET    | `/api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/providers`            | Available providers for capability      |
| POST   | `/api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/provider`             | Bind a provider                         |
| PUT    | `/api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/provider/:providerID` | Update provider config                  |
| DELETE | `/api/v1/workspaces/:slug/environments/:envSlug/capabilities/:cap/provider/:providerID` | Unbind provider                         |

Supported capability names: `runtime`, `secrets`, `networking`, `observability`, `storage`.

### Access Requests

| Method | Path                                  | Guard                                |
| ------ | ------------------------------------- | ------------------------------------ |
| POST   | `/api/v1/access-requests`             | Any authenticated user               |
| GET    | `/api/v1/access-requests/mine`        | Any authenticated user               |
| GET    | `/api/v1/access-requests`             | `workspaces:write` (admin / manager) |
| PUT    | `/api/v1/access-requests/:id/approve` | `workspaces:write`                   |
| PUT    | `/api/v1/access-requests/:id/deny`    | `workspaces:write`                   |

### Roles & Departments

| Method | Path                      | Permission           |
| ------ | ------------------------- | -------------------- |
| GET    | `/api/v1/roles`           | Authenticated        |
| GET    | `/api/v1/departments`     | Authenticated        |
| POST   | `/api/v1/departments`     | `departments:write`  |
| PUT    | `/api/v1/departments/:id` | `departments:write`  |
| DELETE | `/api/v1/departments/:id` | `departments:delete` |

---

## Domain Packages

### `capability`

Five built-in capabilities (runtime, secrets, networking, observability, storage) map to a catalogue of providers (Nomad, Kubernetes, Vault, Consul, Prometheus, MinIO). Each environment can bind **multiple providers per capability** via `CapabilityBinding → []ProviderConfig`. Provider credentials are stored in Vault KV v2; only metadata lives in PostgreSQL.

### `accessrequest`

Workflow: user submits a request → admin approves/denies → approval automatically adds the user as a workspace member. Prevents duplicate pending requests per workspace. Stores the requested platform role for admin reference.

### `workspace`

Workspaces are isolated tenants. The creator becomes the owner. Workspace-level roles (`owner` / `member`) are separate from platform-level roles (`admin`, `manager`, `developer`, `viewer`). Default environments (`dev`, `staging`, `production`) are seeded automatically on workspace creation.

---

## Access Control

The platform uses two independent authorization layers:

**Platform roles** (global RBAC via `role` package):

| Role      | Key permissions                                            |
| --------- | ---------------------------------------------------------- |
| admin     | Everything                                                 |
| manager   | Users, workspaces, environments, integrations              |
| developer | Read + deployments; cannot configure platform capabilities |
| viewer    | Read-only                                                  |

**Workspace roles** (membership-scoped):

| Role   | Capability                                                               |
| ------ | ------------------------------------------------------------------------ |
| owner  | Full control over workspace — members, environments, capability bindings |
| member | Read access within the workspace                                         |

Capability mutations require **both** a platform permission (`environments:write`) **and** workspace ownership. This means a developer who happens to be set as workspace owner still cannot bind providers.

---

## Vault Integration

When `VAULT_ENABLED=true`, the server authenticates to Vault using AppRole. Provider tokens (Nomad ACL tokens, Vault tokens) are stored at `<mount>/<path>` in KV v2 during `BindProvider` and rotated on `UpdateProvider`. The path is referenced in `ProviderConfig.VaultPath` (not exposed in API responses).

When Vault is disabled (default), the capability endpoints still work but token storage is a no-op — useful for local development without a Vault cluster.

---

## Running with Docker

```bash
# Build and start everything (app + postgres)
make up

# Or individually
docker compose up --build

# Stop
make down
```

The Docker image uses a two-stage build: Go builder → minimal Alpine runtime. Final image is ~15 MB.

---

## Development Commands

```bash
make run          # go run ./cmd/api
make build        # go build -o bin/api ./cmd/api
make reset-db-dev # drop + re-migrate + seed (dev only)
make fmt          # go fmt ./...
make test         # go test ./...
```
