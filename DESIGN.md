# TernakClouds — Service-Centric IDP Architecture

> Principal Platform Engineer · Product Architect · Backend Architect · Frontend Architect · UX Designer
>
> Start from first principles. Challenge every assumption.

---

## Table of Contents

1. [Product Architecture](#1-product-architecture)
2. [Domain Model](#2-domain-model)
3. [Backend Architecture](#3-backend-architecture)
4. [Database Schema](#4-database-schema)
5. [API Design](#5-api-design)
6. [Frontend Information Architecture](#6-frontend-information-architecture)
7. [Navigation Structure](#7-navigation-structure)
8. [Service Workspace Design](#8-service-workspace-design)
9. [Platform Workspace Design](#9-platform-workspace-design)
10. [Migration Strategy](#10-migration-strategy)
11. [Risks and Tradeoffs](#11-risks-and-tradeoffs)
12. [Recommended MVP](#12-recommended-mvp)

---

## 1. Product Architecture

### Vision

TernakClouds is a **Service-Centric Internal Developer Platform**.

The platform hides infrastructure and exposes one thing: **Services**.

A developer should be able to create, deploy, operate, and observe any service without ever knowing the name of a Kubernetes namespace, a Nomad job ID, or a Vault policy.

### Guiding Principles

| Principle | Description |
|-----------|-------------|
| **Service First** | Every capability is accessed through a Service. Nothing floats at the top level. |
| **Infrastructure Invisible** | Kubernetes, Nomad, Vault, Docker are implementation details. They never appear in developer-facing UI or APIs. |
| **Environment as Context** | Environment (Production, Staging, Dev) is the developer's lens. Runtime is the platform engineer's concern. |
| **Ownership Everywhere** | Every resource has a clear owner team. Orphaned services are a platform smell. |
| **Golden Path by Default** | New services start with sane defaults. Deviation requires explicit intent. |
| **Progressive Disclosure** | Show developers what they need. Reveal complexity only when required. |

### System Boundary

```
┌─────────────────────────────────────────────────────────────┐
│                        TernakClouds                         │
│                                                             │
│  ┌──────────────────┐        ┌──────────────────────────┐  │
│  │  Developer Plane │        │    Platform Plane        │  │
│  │                  │        │                          │  │
│  │  Home            │        │  Runtimes                │  │
│  │  Services        │        │  Environments            │  │
│  │  Teams           │        │  Secret Providers        │  │
│  │  Insights        │        │  Container Registries    │  │
│  │                  │        │  Git Providers           │  │
│  └────────┬─────────┘        └──────────┬───────────────┘  │
│           │                             │                   │
│           └──────────┬──────────────────┘                   │
│                      │                                      │
│              ┌───────▼────────┐                             │
│              │  Service Core  │                             │
│              │                │                             │
│              │  Deployments   │                             │
│              │  Logs          │                             │
│              │  Secrets       │                             │
│              │  Metrics       │                             │
│              │  Dependencies  │                             │
│              │  Health        │                             │
│              └───────┬────────┘                             │
│                      │                                      │
│         ┌────────────┼────────────┐                         │
│         │            │            │                         │
│    ┌────▼───┐  ┌─────▼──┐  ┌────▼────┐                     │
│    │  K8s   │  │ Nomad  │  │  ECS   │  ← Runtime Adapters  │
│    └────────┘  └────────┘  └─────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Domain Model

### Entity Relationship Overview

```
Workspace
├── has many Teams
├── has many Services
├── has many Environments
├── has many Runtimes
└── has many Users (via WorkspaceMembership)

Team
├── belongs to Workspace
├── has many Members (Users)
└── owns many Services

Service  ← PRIMARY ENTITY
├── belongs to Workspace
├── owned by Team
├── has one Repository
├── has many Deployments (per Environment)
├── has many Secrets (per Environment)
├── has many Dependencies (upstream + downstream)
├── has many Runbooks
├── has one Health (computed)
├── has one Readiness (computed)
├── has many CostRecords
└── has many AuditEvents

Environment
├── belongs to Workspace
├── maps to one Runtime
└── has many Deployments (across services)

Runtime
├── belongs to Workspace
├── has type (kubernetes | nomad | ecs | docker | edge)
└── has many Environments

Deployment
├── belongs to Service
├── belongs to Environment
├── records image, version, commit, deployed_by
└── has status (running | pending | failed | stopped | rolled_back)

Secret
├── belongs to Service
├── scoped to Environment
├── stored in SecretProvider (Vault etc.)
└── has key, vault_path, updated_by

Dependency
├── source: Service
├── target: Service | Database | Cache | Queue | ExternalAPI
└── has type (runtime | build | optional)

Repository
├── belongs to Service
├── connected via GitProvider
└── has org, repo, branch, manifest_path

Runbook
├── belongs to Service
└── has title, url, type (incident | deployment | maintenance | oncall)

Health        ← computed, not stored permanently
├── belongs to Service × Environment
├── health_score (0–100)
├── readiness_score (0–100)
├── risk_score (0–100)
└── maturity_score (0–100)

Cost
├── belongs to Service
├── scoped to Environment
└── has period, compute_usd, egress_usd, storage_usd

AuditEvent
├── belongs to Workspace
├── actor: User
├── resource_type + resource_id
└── action, diff_snapshot, created_at

RBAC
├── Role: admin | platform_engineer | developer | viewer
├── scoped to Workspace or Team
└── Permission: resource_type × action
```

### Entity Detail

#### Workspace
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| name | string | Display name |
| slug | string | URL identifier, unique |
| plan | enum | free \| team \| enterprise |
| created_at | timestamp | |
| settings | jsonb | Feature flags, defaults |

**Owns:** Everything. Top-level tenant boundary.

---

#### Team
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → Workspace |
| name | string | |
| slug | string | Unique per workspace |
| description | text | |
| channel | string | Slack/Teams channel |
| oncall_url | string | PagerDuty/OpsGenie rotation |
| created_at | timestamp | |

**Owns:** Members, Services (via ownership assignment).

---

#### Service
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → Workspace |
| team_id | uuid | FK → Team (owner) |
| name | string | Unique per workspace, slug-format |
| display_name | string | Human-readable |
| description | text | |
| type | enum | rest_api \| worker \| cronjob \| frontend \| ai_agent \| mcp_server |
| runtime_class | string | Golden path template key |
| default_resources | jsonb | cpu, memory, replicas |
| status | enum | active \| deprecated \| archived |
| created_at | timestamp | |
| updated_at | timestamp | |

**Owns:** Deployments, Secrets, Dependencies, Runbooks, Health, Cost.
**Owned by:** Team.

---

#### Environment
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → Workspace |
| runtime_id | uuid | FK → Runtime |
| name | string | Production, Staging, etc. |
| slug | string | production, staging, dev |
| tier | enum | production \| staging \| development \| ephemeral |
| auto_deploy | bool | Auto-deploy on branch push |
| created_at | timestamp | |

**Developer-facing.** Maps transparently to a Runtime.

---

#### Runtime
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → Workspace |
| name | string | Display name |
| type | enum | kubernetes \| nomad \| ecs \| docker \| edge |
| status | enum | healthy \| degraded \| unavailable |
| provider_config | jsonb | Encrypted connection config |
| version | string | Runtime version |
| node_count | int | Informational |
| created_at | timestamp | |

**Platform Engineer-facing only.** Developers never see this entity.

---

#### Deployment
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| service_id | uuid | FK → Service |
| environment_id | uuid | FK → Environment |
| status | enum | running \| pending \| failed \| stopped \| rolled_back |
| image | string | Full image URI |
| version | string | Semantic or branch |
| commit | string | Git SHA |
| deployed_by | uuid | FK → User |
| config_snapshot | jsonb | Resources, env vars (non-secret) at deploy time |
| started_at | timestamp | |
| updated_at | timestamp | |
| finished_at | timestamp | nullable |

---

#### Secret
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| service_id | uuid | FK → Service |
| environment_id | uuid | FK → Environment |
| key | string | e.g. DATABASE_URL |
| provider_id | uuid | FK → SecretProvider |
| provider_path | string | Path in Vault/SSM |
| updated_by | uuid | FK → User |
| updated_at | timestamp | |

**Value never stored in TernakClouds DB.** Only the path is stored.

---

#### Dependency
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| source_service_id | uuid | FK → Service |
| target_type | enum | service \| database \| cache \| queue \| external_api |
| target_service_id | uuid | nullable, FK → Service |
| target_name | string | For non-service targets |
| target_url | string | For external APIs |
| dependency_type | enum | runtime \| build \| optional |
| criticality | enum | critical \| high \| low |
| created_at | timestamp | |

---

#### Runbook
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| service_id | uuid | FK → Service |
| title | string | |
| url | string | Confluence/Notion/GitHub link |
| type | enum | incident \| deployment \| maintenance \| oncall |
| created_at | timestamp | |

---

#### Health (computed, cached)
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| service_id | uuid | FK → Service |
| environment_id | uuid | FK → Environment |
| health_score | int | 0–100 |
| readiness_score | int | 0–100 |
| risk_score | int | 0–100 (lower = safer) |
| maturity_score | int | 0–100 |
| factors | jsonb | Per-factor breakdown |
| computed_at | timestamp | TTL: 60s |

---

#### Cost
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| service_id | uuid | FK → Service |
| environment_id | uuid | FK → Environment |
| period_start | date | |
| period_end | date | |
| compute_usd | decimal | |
| egress_usd | decimal | |
| storage_usd | decimal | |
| total_usd | decimal | |
| source | string | billing adapter |

---

#### AuditEvent
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → Workspace |
| actor_id | uuid | FK → User |
| resource_type | string | service, deployment, secret, etc. |
| resource_id | uuid | |
| action | string | created, updated, deployed, deleted |
| diff | jsonb | Before/after snapshot |
| ip_address | string | |
| created_at | timestamp | |

---

## 3. Backend Architecture

### Module Structure

```
internal/
├── service/          ← PRIMARY domain (owns all service lifecycle)
├── deployment/       ← Deployment lifecycle and status sync
├── secret/           ← Secret management (Vault adapter, CRUD)
├── dependency/       ← Dependency graph management
├── health/           ← Health score computation engine
├── metrics/          ← Metrics aggregation and forwarding
├── cost/             ← Cost tracking and allocation
├── team/             ← Team management
├── workspace/        ← Workspace and membership management
├── environment/      ← Environment management
├── runtime/          ← Runtime provider abstraction + adapters
├── repository/       ← Git provider integration
├── runbook/          ← Runbook management
├── rbac/             ← Permission engine
├── audit/            ← Audit event recording
├── event/            ← Internal event bus
├── notification/     ← Alert and notification dispatch
└── api/              ← HTTP handler layer (thin, no business logic)
    ├── middleware/
    ├── handlers/
    └── dto/
```

### Folder Structure

```
.
├── cmd/
│   └── server/          main.go
├── internal/
│   ├── service/
│   │   ├── domain.go    Service entity + value objects
│   │   ├── service.go   Business logic (ServiceService)
│   │   ├── repo.go      Repository interface
│   │   └── events.go    Domain events emitted by this module
│   ├── deployment/
│   │   ├── domain.go
│   │   ├── service.go
│   │   ├── repo.go
│   │   └── sync/        Runtime sync workers (K8s, Nomad)
│   ├── runtime/
│   │   ├── adapter.go   RuntimeAdapter interface
│   │   ├── kubernetes/
│   │   ├── nomad/
│   │   └── ecs/
│   ├── secret/
│   │   ├── domain.go
│   │   ├── service.go
│   │   ├── repo.go
│   │   └── provider/    SecretProvider interface (Vault, SSM, etc.)
│   ├── health/
│   │   ├── scorer.go    Score computation logic
│   │   └── cache.go     TTL cache for health scores
│   ├── rbac/
│   │   ├── policy.go    Permission definitions
│   │   └── enforcer.go  Casbin or custom enforcer
│   ├── event/
│   │   └── bus.go       In-process event bus (pluggable to NATS/Kafka)
│   └── api/
│       ├── router.go
│       ├── middleware/
│       │   ├── auth.go
│       │   ├── rbac.go
│       │   └── audit.go
│       └── handlers/
│           ├── service.go
│           ├── deployment.go
│           ├── secret.go
│           └── ...
├── pkg/
│   ├── pagination/
│   ├── errors/
│   └── id/
└── migrations/
    └── *.sql
```

### Key Architectural Boundaries

**RuntimeAdapter interface** — all runtime-specific logic is isolated behind this interface. Adding ECS or Docker never touches the deployment domain.

```go
type RuntimeAdapter interface {
    Deploy(ctx context.Context, spec DeploySpec) (DeployResult, error)
    Status(ctx context.Context, serviceID, envID string) (DeployStatus, error)
    Logs(ctx context.Context, serviceID, envID string) (io.ReadCloser, error)
    Rollback(ctx context.Context, deployID string) error
    Delete(ctx context.Context, serviceID, envID string) error
}
```

**SecretProvider interface** — Vault, AWS SSM, GCP Secret Manager all implement this.

```go
type SecretProvider interface {
    Write(ctx context.Context, path, key, value string) error
    Read(ctx context.Context, path, key string) (string, error)
    Delete(ctx context.Context, path, key string) error
    ListKeys(ctx context.Context, path string) ([]string, error)
}
```

### Event Model

All significant state changes emit domain events. These drive:
- Audit log recording
- Notification dispatch
- Health score invalidation
- Cost attribution

```
ServiceCreated         { service_id, team_id, created_by }
ServiceDeployed        { service_id, deployment_id, environment_id, deployed_by }
DeploymentStatusChanged { deployment_id, old_status, new_status }
DeploymentFailed       { deployment_id, reason }
SecretUpdated          { service_id, environment_id, key, updated_by }
ServiceHealthDegraded  { service_id, environment_id, score, previous_score }
AccessRequestApproved  { request_id, approved_by }
RuntimeDegraded        { runtime_id, reason }
```

### Permission Model

```
Role             Scope         Capabilities
─────────────────────────────────────────────────────────
admin            workspace     full access to everything
platform_engineer workspace     manage runtimes, environments, providers
                               read all services
developer        team          create/update/deploy own team's services
                               read all services in workspace
viewer           workspace     read-only on all resources
```

Permission checks follow: **workspace membership → team membership → resource ownership**.

A developer on Team A cannot deploy Team B's service unless they have elevated workspace-level access.

### Future Scalability

| Concern | Current | Future Path |
|---------|---------|-------------|
| Event bus | In-process | NATS JetStream |
| Health computation | On-request + TTL cache | Streaming pipeline (Kafka → scorer → cache) |
| Log aggregation | Runtime adapter proxy | Loki push model, aggregated at platform level |
| Metrics | Pull from runtime adapters | OpenTelemetry collector → Prometheus → API |
| Multi-region | Single deployment | Workspace-level region routing |
| GraphQL | REST only | Add GraphQL layer over same service interfaces |

---

## 4. Database Schema

```sql
-- Workspace
CREATE TABLE workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free',
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workspace membership
CREATE TABLE workspace_memberships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'developer',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- Teams
CREATE TABLE teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  description   TEXT,
  channel       TEXT,
  oncall_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

-- Team membership
CREATE TABLE team_memberships (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id  UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role     TEXT NOT NULL DEFAULT 'member',
  UNIQUE (team_id, user_id)
);

-- Runtimes
CREATE TABLE runtimes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'healthy',
  provider_config JSONB NOT NULL DEFAULT '{}',
  version         TEXT,
  node_count      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Environments
CREATE TABLE environments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  runtime_id    UUID NOT NULL REFERENCES runtimes(id),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  tier          TEXT NOT NULL DEFAULT 'development',
  auto_deploy   BOOL NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

-- Services (PRIMARY TABLE)
CREATE TABLE services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id           UUID NOT NULL REFERENCES teams(id),
  name              TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  description       TEXT,
  type              TEXT NOT NULL DEFAULT 'rest_api',
  runtime_class     TEXT NOT NULL DEFAULT 'rest-api',
  default_resources JSONB NOT NULL DEFAULT '{"cpu":"500m","memory":"512Mi","replicas":2}',
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

-- Repositories
CREATE TABLE repositories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL DEFAULT 'github',
  org         TEXT NOT NULL,
  repo        TEXT NOT NULL,
  branch      TEXT NOT NULL DEFAULT 'main',
  manifest_path TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_id)
);

-- Deployments
CREATE TABLE deployments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  environment_id  UUID NOT NULL REFERENCES environments(id),
  status          TEXT NOT NULL DEFAULT 'pending',
  image           TEXT NOT NULL,
  version         TEXT NOT NULL,
  commit          TEXT,
  deployed_by     UUID REFERENCES users(id),
  config_snapshot JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ
);

CREATE INDEX ON deployments (service_id, environment_id, started_at DESC);

-- Secrets
CREATE TABLE secrets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  environment_id  UUID NOT NULL REFERENCES environments(id),
  key             TEXT NOT NULL,
  provider_id     UUID,
  provider_path   TEXT NOT NULL,
  updated_by      UUID REFERENCES users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_id, environment_id, key)
);

-- Dependencies
CREATE TABLE dependencies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_service_id   UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  target_type         TEXT NOT NULL,
  target_service_id   UUID REFERENCES services(id),
  target_name         TEXT,
  target_url          TEXT,
  dependency_type     TEXT NOT NULL DEFAULT 'runtime',
  criticality         TEXT NOT NULL DEFAULT 'high',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Runbooks
CREATE TABLE runbooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'incident',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Health scores (materialized cache)
CREATE TABLE health_scores (
  service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  environment_id  UUID NOT NULL REFERENCES environments(id),
  health_score    INT NOT NULL DEFAULT 0,
  readiness_score INT NOT NULL DEFAULT 0,
  risk_score      INT NOT NULL DEFAULT 0,
  maturity_score  INT NOT NULL DEFAULT 0,
  factors         JSONB NOT NULL DEFAULT '{}',
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, environment_id)
);

-- Cost records
CREATE TABLE cost_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  environment_id  UUID NOT NULL REFERENCES environments(id),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  compute_usd     DECIMAL(10,4) NOT NULL DEFAULT 0,
  egress_usd      DECIMAL(10,4) NOT NULL DEFAULT 0,
  storage_usd     DECIMAL(10,4) NOT NULL DEFAULT 0,
  total_usd       DECIMAL(10,4) NOT NULL DEFAULT 0,
  source          TEXT,
  UNIQUE (service_id, environment_id, period_start)
);

-- Audit events
CREATE TABLE audit_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id       UUID REFERENCES users(id),
  resource_type  TEXT NOT NULL,
  resource_id    UUID,
  action         TEXT NOT NULL,
  diff           JSONB,
  ip_address     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON audit_events (workspace_id, created_at DESC);
CREATE INDEX ON audit_events (resource_type, resource_id);

-- RBAC access requests
CREATE TABLE access_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  requester_id    UUID NOT NULL REFERENCES users(id),
  requested_role  TEXT NOT NULL,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 5. API Design

All endpoints are under `/api/v1`. Workspace scope is implicit from auth token or explicit in path.

### Convention

```
GET    /resource          → list
POST   /resource          → create
GET    /resource/:id      → get
PUT    /resource/:id      → full update
PATCH  /resource/:id      → partial update
DELETE /resource/:id      → delete
```

### Service APIs (Primary)

```
GET    /workspaces/:ws/services
POST   /workspaces/:ws/services
GET    /workspaces/:ws/services/:svc
PUT    /workspaces/:ws/services/:svc
DELETE /workspaces/:ws/services/:svc

GET    /workspaces/:ws/services/:svc/health
GET    /workspaces/:ws/services/:svc/health/:env

GET    /workspaces/:ws/services/:svc/deployments
POST   /workspaces/:ws/services/:svc/deployments
GET    /workspaces/:ws/services/:svc/deployments/:dep
PATCH  /workspaces/:ws/services/:svc/deployments/:dep     ← status update
POST   /workspaces/:ws/services/:svc/deployments/:dep/rollback

GET    /workspaces/:ws/services/:svc/logs?env=:env&since=:ts
                                                           ← SSE stream

GET    /workspaces/:ws/services/:svc/secrets
POST   /workspaces/:ws/services/:svc/secrets
GET    /workspaces/:ws/services/:svc/secrets/:key
PUT    /workspaces/:ws/services/:svc/secrets/:key
DELETE /workspaces/:ws/services/:svc/secrets/:key

GET    /workspaces/:ws/services/:svc/metrics?env=:env&range=1h
GET    /workspaces/:ws/services/:svc/dependencies
POST   /workspaces/:ws/services/:svc/dependencies
DELETE /workspaces/:ws/services/:svc/dependencies/:dep

GET    /workspaces/:ws/services/:svc/runbooks
POST   /workspaces/:ws/services/:svc/runbooks
PUT    /workspaces/:ws/services/:svc/runbooks/:rb
DELETE /workspaces/:ws/services/:svc/runbooks/:rb

GET    /workspaces/:ws/services/:svc/cost?period=2026-06

GET    /workspaces/:ws/services/:svc/repository
PUT    /workspaces/:ws/services/:svc/repository
```

### Workspace-level Aggregation APIs

```
GET    /workspaces/:ws/services/:svc/deployments/all    ← all envs
GET    /workspaces/:ws/alerts                           ← firing alerts
GET    /workspaces/:ws/insights                         ← workspace health summary
```

### Platform APIs (Platform Engineer only)

```
GET    /workspaces/:ws/runtimes
POST   /workspaces/:ws/runtimes
GET    /workspaces/:ws/runtimes/:rt
PUT    /workspaces/:ws/runtimes/:rt
DELETE /workspaces/:ws/runtimes/:rt
GET    /workspaces/:ws/runtimes/:rt/health

GET    /workspaces/:ws/environments
POST   /workspaces/:ws/environments
GET    /workspaces/:ws/environments/:env
PUT    /workspaces/:ws/environments/:env
DELETE /workspaces/:ws/environments/:env
```

### Team APIs

```
GET    /workspaces/:ws/teams
POST   /workspaces/:ws/teams
GET    /workspaces/:ws/teams/:team
PUT    /workspaces/:ws/teams/:team
GET    /workspaces/:ws/teams/:team/members
POST   /workspaces/:ws/teams/:team/members
DELETE /workspaces/:ws/teams/:team/members/:user
GET    /workspaces/:ws/teams/:team/services
```

### RBAC APIs

```
GET    /workspaces/:ws/access-requests
POST   /workspaces/:ws/access-requests
PATCH  /workspaces/:ws/access-requests/:id   ← approve/deny
GET    /workspaces/:ws/members
```

### Response shape

```json
// List
{
  "data": [...],
  "meta": { "total": 42, "page": 1, "per_page": 20 }
}

// Single resource
{
  "data": { ... }
}

// Error
{
  "error": {
    "code": "service.not_found",
    "message": "Service 'api-gateway' not found",
    "details": {}
  }
}
```

---

## 6. Frontend Information Architecture

### Key Decision

**Deployments, Logs, Secrets, Metrics are NOT top-level navigation.**

They live inside a Service. The URL always starts from Service.

### Route Structure

```
/                          → redirect → /dashboard

/dashboard                 → Home (workspace health, my services, alerts)

/services                  → Service Catalog (all services, search, filter)
/services/new              → Create service wizard
/services/:svc             → Service Workspace (redirect → /services/:svc/overview)
/services/:svc/overview    → Overview tab
/services/:svc/deployments → Deployments tab
/services/:svc/logs        → Logs tab
/services/:svc/secrets     → Secrets tab
/services/:svc/metrics     → Metrics tab
/services/:svc/dependencies → Dependencies tab
/services/:svc/ownership   → Ownership tab (runbooks, docs, channel)
/services/:svc/settings    → Service settings tab

/teams                     → Team list
/teams/:team               → Team page (members, services owned)

/insights                  → Workspace insights (health scores, maturity)

/platform                  → Platform area (admin/platform_engineer only)
/platform/environments     → Environment management
/platform/runtimes         → Runtime management
/platform/secrets          → Secret providers
/platform/registries       → Container registries
/platform/repositories     → Git providers
/platform/audit            → Audit log

/settings                  → Workspace settings
/settings/members          → Workspace members + access requests
/settings/rbac             → Role assignments
```

---

## 7. Navigation Structure

### Primary Sidebar (All users)

```
[TC]                       ← Logo + workspace switcher
─────────────────────
⊞  Home
◫  Services                ← PRIMARY: developers live here
◈  Teams
⟁  Insights
─────────────────────
⚙  Platform               ← visible to platform_engineer + admin only
⚙  Settings
─────────────────────
●  [User Avatar]
```

### Environment Filter

A persistent environment selector lives in the **topbar**, acting as a global context filter. It never hides infrastructure details — it presents: `All · Production · Staging · Development`.

### Service Workspace Tabs (within /services/:svc)

```
← Services    api-gateway    [HEALTHY ✓]    [Deploy ▾]

Overview · Deployments · Logs · Secrets · Metrics · Dependencies · Ownership · Settings
```

The service name and health badge persist across all tabs.

---

## 8. Service Workspace Design

### Overview Tab

Answers: **"What is this service and is it healthy right now?"**

```
┌──────────────────────────────────────────────────────────────┐
│  api-gateway                    ● HEALTHY      [Deploy ▾]   │
│  Central API gateway · Platform Team                        │
│  github.com/glynac-ai/api-gateway                           │
├──────────────────────────────────────────────────────────────┤
│ DEPLOYED IN                                                  │
│                                                              │
│  Production    ● Running   v2.4.1  ·  2d ago                │
│  Staging       ● Running   v2.5.0-rc · 6h ago               │
│  Development   ● Running   main     · 45m ago               │
├──────────────────────────────────────────────────────────────┤
│ HEALTH SCORES                                                │
│  Health     ████████████████░░  92                          │
│  Readiness  ████████████░░░░░░  78                          │
│  Risk       ████░░░░░░░░░░░░░░  18   (lower = safer)        │
│  Maturity   ████████░░░░░░░░░░  65                          │
├──────────────────────────────────────────────────────────────┤
│ QUICK LINKS    Logs  ·  Secrets  ·  Runbooks  ·  Metrics    │
└──────────────────────────────────────────────────────────────┘
```

### Deployments Tab

Answers: **"What is deployed where, and how do I change it?"**

- Grouped by Environment
- Each card: image, version, commit, deployed by, when, status
- Rollback button always visible when status is failed/degraded
- "Deploy new version" flow inline

### Logs Tab

Answers: **"What is this service doing right now?"**

- Environment picker (tabs)
- Live log stream (SSE)
- Filter bar (level, text search, time range)
- Download button

### Secrets Tab

Answers: **"What secrets does this service have access to?"**

- Grouped by Environment
- Keys shown, values masked (reveal on click requires confirmation)
- Add/edit/delete secret inline
- Audit trail: last updated by / when

### Metrics Tab

Answers: **"Is this service performing within expected bounds?"**

- Request rate, error rate, latency (p50/p95/p99)
- CPU and memory utilization
- Environment and time-range selectors
- Alert rules summary

### Dependencies Tab

Answers: **"What does this service depend on, and what depends on it?"**

```
UPSTREAM (things api-gateway calls)
  → user-service         [HEALTHY]  runtime dependency
  → billing-service      [HEALTHY]  runtime dependency
  → redis                [Database] runtime dependency

DOWNSTREAM (things that call api-gateway)
  ← frontend-web         [HEALTHY]
  ← mobile-app           [External]
```

Interactive graph visualization available via toggle.

### Ownership Tab

Answers: **"Who owns this, and what do I do when it breaks?"**

| Field | Value |
|-------|-------|
| Owner Team | Platform |
| On-call | PagerDuty → platform-oncall |
| Slack channel | #platform-alerts |
| Runbooks | Incident · Deployment · Maintenance |
| Documentation | Confluence link |
| Repository | github.com/glynac-ai/api-gateway |

**Readiness checklist:**
- [x] Owner team assigned
- [x] Repository linked
- [x] Incident runbook present
- [x] Production monitoring active
- [ ] Cost allocation configured
- [ ] SLO defined

### Settings Tab

Service-level configuration: name, type, default resources, runtime class, danger zone (archive/delete).

---

## 9. Platform Workspace Design

Only accessible to `platform_engineer` and `admin` roles.

### Environments

```
┌─────────────────────────────────────────────────────────────┐
│ Environments                                [+ New]         │
├─────────────────────────────────────────────────────────────┤
│ Production          → Kubernetes Production   ● healthy     │
│   16 services  ·  3 pending deploys                        │
│                                                             │
│ Staging             → Nomad Staging           ● healthy     │
│   14 services  ·  1 failed deploy                          │
│                                                             │
│ Development         → Kubernetes Dev          ● healthy     │
│   11 services                                              │
└─────────────────────────────────────────────────────────────┘
```

Environments map to Runtimes. Developers see "Production". Platform engineers manage "Kubernetes Production".

### Runtimes

Each runtime card shows: type, version, node count, connected environments, health status, last sync time.

Platform engineers can register new runtimes (provide kubeconfig/Nomad ACL token) without affecting any developer workflows.

### Secret Providers

Show connected providers (Vault, AWS SSM, GCP Secret Manager). Configure new providers without exposing paths to developers.

### Container Registries

Approved registries from which deployments can pull images. Developers see image URIs; platform engineers manage registry credentials.

### Audit Log

Full immutable event log filterable by actor, resource, action, time range.

---

## 10. Migration Strategy

### Current State Assessment

The current TernakClouds is **environment-centric** — navigation starts from Environments, then drills into services. APIs are scoped to environments. The database has environment-first joins.

### Migration Phases

#### Phase 0: Freeze current architecture
- No new environment-centric features
- New features built with service-centric design
- Feature flag: `service_centric_ui` controls UI switching

#### Phase 1: Data migration (no user impact)
1. Introduce `services` table (may already exist as `catalog`)
2. Migrate `catalog` → `services` with team ownership
3. Add `repositories`, `runbooks`, `dependencies` tables
4. Backfill `health_scores` from existing deployment data
5. Ensure every deployment links to both `service_id` and `environment_id`

#### Phase 2: Backend — new service-first API layer
1. Implement `/api/v1/workspaces/:ws/services` endpoints
2. New deployment endpoints scoped under service
3. New secrets endpoints scoped under service
4. Keep old environment-scoped endpoints alive (deprecated)
5. Runtime adapters remain unchanged internally

#### Phase 3: Frontend — service-centric navigation
1. Add new `/services` and `/services/:svc/*` routes
2. Move Deployments/Logs/Secrets/Metrics into Service tabs
3. Add Service Workspace (Overview, Deployments, Logs, Secrets, Metrics, Dependencies, Ownership)
4. Keep old environment routes behind feature flag
5. Update sidebar: Home → Services → Teams → Insights → Platform

#### Phase 4: Platform area
1. Move Runtimes, Registries, Git Providers into `/platform`
2. Gate behind `platform_engineer` role
3. Remove from developer-facing navigation

#### Phase 5: Deprecate old routes
1. Redirect `/environments/:envId/services` → `/services`
2. Redirect `/environments/:envId/logs` → `/services/:svc/logs`
3. Remove old navigation items
4. Remove deprecated API endpoints

#### Phase 6: Health + Insights
1. Implement health score computation
2. Add Insights page with workspace health matrix
3. Add per-service readiness checklist
4. Add cost attribution per service

### Migration Risk by Component

| Component | Risk | Mitigation |
|-----------|------|------------|
| Deployment API | Medium | Keep old + new routes in parallel |
| Log streaming | Low | SSE unchanged, just re-scoped |
| Secrets | Low | Vault paths unchanged, API re-scoped |
| RBAC | Medium | Role model stays, permission scope broadens |
| Frontend routing | Low | Feature flag, parallel routes |
| Database | Low | Additive-only migrations in phases 1–3 |

---

## 11. Risks and Tradeoffs

### Risk 1: Team resistance to service-centric model
**Problem:** Operators accustomed to environment-centric workflows may resist.
**Mitigation:** Keep environment filter in topbar globally. Environment is still visible context; it just doesn't drive the primary navigation.

### Risk 2: Service ownership gaps
**Problem:** Migration reveals services with no owner team assigned.
**Mitigation:** Introduce "Platform" team as default owner. Block new deployments for unowned services after 30-day grace period.

### Risk 3: Health score accuracy
**Problem:** Inaccurate health scores erode trust faster than no scores.
**Mitigation:** Start with binary: deployed/not deployed, running/failed. Add scoring complexity incrementally. Always show "last computed at" timestamp.

### Risk 4: Dependency graph completeness
**Problem:** Dependency graph only shows what developers declare. Silent dependencies (undeclared DB connections) stay invisible.
**Mitigation:** Make declaration optional initially. Provide import from known infra (parse Helm values, Nomad specs). Never block deploys on missing dependency declarations.

### Risk 5: Secrets migration
**Problem:** Re-scoping secrets under services requires updating Vault policies.
**Mitigation:** Keep Vault paths identical. Only the API surface changes. Vault policies updated by batch script, not by users.

### Risk 6: GraphQL future compatibility
**Problem:** Adding GraphQL later over REST service interfaces requires careful schema design.
**Mitigation:** REST response shapes already use consistent resource envelopes. Service interfaces return domain objects, not HTTP responses. GraphQL resolver can call the same service layer.

---

## 12. Recommended MVP

### Scope

Deliver the minimum that makes the platform feel service-centric to a developer. Prove the model before building the full platform.

### MVP Components

#### 1. Service Catalog (2 weeks)
- List all services in workspace
- Service card: name, team, health dots per environment, last deployed
- Search and filter by team, health status
- No CRUD yet — read-only first

#### 2. Service Workspace (3 weeks)
- `/services/:svc` with tabs: Overview · Deployments · Logs · Secrets
- Overview: deployment status per environment, repository link, team
- Deployments: history with rollback button
- Logs: live SSE stream, environment picker, text filter
- Secrets: list keys per environment, masked values, reveal on click

#### 3. Home Dashboard (1 week)
- My Services (services owned by my team)
- Service health summary: healthy / issues / idle
- Recent deployments (last 24h across all my services)
- Pending access requests (for admins)

#### 4. Teams (1 week)
- Team list with service count
- Team page: members, services owned
- Assign service to team

#### 5. Platform Area (1 week)
- Move runtime/environment management behind `/platform`
- Gate with `platform_engineer` role check
- Existing functionality, new location

### What MVP Excludes

| Feature | Reason | Phase |
|---------|---------|-------|
| Metrics tab | Requires metrics backend integration | Phase 2 |
| Dependencies tab | Requires data collection | Phase 2 |
| Ownership/Readiness scoring | Nice-to-have, not blocking | Phase 2 |
| Cost tab | Requires billing adapter | Phase 3 |
| Insights page | Requires health score computation | Phase 2 |
| Create Service wizard | Nice UX, not blocking operation | Phase 2 |

### Success Criteria for MVP

- A developer can find their service in under 3 clicks
- A developer can see deployment status across all environments without navigating to an environment page
- A developer can stream logs for a specific service without knowing which Kubernetes namespace it runs in
- A developer can view and update secrets for a service without knowing the Vault path
- A platform engineer can manage runtimes without cluttering the developer experience

---

## Appendix: Service Health Model

### Health Score (0–100)

Measures: **is the service alive and operating normally right now?**

| Factor | Weight | Input |
|--------|--------|-------|
| Is running in this environment | 40 | Deployment status = running |
| Recent deploy success rate | 20 | Last 5 deploys: % successful |
| Error rate | 20 | HTTP 5xx rate < 1% = full, linear decay |
| Alert state | 20 | No firing alerts = full |

### Readiness Score (0–100)

Measures: **is this service production-ready as an operational artifact?**

| Factor | Weight | Condition |
|--------|--------|-----------|
| Owner team assigned | 20 | team_id is set |
| Repository linked | 15 | repository record exists |
| Incident runbook present | 20 | runbook with type=incident |
| Production monitoring | 15 | metrics/alerts configured |
| Deployment automation | 15 | auto_deploy or CI configured |
| On-call assignment | 15 | oncall_url set on team |

### Risk Score (0–100, lower = safer)

Measures: **how likely is this service to cause or amplify an incident?**

| Factor | Weight | Condition |
|--------|--------|-----------|
| Critical dependencies failing | 30 | Any critical dep not healthy |
| Last deployment age | 20 | > 30d without deploy in prod |
| Open incidents | 25 | Count of firing critical alerts |
| Missing secrets | 15 | Declared secrets with no value |
| No healthcheck | 10 | No liveness/readiness probe |

### Maturity Score (0–100)

Measures: **how well does this service follow the Golden Path?**

| Factor | Weight | Condition |
|--------|--------|-----------|
| Uses approved runtime class | 20 | runtime_class in approved list |
| Has all observability | 20 | logs + metrics + tracing |
| Deployment has canary/rolling strategy | 15 | Not recreate in production |
| Cost allocated | 15 | cost_records present |
| SLO defined | 15 | SLO target in service config |
| Documentation present | 15 | Docs runbook exists |

### UI Presentation

```
Health     [███████████████░░░]  87 / 100   ● Good
Readiness  [██████████░░░░░░░░]  63 / 100   ⚠ Needs attention
Risk       [████░░░░░░░░░░░░░░]  22 / 100   ✓ Low
Maturity   [████████░░░░░░░░░░]  55 / 100   → Improving
```

Each score expands to show per-factor breakdown on hover.

---

## Appendix: Golden Path Templates

### REST API
```yaml
runtime_class: rest-api
default_resources:
  cpu: 500m
  memory: 512Mi
  replicas: 2
deployment_strategy: rolling
health_check: GET /health → 200
readiness_check: GET /ready → 200
observability:
  logs: structured JSON to stdout
  metrics: prometheus at /metrics
  tracing: opentelemetry auto-instrumentation
readiness_requirements:
  - owner_team
  - repository
  - incident_runbook
  - production_monitoring
  - deployment_automation
```

### Worker
```yaml
runtime_class: worker
default_resources:
  cpu: 1000m
  memory: 1Gi
  replicas: 1
deployment_strategy: recreate
observability:
  logs: structured JSON
  metrics: job_duration_seconds, job_failures_total
readiness_requirements:
  - owner_team
  - repository
  - incident_runbook
```

### Cron Job
```yaml
runtime_class: cronjob
default_resources:
  cpu: 500m
  memory: 256Mi
schedule: "0 */6 * * *"
deployment_strategy: job
observability:
  logs: structured JSON
  metrics: last_run_timestamp, last_run_duration_seconds
readiness_requirements:
  - owner_team
  - repository
```

### Frontend
```yaml
runtime_class: frontend
default_resources:
  cpu: 250m
  memory: 256Mi
  replicas: 2
deployment_strategy: rolling
health_check: GET / → 200
observability:
  logs: access logs
  metrics: request_rate, core_web_vitals (via RUM)
readiness_requirements:
  - owner_team
  - repository
  - production_monitoring
```

### AI Agent
```yaml
runtime_class: ai-agent
default_resources:
  cpu: 2000m
  memory: 4Gi
  replicas: 1
deployment_strategy: rolling
observability:
  logs: structured JSON with trace_id, model, tokens_used
  metrics: inference_latency_seconds, token_usage_total, error_rate
readiness_requirements:
  - owner_team
  - repository
  - incident_runbook
  - cost_allocation
```

### MCP Server
```yaml
runtime_class: mcp-server
default_resources:
  cpu: 500m
  memory: 512Mi
  replicas: 2
deployment_strategy: rolling
health_check: GET /mcp/health → 200
observability:
  logs: structured JSON with tool_call, caller_id
  metrics: tool_call_rate, tool_call_latency_seconds, error_rate
readiness_requirements:
  - owner_team
  - repository
  - incident_runbook
  - documentation
```

---

## Appendix: Design Tokens

```yaml
name: Architectural Precision
colors:
  surface: "#0b1326"
  surface-dim: "#0b1326"
  surface-bright: "#31394d"
  surface-container-lowest: "#060e20"
  surface-container-low: "#131b2e"
  surface-container: "#171f33"
  surface-container-high: "#222a3d"
  surface-container-highest: "#2d3449"
  on-surface: "#dae2fd"
  on-surface-variant: "#c7c4d7"
  primary: "#8083ff"
  on-primary: "#0d0096"
  secondary: "#4edea3"
  on-secondary: "#003824"
  tertiary: "#ffb95f"
  on-tertiary: "#472a00"
  error: "#f43f5e"
typography:
  sans: Geist, Inter, system-ui
  mono: JetBrains Mono, ui-monospace
radius:
  default: 4px
  tight: 2px
  card: 8px
  pill: 12px
```
