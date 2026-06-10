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

### Starter Blueprints

The platform seeds the following system blueprints on first startup. All are public and available to every workspace.

#### Provision

| Blueprint | Description |
|---|---|
| **PostgreSQL Database** | Deploys a PostgreSQL instance from the service catalog and stores the connection credentials as a Vault secret grant |
| **Redis Cache** | Deploys a Redis instance and stores connection info as a Vault secret grant |
| **RabbitMQ Message Broker** | Deploys RabbitMQ with the management UI and stores credentials as a Vault secret grant |

#### Bootstrap

| Blueprint | Description |
|---|---|
| **Go API Bootstrap** | Scaffolds a production-ready Go API repository with a Dockerfile and GitHub Actions CI/CD pipeline |
| **Node.js API Bootstrap** | Scaffolds an Express API repository with a Dockerfile and GitHub Actions CI/CD pipeline |

#### DevOps

| Blueprint | Description |
|---|---|
| **Monitoring Stack** | Deploys Prometheus (`:9090`) and Grafana (`:3000`) to the target environment |
| **GitHub Actions CI/CD** | Generates a GitHub Actions build/test/deploy workflow and commits it to the repository |
| **GitLab CI/CD** | Generates a `.gitlab-ci.yml` pipeline and commits it to the repository |

#### Environment

| Blueprint | Description |
|---|---|
| **Environment Bootstrap** | Initialises an environment's secret namespace in Vault and applies baseline configuration |

---

### Versioning

Blueprints support semantic versioning. Multiple versions of the same blueprint can coexist. When deploying, the user selects the version. Previous versions remain available for rollback.

---

## Blueprint Structure

A blueprint captures all the metadata and automation steps needed to provision an application or service:

- **Name and description** — display metadata
- **Category** — `provision`, `bootstrap`, `devops`, `environment`, or `operate`
- **Icon** — display icon for the catalogue UI
- **Visibility** — public (all workspaces) or private (workspace-only)
- **Version** — semantic version string
- **Inputs schema** — user-facing input fields (text, environment selector, repository selector, existing deployment selector)
- **Steps config** — ordered list of automation steps executed at deploy time

### Step Types

| Step type | What it does |
|---|---|
| `deploy_catalog_item` | Deploy a service from the catalog into the target environment |
| `write_secret` | Store a value (e.g. generated credentials) as a Vault secret grant |
| `generate_repository` | Create a Git repository from a code template |
| `generate_cicd` | Generate and commit a CI/CD pipeline definition |
| `configure_environment` | Apply configuration to the target environment |

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
