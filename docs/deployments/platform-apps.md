# Platform Applications

A Platform Application is a deployed instance of a [Blueprint](./blueprints.md). When you provision a Platform Application, the platform generates a runtime-specific manifest from the blueprint spec and optionally commits it to a repository via your configured [Repository Provider](../repositories/overview.md).

---

## Provisioning Flow

```
Developer selects blueprint + target environment
           │
           ▼
PlatformApp created (status: pending)
           │
           ▼
generator.Generate(spec, runtime)
  → Nomad HCL or Kubernetes YAML
           │
           ▼
Manifest stored on PlatformApp record
           │
           ├─── If repo provider configured ───────────────────┐
           │                                                   ▼
           │                                 Manifest committed to repository
           │                                 Pull request opened (GitOps)
           │                                                   │
           ◄───────────────────────────────────────────────────┘
           │
           ▼
status: provisioned
```

If the manifest commit or PR creation fails, the app is marked `failed` but the generated manifest is retained so you can commit it manually.

---

## Application Lifecycle

| Status | Meaning |
|---|---|
| `pending` | Provisioning in progress |
| `provisioned` | Manifest generated and (optionally) committed to repo |
| `failed` | Provisioning encountered an error |
| `stopped` | Application has been stopped/unprovisioned |

---

## Manifest Generation

The `generator` package translates the blueprint's runtime-agnostic spec into a concrete deployment manifest.

### Nomad (HCL)

For Nomad targets, the generator produces a `.nomad.hcl` job specification. The generated HCL includes:

- Job name derived from the application name
- Task group and task definitions
- Docker driver config (image, ports)
- Resource stanza (CPU, memory)
- Service registration with health checks
- Vault stanza for secret injection (if secret grants are configured)

### Kubernetes (YAML)

For Kubernetes targets, the generator produces a multi-document YAML file containing:

- `Deployment` with container spec, resource requests/limits, and env vars
- `Service` for port exposure
- `ServiceAccount` if RBAC is needed
- `ConfigMap` or `Secret` references if applicable

### Docker Compose (YAML)

For Docker targets, the generator produces a `docker-compose.yml` with the service definition, port mappings, and volume declarations.

### CI/CD Manifests

In addition to the runtime manifest, the platform can generate CI/CD pipeline files:

- **GitHub Actions** — `.github/workflows/<app-name>.yml`
- **GitLab CI** — `.gitlab-ci.yml`

These are committed alongside the runtime manifest if a repository provider is configured.

---

## GitOps Integration

When a [Repository Provider](../repositories/overview.md) is configured in the workspace, Platform Application provisioning can automatically:

1. Commit the generated manifest to a branch in the target repository
2. Open a pull request for review

This makes the deployment auditable and reviewable before anything reaches the runtime. The PR can be merged manually or by your existing CI/CD pipeline.

The repository and branch are specified at provisioning time.

---

## Managing Applications

### Viewing Applications

Navigate to **Applications** in the sidebar. The list shows all provisioned applications in the current environment with their status and linked blueprint.

### Provisioning an Application

1. Navigate to **Applications** → **New application** (or **Deploy** from the Blueprints page)
2. Select the blueprint and version
3. Select the target runtime
4. Enter the application name and any required configuration
5. Optionally select a repository for GitOps commit
6. Click **Provision**

### Deleting an Application

Deleting an application:
- Removes the PlatformApp record
- Does **not** automatically stop the workload in the runtime (stop it first if needed)
- Does **not** delete commits or PRs that were already pushed to the repository

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/platform-apps` | List all platform apps in the environment |
| `GET` | `/platform-apps/:id` | Get a platform app with its manifest |
| `POST` | `/platform-apps` | Provision a new platform app from a blueprint |
| `DELETE` | `/platform-apps/:id` | Delete a platform app record |
