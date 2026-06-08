# Architecture Overview

---

## System Components

```mermaid
graph TD
    subgraph Client["Client Layer"]
        UI["Admin Dashboard\nTanStack Router + React\n:3000"]
        DOCS["Docs Site\nDocusaurus\n:4000"]
    end

    subgraph API["API Layer"]
        GIN["Go / Gin REST API :8022\nJWT auth middleware\nPermission + workspace resolvers"]
    end

    subgraph Storage["Storage"]
        PG[("PostgreSQL :5432\nPlatform state\nusers · workspaces · environments\ncapabilities · blueprints")]
        VAULT[("HashiCorp Vault :8200\nCredentials only\nnever stored in PG")]
    end

    subgraph Runtimes["Runtime Clusters"]
        K8S["Kubernetes API"]
        NOMAD["Nomad :4646"]
        DOCKER["Docker daemon"]
    end

    UI -->|"/api/* Bearer JWT"| GIN
    GIN --> PG
    GIN --> VAULT
    GIN -->|"Proxied — never exposed to client"| K8S
    GIN -->|"Proxied — never exposed to client"| NOMAD
    GIN -->|"Proxied — never exposed to client"| DOCKER
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
├── ui/                     Admin dashboard (TanStack Router + React)
│   └── src/
│       ├── routes/         File-based routing (TanStack Router)
│       ├── modules/        Feature modules (users, capabilities, deployments…)
│       ├── components/     Shared UI components (DashboardSidebar, DashboardTopbar…)
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
├── accessrequest/    Workspace access request API (backend only; no UI workflow)
├── auth/             JWT login/logout/refresh, /me endpoint, must_change_password check
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
├── user/             User CRUD, role assignment, refresh tokens, forced password change
├── vault/            Vault AppRole HTTP client (KV v2)
└── workspace/        Workspace and membership management, AddMemberDirect
```

---

## Request Flow

### Authentication

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Go API
    participant DB as PostgreSQL

    C->>API: POST /api/v1/auth/login {email, password}
    API->>DB: Lookup user by email
    DB-->>API: User record
    API->>API: bcrypt.Compare(password, hash)
    API->>DB: Insert refresh token (hashed, 168h)
    API-->>C: access_token (15m JWT) + refresh_token

    Note over C: Stores tokens in localStorage

    C->>API: GET /api/v1/... Authorization: Bearer access_token
    API->>API: Validate JWT signature + expiry
    API-->>C: 200 Response

    Note over C,API: On access_token expiry
    C->>API: POST /api/v1/auth/refresh {refresh_token}
    API->>DB: Verify + rotate refresh token
    API-->>C: new access_token + new refresh_token
```

### Capability Binding (provider configuration)

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as Middleware
    participant H as capability.Handler
    participant S as capability.Service
    participant V as Vault
    participant DB as PostgreSQL

    C->>MW: POST /capabilities/runtime/provider
    MW->>MW: RequireAuth (JWT)
    MW->>MW: RequirePermission(environments:write)
    MW->>MW: RequireWorkspaceOwner
    MW->>H: BindProvider(req)
    H->>S: BindProvider(ctx, input)
    S->>DB: Validate capability in catalogue
    S->>DB: Upsert CapabilityBinding (env ↔ capability)
    alt token provided
        S->>V: StoreToken(idp/capabilities/{envID}/{cap}/{provider}/token)
    end
    S->>DB: Create ProviderConfig (endpoint, namespace, vaultPath)
    S-->>C: Updated capability status (token never in response)
```

### Blueprint Deployment (Platform Application provisioning)

```mermaid
sequenceDiagram
    participant C as Client
    participant H as platformapp.Handler
    participant S as platformapp.Service
    participant G as generator
    participant DB as PostgreSQL
    participant R as RepoProvider

    C->>H: POST /platform-apps {blueprint_id, runtime, ...}
    H->>S: Provision(ctx, input)
    S->>DB: Load blueprint spec
    S->>G: Generate(spec, runtime)
    G-->>S: Nomad HCL / K8s YAML / Docker Compose
    S->>DB: Store manifest + PlatformApp (status: pending)
    alt repo provider configured
        S->>R: Commit manifest to repository
        S->>R: Open pull request
    end
    S->>DB: Update status → provisioned
    S-->>C: PlatformApp with generated manifest
```

### Runtime Log Streaming

```mermaid
sequenceDiagram
    participant B as Browser
    participant API as Backend SSE Handler
    participant V as Vault
    participant RT as Runtime (K8s / Nomad / Docker)

    B->>API: GET /kubernetes/pods/{ns}/{name}/logs?follow=true
    API->>API: RequireAuth + RequireWorkspaceMember
    API->>V: RetrieveToken(capability path)
    V-->>API: cluster credential
    API->>RT: Open streaming log request
    RT-->>API: Log stream (chunked / frames)
    loop For each log line
        API-->>B: event: log\ndata: line content
    end
    Note over B,API: Browser AbortController → Go context cancel → closes RT connection
```

---

## Data Model

```mermaid
erDiagram
    User ||--o{ RefreshToken : has
    User ||--o{ UserRole : has
    UserRole }o--|| Role : references
    Role ||--o{ RolePermission : has
    User ||--o{ WorkspaceMember : "member of"
    WorkspaceMember }o--|| Workspace : "belongs to"
    Workspace ||--o{ Environment : contains
    Workspace ||--o{ RegistryProvider : has
    Workspace ||--o{ RepoProvider : has
    Workspace ||--o{ Blueprint : "custom blueprints"
    RegistryProvider ||--o{ RegistryBinding : "bound to env"
    Environment ||--o{ CapabilityBinding : has
    Environment ||--o{ SecretGrant : has
    Environment ||--o{ ServiceDeployment : has
    Environment ||--o{ PlatformApp : has
    CapabilityBinding ||--o{ ProviderConfig : has
    PlatformApp }o--|| Blueprint : "based on"
    PlatformApp ||--o{ DeploymentRecord : has
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

```mermaid
flowchart TD
    REQ["Incoming Request"] --> L1{"Layer 1\nPlatform RBAC\nRequirePermission"}
    L1 -->|"❌ missing permission"| DENY1["403 Forbidden"]
    L1 -->|"✅ permission OK"| L2{"Layer 2\nWorkspace Role\nRequireWorkspaceOwner"}
    L2 -->|"❌ not workspace owner"| DENY2["403 Forbidden"]
    L2 -->|"✅ is owner"| RUN["Handler executes"]

    style DENY1 fill:#ef4444,color:#fff,stroke:#dc2626
    style DENY2 fill:#ef4444,color:#fff,stroke:#dc2626
    style RUN fill:#22c55e,color:#fff,stroke:#16a34a
```

This means a `developer` role user who is set as workspace owner **still cannot** bind capability providers — they lack `environments:write`. And an `admin` who is not a workspace member cannot modify workspace resources — they lack workspace ownership.

---

## Streaming Architecture

Log streaming uses Server-Sent Events (SSE) over HTTP. The backend acts as a proxy:

```mermaid
sequenceDiagram
    participant BR as Browser
    participant BE as Backend SSE handler
    participant RT as Runtime cluster

    BR->>BE: fetch(url, {signal: abortSignal})
    BE->>RT: Open streaming connection
    BE-->>BR: event: connected / data: {}
    loop log lines arrive
        RT-->>BE: log frame / line
        BE-->>BR: event: log / data: line
    end
    alt stream error
        RT-->>BE: connection error
        BE-->>BR: event: error / data: message
    end
    Note over BR: User cancels (AbortController)
    BR--xBE: abort signal fires
    BE->>RT: Close connection (context cancel)
```

The abort signal from the browser propagates as context cancellation in Go, closing the upstream runtime connection cleanly.

---

## Vault Integration

```mermaid
flowchart LR
    subgraph Write["Write Path"]
        WOP["BindProvider\nStoreRepoToken\nStoreRegistryCredential"]
    end
    subgraph Read["Read Path"]
        ROP["VerifyProvider\nStreamLogs\nRepoAccess"]
    end
    subgraph Delete["Delete Path"]
        DOP["UnbindProvider\nRemoveRepo"]
    end

    WOP -->|"PUT /v1/{mount}/data/{path}"| VAULT[("HashiCorp Vault\nKV v2")]
    ROP -->|"GET /v1/{mount}/data/{path}"| VAULT
    DOP -->|"DELETE /v1/{mount}/metadata/{path}"| VAULT
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
