---
name: docker-runtime-provider
description: Implement Docker Runtime Provider integration into TernakClouds IDP using runtime abstraction, capability-driven architecture, service-centric workflows, centralized observability, and future deployment automation support.
---

# Docker Runtime Provider Skill

# Overview

This skill implements native Docker Engine integration into TernakClouds IDP as a lightweight runtime provider.

The goal is NOT to:

- create a Portainer clone
- expose raw Docker infrastructure
- expose unrestricted Docker daemon access
- tightly couple Docker-specific workflows into the platform

Instead, Docker becomes:

- another runtime provider
- another deployment target
- another execution backend

inside the TernakClouds runtime abstraction architecture.

This feature extends the platform into:

- VPS deployments
- lightweight workloads
- local runtimes
- edge deployments
- small-team environments
- homelab usage

while preserving:

- provider abstraction
- service-centric workflows
- centralized observability
- deployment standardization
- environment isolation

---

# Platform Context

TernakClouds already supports:

- Nomad runtime provider
- Kubernetes runtime provider
- services
- deployments
- registries
- environments
- secrets
- runtime abstraction
- centralized observability direction

Docker MUST integrate cleanly into this architecture.

---

# Architecture Principles

# 1. Docker Is Runtime Provider

Docker MUST behave as:

- runtime provider
- runtime target
- workload backend

similar to:

- Nomad
- Kubernetes

Avoid:

- Docker-only workflows
- Docker-specialized frontend
- runtime-specific hardcoding

---

# 2. Capability-Driven Runtime Architecture

Frontend and backend MUST dynamically render runtime functionality using capabilities.

Avoid:

```ts
if runtime === "docker"

Use:

capabilities.includes("containers")

This ensures:

scalability
extensibility
provider abstraction
```

# 3. Service-Centric UX

Services remain:

logical applications
platform abstractions
deployment ownership units

Docker containers are:

runtime implementation details

Example:

Service
└── Runtime
└── Docker Container

Developers interact with:

services
deployments
logs
observability

NOT:

raw runtime infrastructure
Runtime Provider Model
Runtime Providers
Runtime Providers
├── Docker
├── Nomad
└── Kubernetes

Each provider exposes:

capabilities
runtime inventory
runtime metadata
logs
health state
Docker Runtime Capabilities

Docker provider capabilities:

```ts
{
  "provider": "docker",
  "capabilities": [
    "containers",
    "images",
    "logs",
    "networks",
    "volumes",
    "exec"
  ]
}
```

Unsupported Initial Capabilities

Docker integration initially does NOT support:

orchestration
rolling deployments
scheduling
autoscaling
multi-node coordination

Those remain responsibilities of:

Nomad
Kubernetes
Backend Architecture
Recommended Domain Structure

```ts
domains/
├── runtime/
│    ├── providers/
│    │    ├── docker/
│    │    ├── nomad/
│    │    └── kubernetes/
│    │
│    ├── capabilities/
│    ├── inventory/
│    ├── adapters/
│    └── health/
│
├── services/
├── deployments/
├── observability/
├── registries/
└── templates/
```

Docker Provider Responsibilities
Runtime Inventory

The Docker provider MUST support:

list containers
inspect containers
list images
list networks
list volumes
Runtime Operations

The Docker provider MUST support:

start container
stop container
restart container
remove container
Runtime Metadata

Expose:

container id
image
labels
ports
status
runtime host
Logs

The Docker provider MUST support:

live logs streaming
historical logs
container log inspection

Make sure to add docker logs into Observability Runtime in current feature
