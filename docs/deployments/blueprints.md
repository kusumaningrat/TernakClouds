# Blueprints

Blueprints are reusable deployment templates that encode an application's infrastructure requirements. Platform teams author blueprints once; developers self-service from them to provision [Platform Applications](./platform-apps.md).

---

## Concepts

### Blueprint vs Service Catalog

| | Blueprint | Service Catalog |
|---|---|---|
| Authored by | Platform team | Platform (seeded) |
| Complexity | Full application spec | Common services with defaults |
| Customization | Deep — resource profiles, env vars, volumes | Minimal overrides |
| Output | Runtime manifest + optional Git commit/PR | Runtime job submission |
| Use case | App teams deploying their own services | Quick self-service for infra dependencies |

### System vs Custom Blueprints

**System blueprints** are seeded by the platform at startup. They are available to all workspaces and cannot be deleted.

**Custom blueprints** are created within a workspace. They are visible only to that workspace (unless marked public).

### Versioning

Blueprints support semantic versioning. Multiple versions of the same blueprint can coexist. When deploying, the user selects the version. Previous versions remain available for rollback.

---

## Blueprint Structure

A blueprint captures the full specification of a deployable application:

- **Name and description** — display metadata
- **Category** — `application` or `infrastructure`
- **Supported runtimes** — which runtimes this blueprint can target (Kubernetes, Nomad, Docker)
- **Icon** — display icon
- **Visibility** — public (all workspaces) or private (workspace-only)
- **Version** — semantic version string
- **Spec** — the deployment specification used by generators

The spec is a runtime-agnostic representation. The generator package translates it into runtime-specific manifests (Nomad HCL or Kubernetes YAML) at deployment time.

---

## Managing Blueprints

### Viewing Blueprints

Navigate to **Blueprints** in the sidebar. The catalogue shows all system blueprints and any custom blueprints for your workspace.

### Creating a Blueprint

Requirements: platform role `admin` or `manager`.

1. Navigate to **Blueprints** → **New blueprint**
2. Fill in name, description, category, and supported runtimes
3. Define the deployment spec
4. Set the initial version
5. Choose visibility (public or workspace-private)
6. Click **Create**

### Deleting a Blueprint

Custom blueprints can be deleted by admins or managers. System blueprints are protected and cannot be deleted.

Deleting a blueprint does not affect existing Platform Applications that were provisioned from it — they retain their generated manifests.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/blueprints` | List all blueprints (system + workspace custom) |
| `GET` | `/blueprints/:id` | Get a blueprint |
| `POST` | `/blueprints` | Create a custom blueprint |
| `DELETE` | `/blueprints/:id` | Delete a custom blueprint |

Creating or deleting blueprints requires `admin` or `manager` platform role.

---

## Deploying from a Blueprint

Blueprints are deployed as [Platform Applications](./platform-apps.md). Select a blueprint from the catalogue and click **Deploy** to start the provisioning flow.
