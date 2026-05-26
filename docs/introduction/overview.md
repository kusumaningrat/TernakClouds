# Platform Overview

TernakClouds is a self-hosted Internal Developer Platform built for engineering organizations that run workloads on multiple runtimes (Kubernetes, Nomad) and need a centralized, permission-controlled interface for their developers.

---

## Why TernakClouds Exists

Modern engineering teams face a common problem: infrastructure is powerful but complex. Developers need to deploy services, read logs, access secrets, and inspect running workloads — but doing all of this directly against Kubernetes or Nomad requires deep platform knowledge and broad permissions.

The result is one of two failure modes:

1. **Developers have too much access** — they interact with raw infrastructure, creating security and operational risks.
2. **Developers have too little access** — every deployment, log read, or secret change requires a ticket to the platform team.

TernakClouds resolves this by sitting between developers and infrastructure. It exposes exactly the operations developers need, enforces RBAC, and hides the runtime complexity behind a consistent interface.

---

## Design Philosophy

**Runtime agnosticism.** The platform treats Kubernetes and Nomad as interchangeable runtime providers behind the same abstraction. Adding a new runtime means implementing a provider interface, not rewriting the UI or the API.

**Capability-based configuration.** Instead of hardcoding infrastructure connections, TernakClouds uses a capability system. Each environment declares what it needs (`runtime`, `logs`, `secrets`) and binds the appropriate provider. This makes environments self-describing and portable.

**Credential isolation.** No provider credential is ever stored in the database. Tokens, API keys, and secrets live exclusively in HashiCorp Vault KV v2. The database stores only the Vault path — not the credential itself.

**Two-layer authorization.** Platform-level roles control what a user can do globally. Workspace membership controls what they can do within a specific tenant. Both layers must be satisfied for sensitive operations.

**Developer-first UX.** The admin dashboard is designed so a developer can deploy a service, read logs, and request secret access without knowing what runtime, namespace, or Vault path is involved.

---

## Platform Concepts

### Workspace

A workspace is an isolated organizational tenant. It has its own:

- environments (dev, staging, production)
- member roster (owner + members)
- capability bindings
- registries

Multiple teams can use the same TernakClouds instance, each with their own workspace, without seeing or affecting each other.

### Environment

An environment is a named deployment target within a workspace. Typical environments: `dev`, `staging`, `production`. Three environments are created automatically when a workspace is created.

Each environment independently configures its own capability providers. Your production environment might use a different Nomad cluster or Loki instance than staging.

### Capability

A capability is a platform service type:

| Capability | Purpose |
|---|---|
| `runtime` | Workload scheduling and orchestration |
| `secrets` | Encrypted secret storage and injection |
| `logs` | Centralized log aggregation and streaming |
| `networking` | Service mesh and ingress (in progress) |
| `storage` | Object storage (in progress) |

Each capability can have one or more providers bound to it per environment.

### Provider

A provider is a concrete implementation of a capability. Examples:

- `kubernetes` — Kubernetes runtime provider
- `nomad` — Nomad runtime provider
- `loki` — Loki logs backend
- `vault` — HashiCorp Vault secrets backend

Providers are configured with an endpoint, optional credentials, and optional metadata (region, namespace). Credentials are stored in Vault.

### Platform Role

A global RBAC role assigned to a user across the entire platform:

| Role | Purpose |
|---|---|
| `admin` | Full access to everything |
| `manager` | User and workspace management |
| `developer` | Deploy and operate workloads |
| `viewer` | Read-only access |

### Workspace Role

A membership-scoped role within a specific workspace:

| Role | Purpose |
|---|---|
| `owner` | Configure the workspace, manage members, bind providers |
| `member` | Read and operate within the workspace |

---

## What TernakClouds Is Not

- **Not a runtime.** TernakClouds does not schedule workloads. It orchestrates operations against existing runtimes (Kubernetes, Nomad).
- **Not a secret store.** TernakClouds delegates secret storage to Vault. It manages access grants, not the secrets themselves.
- **Not a CI/CD system.** TernakClouds manages running deployments, not the pipeline that produces them. It can be integrated with CI/CD pipelines via its API.
- **Not a monitoring system.** TernakClouds provides log streaming. Full metrics and alerting belong in your observability stack (Prometheus, Grafana).

---

## Supported Integrations

| Category | Supported |
|---|---|
| Runtime | Kubernetes, Nomad |
| Secrets | HashiCorp Vault (KV v2, AppRole) |
| Logs backend | Loki, OpenSearch, Elasticsearch |
| Metrics | Prometheus (future) |
| Storage | MinIO (future) |
| Container registry | Any OCI-compatible registry |
