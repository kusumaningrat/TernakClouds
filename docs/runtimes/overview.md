# Runtime Providers

TernakClouds abstracts workload orchestration behind a runtime provider model. The platform ships with Kubernetes and Nomad providers. The UI and API remain identical regardless of which runtime is in use.

---

## Runtime Abstraction

The frontend and API never communicate directly with Kubernetes or Nomad. All runtime operations are proxied through the TernakClouds backend, which:

1. Resolves the correct provider endpoint from the environment's capability binding
2. Retrieves authentication credentials from Vault
3. Translates the platform request into a runtime-specific API call
4. Normalizes the response into a platform model

```
Developer requests workload list
           │
           ▼
 TernakClouds API (/kubernetes/pods or /nomad/jobs)
           │
           │  1. Resolve provider from CapabilityBinding
           │  2. Retrieve token from Vault
           │  3. Forward to runtime API
           ▼
  Kubernetes API server  /  Nomad HTTP API
           │
           ▼
  Normalized response → developer
```

This means:
- Developers never see cluster credentials
- Changing the underlying runtime doesn't change the developer experience
- New runtimes can be added by implementing the provider proxy without frontend changes

---

## Binding a Runtime Provider

Runtime providers are bound per-environment through **Platform → Runtime**.

Requirements:
- Platform role: `admin` or `manager` (requires `environments:write` permission)
- Workspace role: `owner`

Steps:
1. Navigate to your environment → **Platform → Runtime**
2. Click **Add provider**
3. Select the provider (`Kubernetes` or `Nomad`)
4. Enter the API endpoint
5. Enter the authentication token (stored in Vault)
6. Optionally enter a namespace and region
7. Click **Add provider**
8. Click **Verify** to confirm the endpoint is reachable

Multiple providers can be bound to the same environment's runtime capability (e.g. one Kubernetes cluster and one Nomad cluster in the same environment).

---

## Kubernetes Provider

### Configuration

| Field | Example | Description |
|---|---|---|
| Endpoint | `https://k8s-api.internal:6443` | Kubernetes API server URL |
| Token | `eyJhbGci...` | Bearer token (service account or user token) |
| Namespace | `default` | Default namespace hint (optional) |

### Required Permissions

The service account token used must have at minimum:

```yaml
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "namespaces", "services"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch", "patch"]  # patch for scaling
```

### Operations

| Operation | API Path | Description |
|---|---|---|
| List namespaces | `GET /kubernetes/namespaces` | All namespaces on the cluster |
| List pods | `GET /kubernetes/pods?namespace=<ns>` | Pods in a namespace |
| Pod detail | `GET /kubernetes/pods/:ns/:name` | Full pod spec and status |
| List deployments | `GET /kubernetes/deployments?namespace=<ns>` | Deployments in a namespace |
| Deployment detail | `GET /kubernetes/deployments/:ns/:name` | Deployment spec, replicas |
| Scale deployment | `PATCH /kubernetes/deployments/:ns/:name/scale` | Set replica count |
| Stream pod logs | `GET /kubernetes/pods/:ns/:name/logs` | SSE log stream |

### Log Streaming

Kubernetes log streaming proxies the native `kubectl logs --follow` behavior:

```
GET /kubernetes/pods/{namespace}/{name}/logs?container={container}&follow=true
```

The `container` parameter is required for pods with multiple containers. Available containers are returned in the pod detail response.

---

## Nomad Provider

### Configuration

| Field | Example | Description |
|---|---|---|
| Endpoint | `https://nomad.internal:4646` | Nomad HTTP API URL |
| Token | `00000000-0000-0000-0000-000000000000` | Nomad ACL token |
| Namespace | `default` | Default Nomad namespace (optional) |

### Required Permissions (Nomad ACL Policy)

```hcl
namespace "*" {
  policy = "read"
  capabilities = ["list-jobs", "read-job", "read-logs"]
}

node {
  policy = "read"
}
```

### Operations

| Operation | API Path | Description |
|---|---|---|
| List namespaces | `GET /nomad/namespaces` | Nomad namespaces |
| List nodes | `GET /nomad/nodes` | Cluster nodes |
| List jobs | `GET /nomad/jobs?namespace=<ns>` | Jobs in a namespace |
| Job detail | `GET /nomad/jobs/:jobID?namespace=<ns>` | Full job spec and status |
| List allocations | `GET /nomad/jobs/:jobID/allocations` | Job allocations |
| Allocation detail | `GET /nomad/allocations/:allocID` | Allocation state and task events |
| Stream logs | `GET /nomad/allocations/:allocID/logs` | SSE log stream |
| Stop job | `POST /nomad/jobs/:jobID/stop` | Deregister job |
| Start job | `POST /nomad/jobs/:jobID/start` | Re-register job |

### Log Streaming

Nomad log streaming uses the Nomad client API:

```
GET /nomad/allocations/{allocID}/logs?task={task}&type={stdout|stderr}&follow=true&origin=start
```

Parameters:
- `task` — task name within the allocation (required)
- `type` — `stdout` or `stderr` (default: `stdout`)
- `follow` — `true` to tail, `false` for static dump (default: `true`)
- `origin` — `start` to replay + tail, `end` for tail only (default: `start`)

The platform automatically resolves the latest running allocation from a job ID when streaming from the Logs page.

---

## Workload Model

All runtimes normalize their workloads into a shared model for the frontend:

```typescript
interface RuntimeWorkload {
  id: string;          // Kubernetes: pod name | Nomad: job ID
  runtime: string;     // "kubernetes" | "nomad"
  type: string;        // "service" | "job" | "cron" | "task"
  name: string;        // Display name
  namespace?: string;  // Kubernetes namespace | Nomad namespace
  status?: string;     // "running" | "pending" | "dead" | ...
  metadata?: {
    containers?: string[];   // Kubernetes: container names
    job_type?: string;       // Nomad: "service" | "batch" | "system"
  };
}
```

The frontend works with `RuntimeWorkload` objects and never needs to handle Kubernetes or Nomad specifics.

---

## Adding a New Runtime (Extensibility)

To add a new runtime provider:

1. Create a package under `server/internal/<runtime>/`
2. Implement handler functions that proxy the runtime's API
3. Register routes under the environment group in `server/internal/server/server.go`
4. Add the provider to the seeded catalogue in `server/internal/providers/`
5. Add workload fetching logic to `useLogsWorkloads` in `admin/src/lib/queries.ts`
6. Handle the new runtime in `useLogsStream` for log streaming

The UI will automatically show the new runtime as a selectable option in the Logs page once the provider is bound to an environment.
