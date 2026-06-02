# Service Catalog

The Service Catalog is a collection of ready-to-deploy service templates. Each catalog item represents a commonly needed workload (database, cache, queue, web server) with sensible defaults pre-configured. Developers can deploy catalog items in a few clicks without writing any manifests.

---

## Concepts

### Catalog Item

A catalog item is a deployment template with pre-set configuration:

- Container image and tag
- Default CPU and memory allocations
- Default port bindings
- Health check configuration (HTTP or TCP)
- Display metadata (name, description, icon)
- Public/private image flag (for registry-authenticated pulls)

Catalog items are seeded by the platform at startup and are read-only.

### Service Deployment

A Service Deployment is an instance of a catalog item running in an environment. Each deployment tracks:

- The source catalog item
- Target runtime and environment
- Deployment status
- The exact job definition submitted to the runtime (HCL or YAML)
- Registry binding (if a private image)

---

## Deploying a Service

Navigate to **Services** in any environment.

1. Click **Deploy service**
2. Browse the catalog and select a service
3. Select the target runtime (Kubernetes, Nomad, or Docker)
4. Optionally override resource defaults
5. Select a registry binding if the image is private
6. Click **Deploy**

The platform renders the service spec into a runtime-specific manifest, submits it to the runtime, and tracks the deployment.

---

## Deployment Lifecycle

```
Deploy clicked
     │
     ▼
ServiceDeployment created (status: pending)
     │
     ▼
Manifest generated and submitted to runtime
     │
     ├── Success → status: running
     │
     └── Error   → status: failed
```

Deployments can be stopped or deleted from the deployment detail page.

| Action | Description |
|---|---|
| **Stop** | Stops the running workload in the runtime; deployment record is retained |
| **Delete** | Stops the workload and removes the deployment record |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/service-catalog/items` | List all catalog items |
| `GET` | `/service-catalog/items/:id` | Get a catalog item |
| `GET` | `/service-catalog/deployments` | List all deployments in the environment |
| `GET` | `/service-catalog/deployments/:id` | Get a deployment and its status |
| `POST` | `/service-catalog/deployments` | Create a new deployment |
| `POST` | `/service-catalog/deployments/:id/stop` | Stop a running deployment |
| `DELETE` | `/service-catalog/deployments/:id` | Delete a deployment |

---

## Multi-Runtime Support

The service catalog supports deploying to any runtime bound to the environment. When submitting a deployment, the `runtime` field selects which provider to target.

Supported values: `kubernetes`, `nomad`, `docker`

The same catalog item can be deployed to multiple runtimes in the same environment. Each deployment is tracked independently.

---

## Private Images

If a catalog item uses a private container image, a registry binding must be present in the environment before deploying. See [Container Registries](../registry/overview.md) for configuration steps.

When a private registry is selected on deployment, the generated manifest includes the appropriate image pull secret or authentication configuration for the target runtime.
