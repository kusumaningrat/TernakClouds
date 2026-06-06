---
name: TernakClouds Runtime Logs Platform Architect
description: Design and implement provider-agnostic centralized logs streaming architecture for the TernakClouds Internal Developer Platform. Use when building logs streaming, runtime integrations, observability workflows, search/filter systems, Loki integrations, Kubernetes logs aggregation, Nomad logs support, RBAC enforcement, and developer troubleshooting experiences.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
---

# TernakClouds Runtime Logs Platform Architect

## Mission

Build a centralized logs platform inside the TernakClouds Internal Developer Platform.

The logs platform must:

- aggregate logs from multiple runtimes
- support real-time logs streaming
- provide advanced search and filtering
- abstract infrastructure complexity
- centralize troubleshooting workflows
- enforce tenant isolation and RBAC
- support future runtime integrations

The system should become the default debugging and operational visibility experience for developers.

---

# Product Goals

Developers should NOT need:

- kubectl logs
- direct pod access
- Nomad allocation inspection
- SSH access
- infrastructure-specific knowledge

Instead, developers should:

- open the Logs page
- select workload/environment
- search logs instantly
- stream logs live
- correlate deployments and failures
- troubleshoot centrally

The platform must hide runtime complexity.

---

# Supported Runtime Targets

The architecture must support:

- Kubernetes
- Nomad
- Docker
- VM workloads
- bare-metal services
- future runtimes

The frontend experience must remain consistent regardless of backend runtime.

---

# Core Architecture Principle

Never tightly couple:

- UI
- APIs
- business logic
- observability workflows

to:

- Kubernetes
- Loki
- Nomad
- Elasticsearch
- any specific runtime or storage provider

All runtime integrations must go through abstraction layers.

---

# High-Level Architecture

```text
Runtime Workloads
    ↓
Runtime Log Collectors
    ↓
Logs Storage Backend
    ↓
Runtime Logs Provider
    ↓
Unified Logs Service
    ↓
Logs API
    ↓
Logs UI
```

---

# Architecture Layers

## 1. Runtime Layer

Responsible for workload orchestration.

Examples:

- Kubernetes
- Nomad
- Docker
- VMs

This layer owns:

- workloads
- scheduling
- containers
- jobs
- deployments

---

## 2. Collection Layer

Responsible for:

- collecting logs
- forwarding logs
- enriching metadata

Supported collectors:

- Promtail
- Fluent Bit
- Vector
- Filebeat

Collectors should enrich logs with:

- environment
- workload
- cluster
- namespace
- service metadata

---

## 3. Storage Layer

Responsible for:

- indexing
- querying
- retention
- compression
- streaming

Supported backends:

- Loki
- Elasticsearch/OpenSearch
- CloudWatch
- Datadog
- future providers

Preferred MVP backend:

- Loki

Reason:

- Kubernetes-native
- efficient streaming
- low operational overhead
- label-based querying
- cheaper than Elasticsearch

---

# Runtime Logs Provider Layer

This is the most important abstraction boundary.

The provider layer:

- translates generic queries
- normalizes runtime metadata
- streams logs
- abstracts storage/runtime complexity
- enforces provider-specific logic

Every runtime implementation must implement this interface.

---

# Provider Interface

```ts
interface RuntimeLogsProvider {
  name(): string;

  capabilities(): ProviderCapabilities;

  workloads(filters: WorkloadFilters): Promise<RuntimeWorkload[]>;

  search(query: LogsQuery): Promise<LogsResult>;

  stream(query: StreamQuery): AsyncIterable<LogEvent>;

  labels(): Promise<LabelMetadata>;
}
```

---

# Important Design Rule

Frontend MUST NEVER:

- generate LogQL
- understand Kubernetes labels
- understand Nomad allocations
- know Loki query syntax
- know storage backend internals

Provider layer owns ALL translation logic.

---

# Runtime-Agnostic Workload Model

Normalize all workloads into shared models.

```ts
interface RuntimeWorkload {
  id: string;
  runtime: string;
  type: "service" | "job" | "cron" | "task";
  name: string;
  environment?: string;
  namespace?: string;
  status?: string;
  metadata?: Record<string, any>;
}
```

Examples:

- Kubernetes Deployment
- Kubernetes Job
- Nomad Job
- Docker Container

All become RuntimeWorkload.

---

# Unified Log Event Model

All providers must emit normalized log events.

```ts
interface LogEvent {
  timestamp: string;
  runtime: string;
  workload: string;
  level?: string;
  source?: string;
  message: string;
  metadata?: Record<string, any>;
}
```

Frontend should not care:

- where logs came from
- which runtime produced them
- which backend stores them

---

# Query Abstraction

Frontend sends generic queries only.

Example:

```json
{
  "runtime": "kubernetes",
  "environment": "production",
  "workload": "payments-api",
  "search": "timeout",
  "level": "error",
  "since": "1h",
  "stream": true
}
```

Provider translates internally.

---

# Search & Filtering

Support filters:

- runtime
- environment
- workload
- namespace
- cluster
- service
- log level
- labels
- timestamp range
- deployment version

Search support:

- keyword search
- regex search
- JSON structured filtering
- fuzzy matching
- multi-workload search

---

# Streaming Requirements

Support:

- live tailing
- websocket streaming
- reconnect handling
- pause/resume
- multi-workload streaming
- timestamp synchronization

Preferred transport:

- WebSocket

Alternative:

- SSE

---

# Loki Integration Strategy

Loki should be implemented as:

- storage backend
- streaming backend

NOT as:

- frontend dependency
- direct UI integration

Frontend must only communicate with:

- Unified Logs API

Never expose Loki publicly.

---

# Kubernetes Runtime Provider

Responsibilities:

- map deployments/pods/jobs
- translate queries into LogQL
- enrich Kubernetes metadata
- aggregate multi-pod streams

Typical labels:

- namespace
- app
- cluster
- pod
- container

---

# Nomad Runtime Provider

Responsibilities:

- map jobs/allocations/task groups
- normalize Nomad metadata
- stream allocation logs
- aggregate task logs

Nomad internals must remain hidden from frontend.

---

# LogQL Translation Examples

Namespace filter:

```logql
{namespace="payments"}
```

Application logs:

```logql
{namespace="payments", app="checkout"}
```

Search logs:

```logql
{app="checkout"} |= "timeout"
```

Structured logs:

```logql
{app="checkout"} | json | level="error"
```

Regex query:

```logql
{namespace="prod"} |~ "timeout|connection refused"
```

Only providers generate LogQL.

---

# Structured Logging Standard

Applications should emit JSON logs.

Preferred format:

```json
{
  "timestamp": "2026-05-26T10:00:00Z",
  "level": "error",
  "service": "payments",
  "message": "database timeout",
  "traceId": "abc123"
}
```

Preferred fields:

- timestamp
- level
- service
- message
- traceId
- requestId
- environment

---

# Labeling Best Practices

Prefer LOW-cardinality labels.

Recommended labels:

- namespace
- environment
- cluster
- app
- workload
- container

Avoid high-cardinality labels:

- traceId
- requestId
- userId
- sessionId

High-cardinality values belong in payloads, not labels.

---

# Frontend UX Expectations

The logs page should support:

- infinite scrolling
- virtualized rendering
- search highlighting
- JSON prettify
- live stream indicators
- filter sidebar
- saved searches
- workload selector
- deployment correlation
- copy/share logs
- dark mode readability

Target UX inspirations:

- Grafana Logs
- Kibana Discover
- Datadog Logs
- Lens logs viewer

---

# Deployment Correlation

Support:

- logs since deployment
- rollout inspection
- failed deployment debugging
- deployment version filtering

Examples:

- show logs after deployment v1.4.2
- show logs around rollout failure

---

# Multi-Tenant Security

All providers MUST enforce:

- namespace isolation
- environment restrictions
- tenant boundaries
- RBAC policies
- audit logging

Never trust frontend filters alone.

---

# Security Requirements

Always enforce:

- query validation
- query bounds
- request limits
- streaming limits
- namespace scoping
- tenant isolation
- rate limiting

Prevent:

- unrestricted wildcard queries
- cluster-wide exposure
- cross-team access
- expensive unbounded searches

---

# Backend Responsibilities

The backend MUST:

- proxy logs safely
- abstract providers
- enforce RBAC
- sanitize queries
- normalize events
- manage streaming sessions
- support pagination
- audit requests

Never expose:

- Loki directly
- runtime credentials
- internal cluster topology

---

# Runtime Registration System

Avoid hardcoded runtime conditionals.

Preferred model:

```ts
logsProviders.register(new KubernetesLogsProvider());

logsProviders.register(new NomadLogsProvider());
```

System should support runtime plugins/extensions.

---

# Recommended Backend Structure

```text
internal/
  runtime/
    logs/
      providers/
        kubernetes/
        nomad/
      interfaces/
      query/
      streaming/
      security/
      normalization/
      storage/
```

---

# Recommended MVP

## Phase 1

- provider abstraction
- Kubernetes runtime provider
- Loki integration
- centralized logs page
- live streaming
- basic filtering

## Phase 2

- Nomad runtime provider
- advanced search
- structured logs
- saved filters
- deployment correlation

## Phase 3

- metrics correlation
- traces integration
- AI summarization
- anomaly detection
- incident insights

---

# Future Observability Direction

Target platform observability stack:

- logs
- traces
- metrics
- events

Future integrations:

- Loki
- Tempo
- Prometheus
- OpenTelemetry

Long-term goal:

- unified operational visibility platform

---

# Engineering Principles

Prefer:

- provider abstractions
- normalized models
- modular runtimes
- runtime plugins
- infrastructure isolation
- centralized RBAC

Avoid:

- Kubernetes-specific frontend logic
- provider lock-in
- direct storage exposure
- runtime leakage into UI

---

# Success Criteria

The feature succeeds when:

- developers stop relying on kubectl logs
- logs become centralized
- runtime complexity is hidden
- new runtimes are easy to add
- debugging workflows improve
- operational visibility becomes platform-native
- observability works consistently across runtimes
- the logs page becomes the default troubleshooting interface
