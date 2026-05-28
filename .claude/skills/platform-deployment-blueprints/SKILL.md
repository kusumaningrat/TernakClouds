---
name: platform-deployment-blueprints
description: Implement deployment blueprint automation system for TernakClouds IDP using platform specifications, runtime generators, infrastructure abstraction, CI/CD generation, Vault integration, and provider-agnostic deployment workflows.
---

# Platform Deployment Blueprints Skill

## Overview

This skill implements the next-generation deployment workflow system inside TernakClouds IDP.

The goal is to transform deployments from:

- manual runtime operations
- handwritten manifests
- handwritten CI/CD pipelines
- manually configured Vault integrations

into:

- standardized deployment blueprints
- reusable platform workflows
- self-service application provisioning
- provider-agnostic deployment automation

This feature evolves TernakClouds from:

- runtime dashboard

into:

- platform engineering system

---

# Core Philosophy

Developers should NOT manually:

- write Nomad jobs
- write Kubernetes manifests
- write Docker runtime configs
- configure Vault integration
- create CI/CD pipelines
- configure observability
- configure deployment standards

Instead:

```text
Choose Blueprint
    ↓
Configure Inputs
    ↓
Platform Generates Everything
```

---

# Architecture Principles

## 1. Blueprint-Driven Platform

The platform MUST standardize deployments using reusable blueprints.

Avoid:

- deployment forms
- runtime-specific wizards
- low-level infrastructure management

Blueprints become:

- reusable
- versioned
- auditable
- standardized

---

## 2. Platform Specification Layer

The platform MUST introduce a normalized platform specification layer.

This becomes:

- source of truth
- generator input
- deployment contract

All generators MUST consume:

- the same platform spec

---

## 3. Generator-Based Architecture

The system MUST generate:

- runtime manifests
- CI/CD pipelines
- Vault integrations
- observability metadata
- deployment configuration

using modular generators.

Avoid:

- hardcoded deployment logic
- provider-specific deployment workflows

---

# Core Architecture

## Blueprint System

```text
Blueprint
├── Runtime
├── Database
├── Secrets
├── CI/CD
├── Registry
├── Observability
└── Deployment Strategy
```

---

## Platform Specification Layer

Example normalized platform specification:

```yaml
service:
  name: payments-api
  type: web-api

runtime:
  provider: kubernetes

deployment:
  strategy: rolling

registry:
  provider: harbor

database:
  type: postgres

secrets:
  provider: vault

cicd:
  provider: github-actions

observability:
  logs: true
  metrics: true
```

This specification becomes:

- generator input
- deployment contract
- system source of truth

---

# Generator Architecture

## Required Generator Types

```text
Generators
├── Runtime Generators
│    ├── Docker Generator
│    ├── Nomad Generator
│    └── Kubernetes Generator
│
├── CI/CD Generators
│    ├── GitHub Actions Generator
│    └── GitLab CI Generator
│
├── Secrets Generators
│    └── Vault Generator
│
├── Observability Generators
│    ├── Loki Labels Generator
│    └── Metrics Labels Generator
│
└── Infrastructure Generators
     ├── Database Generator
     └── Registry Generator
```

---

# Runtime Translation Layer

Platform specs MUST translate into runtime-specific manifests.

Example:

```text
Platform Spec
    ↓
Runtime Adapter
    ↓
Runtime Manifest
```

---

## Runtime Mappings

```text
Docker
    → Docker API Config

Nomad
    → Job HCL

Kubernetes
    → Deployment YAML
```

This preserves:

- provider abstraction
- deployment portability
- runtime independence

---

# Blueprint Categories

## Recommended Initial Blueprints

```text
Application Blueprints
├── Web API
├── Worker
├── Cron Job
├── Internal Service
├── Static Website
└── Background Processor
```

---

## Infrastructure Blueprints

```text
Infrastructure Blueprints
├── PostgreSQL
├── Redis
├── Object Storage
├── Kafka
└── Internal DNS
```

---

# Runtime Selection

Developers MUST choose runtime provider during provisioning.

Example:

```text
Runtime
├── Docker
├── Nomad
└── Kubernetes
```

The runtime provider determines:

- manifest generator
- deployment strategy
- runtime adapter

---

# Infrastructure Integration

## Database Integration

Blueprints MAY support:

- PostgreSQL
- MySQL
- Redis

The platform SHOULD:

- provision configuration
- generate connection metadata
- integrate Vault secret injection

---

## Registry Integration

Blueprints MUST support:

- Harbor
- Docker Hub
- GHCR
- ECR

Registry integrations SHOULD:

- generate image references
- configure pull policies
- integrate CI/CD authentication

---

## Vault Integration

Blueprints MUST support Vault secret integration.

Generated outputs MAY include:

- Vault paths
- secret injection metadata
- policy templates

Example:

```text
secret/data/workspaces/backend/dev/payments-api
```

---

# CI/CD Integration

## Supported CI/CD Providers

```text
CI/CD Providers
├── GitHub Actions
├── GitLab CI
├── Jenkins
└── Future Providers
```

---

## CI/CD Generation

The platform MUST generate:

- deployment workflows
- runtime deployment steps
- registry authentication
- runtime rollout configuration

Example outputs:

```text
.github/workflows/deploy.yml
.gitlab-ci.yml
jenkins-ci.groovy
```

---

# Observability Integration

Blueprints MUST automatically configure:

- log labels
- metrics labels
- service metadata

Required metadata:

```yaml
workspace:
environment:
service:
runtime:
provider:
deployment:
```

---

# Centralized Logs Architecture

```text
Runtime
   ↓
Promtail
   ↓
Loki
   ↓
TernakClouds Logs Explorer
```

Blueprint-generated services MUST automatically integrate into this flow.

---

# Service Lifecycle Architecture

## IMPORTANT

Services are platform abstractions.

Deployments are runtime executions.

Example:

```text
Service
 ├── Blueprint
 ├── Runtime
 ├── Deployments
 ├── Logs
 ├── Metrics
 └── Secrets
```

Avoid:

- runtime-centric UX
- manifest-centric workflows

---

# Frontend UX Architecture

## Recommended Workflow

```text
Create Application
    ↓
Choose Blueprint
    ↓
Choose Runtime
    ↓
Configure Infrastructure
    ↓
Configure CI/CD
    ↓
Configure Secrets
    ↓
Review Generated Resources
    ↓
Provision
```

---

# Generated Resource Preview

Before provisioning, the platform SHOULD show generated resources.

Example previews:

```text
Generated Resources
├── Kubernetes YAML
├── Nomad Job
├── Docker Runtime Config
├── GitHub Actions Workflow
├── Vault Policies
└── Deployment Metadata
```

This improves:

- auditability
- trust
- debuggability

---

# Backend Domain Structure

Recommended backend structure:

```text
domains/
├── blueprints/
├── generators/
├── runtimes/
├── deployments/
├── services/
├── cicd/
├── secrets/
├── observability/
├── infrastructure/
└── registries/
```

---

# Blueprint Storage Model

Blueprints SHOULD support:

- versioning
- visibility control
- runtime compatibility
- parameter schema

Example:

```yaml
blueprint:
  name: web-api
  version: v1

supported_runtimes:
  - docker
  - nomad
  - kubernetes
```

---

# Policy & Governance

Blueprints become platform governance layer.

The platform SHOULD enforce:

- deployment standards
- observability standards
- runtime compatibility
- CI/CD consistency
- secret management consistency

---

# Security Requirements

NEVER:

- expose raw runtime credentials
- expose unrestricted runtime execution
- expose unrestricted deployment manifests

ALL provisioning MUST pass through:

- platform validation
- RBAC
- runtime adapters
- blueprint standards

---

# Recommended Implementation Phases

## Phase 1 — Blueprint Foundation

Implement:

- blueprint engine
- platform specification layer
- runtime abstraction
- runtime generators

---

## Phase 2 — Deployment Automation

Implement:

- runtime manifest generation
- deployment provisioning
- service deployment lifecycle
- deployment history

---

## Phase 3 — Secrets & CI/CD

Implement:

- Vault integration
- CI/CD generation
- registry authentication
- deployment automation

---

## Phase 4 — Observability

Implement:

- centralized logs
- metrics integration
- service correlation
- deployment observability

---

## Phase 5 — Infrastructure Products

Implement:

- infrastructure provisioning
- database blueprints
- self-service infrastructure
- infrastructure ownership

---
