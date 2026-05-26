# Logs Platform

TernakClouds provides centralized, runtime-agnostic log streaming. Developers can tail, search, and filter logs from any workload without `kubectl logs`, direct Nomad allocation access, or infrastructure knowledge.

---

## Architecture

```
Runtime Workloads (pods / allocations)
            │
            │  Runtime native log API
            ▼
 TernakClouds Backend (proxy + SSE)
            │
            │  Server-Sent Events
            ▼
   Admin Dashboard (Logs page)
   live tail · search · filter · highlight
```

The backend proxies directly to runtime log APIs (Kubernetes pod logs, Nomad client allocation logs) and re-emits them as SSE events. Loki (or another logs backend) is available as an optional storage layer for historical log querying.

---

## Two Modes of Log Access

### 1. Live Streaming (Runtime Direct)

The primary mode. The platform opens a streaming connection to the runtime API and forwards log lines in real time.

- **Kubernetes:** proxies `kubectl logs --follow` via the Kubernetes API server
- **Nomad:** proxies allocation log streaming via the Nomad client HTTP API

This works without any logs backend configuration. As long as a runtime provider is bound to the environment, live log streaming is available.

### 2. Historical / Aggregated (Logs Backend)

When a logs backend provider (Loki, OpenSearch, Elasticsearch) is bound in **Platform → Logs Backend**, historical log queries become available. The backend provider stores logs forwarded by a collector (Promtail, Fluent Bit, Vector).

> The frontend never communicates directly with Loki. All queries go through the TernakClouds API, which translates generic queries into LogQL or the appropriate backend query language.

---

## Configuring a Logs Backend

Navigate to **Platform → Logs Backend** in any environment.

### Adding Loki

1. Click **Add provider** → select **Loki**
2. Enter the Loki endpoint (e.g. `https://loki.internal:3100`)
3. Token is optional — leave blank for unauthenticated Loki
4. Click **Add provider**
5. Click **Verify** to confirm the `/ready` endpoint responds

Loki does not require an authentication token for self-hosted instances. For Grafana Cloud or authenticated Loki, provide a bearer token.

### Provider Configuration

| Field | Description |
|---|---|
| Endpoint | Base URL of the logs backend |
| Token | Bearer token (optional for Loki, required for cloud providers) |
| Namespace | Optional namespace hint for scoping queries |
| Region | Optional region for cloud-hosted backends |

---

## Using the Logs Page

Navigate to any environment → **Logs** in the sidebar.

### Controls

| Control | Description |
|---|---|
| **Runtime** | Select the runtime provider (Kubernetes or Nomad) |
| **Namespace** | Filter workloads by namespace (dropdown, populated from the cluster) |
| **Workload** | Select a pod (Kubernetes) or job (Nomad) |
| **Container** | Select a container within the pod (Kubernetes; dropdown auto-populated) |
| **Task** | Select a task within the job (Nomad; dropdown auto-populated from job definition) |
| **Source** | `stdout` or `stderr` |
| **Stream** | Start live tailing |
| **Stop** | Stop the stream |

### Streaming

Click **Stream** to begin live log tailing. The terminal shows:

- `idle` — not streaming
- `connecting…` — stream opening
- `live` (pulsing dot) — connected and receiving logs
- Error message — stream failed

Logs are capped at 3,000 lines. Older lines are dropped as new ones arrive to prevent memory growth.

### Search and Filter

Use the **Search** bar in the terminal toolbar to filter displayed log lines:

- Type a search term and press `Enter` or click **Search**
- Only lines containing the term are shown
- Matching text is highlighted in yellow
- The line counter shows `N / Total` when a filter is active
- Press `Escape` or click `✕` to clear the filter

Search is purely client-side — it filters the lines already received in the browser. It does not affect the streaming connection.

### Namespace Dropdown

The namespace field is a dropdown populated from the runtime cluster. Changing the namespace clears the workload selection and re-fetches the workload list for the new namespace.

---

## SSE Protocol

The backend uses Server-Sent Events for all log streaming. Event format:

```
event: connected
data: {}

event: log
data: 2026-05-26T10:00:00Z INFO starting server port=8080

event: log
data: 2026-05-26T10:00:01Z INFO request path=/health status=200

event: error
data: connection refused
```

The client reads the response body as a byte stream, parses SSE blocks split by double newlines, and dispatches events to React state.

---

## Kubernetes Log Streaming Detail

```
GET /kubernetes/pods/{namespace}/{name}/logs?container={container}&follow=true
Authorization: Bearer <platform-token>
```

The backend:
1. Retrieves the Kubernetes service account token from Vault
2. Opens: `GET {k8s-api}/api/v1/namespaces/{ns}/pods/{name}/log?container={c}&follow=true`
3. Reads line-by-line with `bufio.Scanner`
4. Emits each line as `event: log`

The `container` parameter is required. Available container names are returned in the pod detail response and shown in the Container dropdown.

---

## Nomad Log Streaming Detail

```
GET /nomad/allocations/{allocID}/logs?task={task}&type=stdout&follow=true&origin=start
Authorization: Bearer <platform-token>
```

The backend:
1. Retrieves the Nomad ACL token from Vault
2. Opens: `GET {nomad}/v1/client/fs/logs/{allocID}?task={task}&type={type}&follow={follow}&origin={origin}`
3. JSON-decodes `LogFrame` objects (base64-encoded log content)
4. Decodes and splits by newlines
5. Emits each line as `event: log`

**Allocation resolution:** The Logs page automatically resolves the latest running allocation from a job ID. It fetches allocations for the selected job, prefers `ClientStatus=running`, and sorts by `ModifyTime` descending.

**Task discovery:** When a Nomad workload is selected, the platform fetches the job detail and extracts task names from `TaskGroups[].Tasks[]`. These populate the Task dropdown automatically.

---

## Logs Backend Verify

Each bound logs backend provider has a **Verify** button that tests connectivity:

- Makes a `GET {endpoint}/ready` request (standard Loki health path)
- Attaches the stored bearer token from Vault if present
- 5-second timeout
- Reports `reachable` (green badge) or `unreachable` (red badge)

The verify endpoint is:
```
POST /capabilities/logs/provider/{providerID}/verify
```

---

## Structured Log Recommendations

For the best experience with the search and filter features, applications should emit structured JSON logs:

```json
{
  "timestamp": "2026-05-26T10:00:00Z",
  "level": "error",
  "service": "payments",
  "message": "database timeout after 30s",
  "traceId": "abc123",
  "requestId": "req-456"
}
```

Recommended fields:
- `timestamp` — ISO 8601
- `level` — `debug`, `info`, `warn`, `error`
- `service` — service name
- `message` — human-readable description
- `traceId` — for correlation (high cardinality — put in payload, not Loki labels)

---

## Future: Loki-Backed Historical Search

The current implementation streams directly from runtime APIs. Planned enhancements:

- Historical log queries via Loki (time-range search, not just live tail)
- LogQL translation layer (backend translates generic queries → LogQL)
- Multi-workload log correlation
- Deployment-correlated log views (show logs since deployment X)
