# TernakClouds Documentation

## Platform

| Guide | Description |
|---|---|
| [Introduction](./introduction/overview.md) | What TernakClouds is, why it exists, core concepts |
| [Architecture](./architecture/overview.md) | System components, request flows, data model, authorization layers |
| [Installation](./getting-started/installation.md) | Prerequisites, configuration, first run, Vault setup, production deployment |
| [Authentication & RBAC](./authentication/rbac.md) | JWT auth, platform roles, workspace roles, access requests |
| [Contributing](./contributing/guide.md) | Development setup, backend/frontend conventions, PR guidelines |

## Runtimes & Observability

| Guide | Description |
|---|---|
| [Runtimes](./runtimes/overview.md) | Kubernetes, Nomad, and Docker providers, workload model, log streaming detail |
| [Logs Platform](./logs/overview.md) | Centralized log streaming, Loki integration, search and filter, SSE protocol |

## Deployments

| Guide | Description |
|---|---|
| [Service Catalog](./deployments/service-catalog.md) | Deployable service templates, multi-runtime targeting, deployment lifecycle |
| [Blueprints](./deployments/blueprints.md) | Reusable deployment templates, versioning, system vs custom blueprints |
| [Platform Applications](./deployments/platform-apps.md) | Blueprint-based app provisioning, manifest generation, GitOps integration |

## Integrations

| Guide | Description |
|---|---|
| [Container Registries](./registry/overview.md) | Workspace and environment-scoped registry configuration, Vault-backed credentials |
| [Repository Providers](./repositories/overview.md) | GitHub and GitLab integration, PAT storage, repo browser, manifest commit and PR |
