# TernakClouds

An Internal Developer Platform that gives engineering teams a single control plane to deploy services, manage secrets, govern access, and observe infrastructure — across Kubernetes, Nomad, and any runtime.

> **Docs** → [`/docs`](./docs) &nbsp;|&nbsp; **Quick start** → [`docs/getting-started/installation.md`](./docs/getting-started/installation.md)

---

## What is TernakClouds?

TernakClouds is a self-hosted IDP designed for platform engineering teams who need to abstract runtime complexity from application developers. Instead of giving developers direct access to `kubectl`, Nomad CLIs, or infrastructure dashboards, TernakClouds centralizes all platform operations behind a clean, permission-controlled interface.

Developers get:

- A single place to deploy, restart, and inspect workloads
- Centralized log streaming across runtimes
- Secret access without touching Vault directly
- Self-service workspace access requests

Platform engineers get:

- Multi-runtime abstractions (Kubernetes and Nomad today; extensible)
- Capability-based provider binding per environment
- RBAC with two independent authorization layers
- Vault-backed credential management

---

## Features

| Area | Capabilities |
|---|---|
| **Runtime management** | Kubernetes and Nomad via provider abstraction; workload inspection, scaling, restarts |
| **Deployments** | Service deployments across environments, rollout tracking, job management |
| **Service catalog** | Deployable service templates that developers can self-serve |
| **Logs platform** | Centralized runtime log streaming (Loki-backed); search, filter, live tail |
| **Secrets** | Vault-backed secret grants; environment-scoped RBAC |
| **Registries** | Container registry management, workspace and environment scoped |
| **Access control** | Platform RBAC (admin/manager/developer/viewer) + workspace ownership model |
| **Access requests** | Self-service workspace access request workflow with admin approval |
| **Multi-tenancy** | Isolated workspaces, each with their own environments, members, and capabilities |

---

## Architecture

```
┌──────────────────────┐     ┌──────────────────────┐
│  Public website      │     │  Admin dashboard     │
│  :4000               │     │  :3000               │
└──────────────────────┘     └──────────┬───────────┘
                                         │ /api/*
                                         ▼
                              ┌──────────────────────┐
                              │  Go/Gin REST API      │
                              │  :8022                │
                              └──────────┬───────────┘
                                         │
                        ┌────────────────┼────────────────┐
                        ▼                ▼                ▼
                   ┌─────────┐    ┌──────────┐    ┌──────────┐
                   │Postgres │    │  Vault   │    │ Runtime  │
                   │  :5432  │    │  :8200   │    │ Clusters │
                   └─────────┘    └──────────┘    └──────────┘
```

The API is stateless. All platform state lives in PostgreSQL. Provider credentials (tokens, keys) are stored exclusively in Vault KV v2 and never persisted to the database.

See [`docs/architecture/overview.md`](./docs/architecture/overview.md) for a full breakdown.

---

## Core Concepts

**Workspace** — An isolated tenant. Each workspace has its own environments, members, and capability bindings.

**Environment** — A named deployment target within a workspace (e.g. `dev`, `staging`, `production`).

**Capability** — A platform service type (`runtime`, `secrets`, `logs`, `networking`, `storage`). Each environment binds one or more providers per capability.

**Provider** — A concrete implementation of a capability (e.g. Nomad for `runtime`, Loki for `logs`, Vault for `secrets`). Providers are bound per-environment and configured with an endpoint and optional credentials.

**Platform role** — Global RBAC role (`admin`, `manager`, `developer`, `viewer`) that controls what a user can do across the platform.

**Workspace role** — Membership-scoped role (`owner`, `member`) that controls what a user can do within a specific workspace.

---

## Monorepo Structure

```
idp/
├── server/          Go/Gin REST API backend
├── admin/           Admin dashboard (TanStack Start + React)
├── src/             Public website (Vite + React)
├── docs/            Platform documentation
├── docker-compose.yml
└── Makefile
```

> The repo root **is** the public website. `make dev-site` starts it on `:4000`.

---

## Quick Start

```bash
# 1. Clone
git clone <repo-url> idp && cd idp

# 2. Configure
cp server/.env.example server/.env   # edit DB credentials + JWT_SECRET
cp admin/.env.example admin/.env

# 3. Start infrastructure
make docker-up

# 4. Install dependencies + start
make install && make dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `server/.env`.

Full setup guide: [`docs/getting-started/installation.md`](./docs/getting-started/installation.md)

---

## Documentation

| Guide | Description |
|---|---|
| [Introduction](./docs/introduction/overview.md) | Platform overview and design philosophy |
| [Architecture](./docs/architecture/overview.md) | System components, request flows, data model |
| [Installation](./docs/getting-started/installation.md) | Prerequisites, configuration, first run |
| [Runtimes](./docs/runtimes/overview.md) | Kubernetes and Nomad provider abstractions |
| [Logs platform](./docs/logs/overview.md) | Centralized log streaming, Loki integration |
| [Authentication & RBAC](./docs/authentication/rbac.md) | Auth model, roles, permission system |
| [Contributing](./docs/contributing/guide.md) | Development setup, code standards, PR workflow |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.22, Gin, GORM, PostgreSQL 16 |
| Frontend | React, TanStack Start, TanStack Query, Tailwind CSS |
| Secrets | HashiCorp Vault (KV v2, AppRole auth) |
| Runtimes | Kubernetes (via API server), Nomad (via HTTP API) |
| Logs | Loki (provider-backed streaming) |

---

## Contributing

See [`docs/contributing/guide.md`](./docs/contributing/guide.md).

```bash
make test   # run Go tests
make fmt    # format Go + frontend code
make lint   # run linters
```

---

## License

[MIT](./LICENSE)
