---
name: ternakclouds-repository-provider-architect
description: Design and implement repository provider integrations for the TernakClouds Internal Developer Platform. Use when building repository provider abstractions, GitHub/GitLab integrations, workflow manifest generation, GitOps repository synchronization, RBAC enforcement, repository access management, SCM provider registration, or secure repository automation workflows.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
---

# TernakClouds Repository Provider Architect

## Mission

Build a provider-agnostic repository integration system for the TernakClouds Internal Developer Platform. The repository integration should be alive inside the workspace level

The repository provider system must:

- connect external SCM providers
- store generated workflow manifests
- manage repository integrations securely
- support GitOps workflows
- enforce RBAC boundaries
- abstract provider-specific logic
- support future SCM providers

The architecture must support:

- GitHub
- GitLab
- future repository providers

without frontend rewrites.

---

# Product Goals

The platform should allow IDP administrators to:

- register repository providers
- connect repositories securely
- store generated manifests
- synchronize workflows automatically
- centralize deployment manifests
- manage repository access safely

The system should support:

- generated CI/CD workflows
- deployment manifests
- runtime manifests
- GitOps repositories
- environment-specific manifests

---

# Core Principle

Never tightly couple:

- frontend
- APIs
- workflow generation
- deployment orchestration

to:

- GitHub
- GitLab
- provider-specific APIs

All repository integrations must go through provider abstractions.

---

# High-Level Architecture

```text
IDP UI
   ↓
Repository Service
   ↓
Repository Provider Layer
   ↓
GitHub / GitLab / Future Providers
```

---

# Repository Provider Responsibilities

The provider layer is responsible for:

- repository authentication
- repository validation
- repository synchronization
- branch management
- manifest commits
- pull request creation
- provider-specific API translation
- repository metadata normalization

The frontend must remain provider-agnostic.

---

# Provider Interface

```ts
interface RepositoryProvider {
  name(): string;

  validateConnection(config: ProviderConfig): Promise<ValidationResult>;

  repositories(): Promise<Repository[]>;

  branches(repository: RepositoryRef): Promise<Branch[]>;

  commitFiles(request: CommitRequest): Promise<CommitResult>;

  createPullRequest(request: PullRequestRequest): Promise<PullRequestResult>;

  capabilities(): ProviderCapabilities;
}
```

---

# Supported Providers

## GitHub Provider

Responsibilities:

- authenticate using Personal Access Token
- validate repository access
- commit generated manifests
- create pull requests
- manage branches

---

## GitLab Provider

Responsibilities:

- authenticate using Personal Access Token
- validate project access
- synchronize manifests
- support merge request workflows

---

# Authentication Model

IDP administrators connect repository providers using:

- Personal Access Tokens (PAT)

Tokens must:

- use least privilege access
- be scoped minimally
- be encrypted at rest
- never exposed publicly

---

# Recommended Token Permissions

## GitHub

Recommended scopes:

- repo
- contents:write
- pull_requests:write

Avoid:

- admin scopes
- organization-wide permissions
- unnecessary write access

---

## GitLab

Recommended scopes:

- api
- read_repository
- write_repository

Prefer project-scoped tokens whenever possible.

---

# Important Security Principle

The platform must NEVER:

- expose raw access tokens
- log tokens
- return tokens to frontend clients
- store tokens unencrypted

Tokens must always be:

- encrypted at rest
- masked in logs
- write-only after creation

---

# Repository Registration Flow

Recommended flow:

```text
Admin connects provider
    ↓
Validate token access
    ↓
List accessible repositories
    ↓
Select repository
    ↓
Store encrypted provider configuration
    ↓
Apply RBAC bindings
```

---

# Repository Ownership Model

Repositories must belong to:

- organizations
- teams
- projects
- environments

Never allow unrestricted global repository access.

---

# RBAC Requirements

Repository integrations MUST enforce:

- tenant isolation
- team ownership
- project-level permissions
- environment boundaries
- repository visibility restrictions

Examples:

- only authorized teams may manage repository bindings
- developers may view repositories but not rotate credentials
- only platform admins may register providers

---

# Repository Access Model

Example:

```ts
interface RepositoryBinding {
  repositoryId: string;
  provider: string;
  projectId: string;
  allowedTeams: string[];
  environments: string[];
}
```

---

# Workflow Manifest Generation

Generated artifacts may include:

- CI/CD workflows
- Kubernetes manifests
- Helm values
- runtime definitions
- deployment templates
- GitOps manifests
- secrets references

The repository provider is responsible for:

- committing generated artifacts
- synchronizing repository state

---

# GitOps Direction

The architecture should support:

- GitOps workflows
- manifest repositories
- environment repositories
- application repositories
- centralized deployment repositories

Future integrations:

- ArgoCD
- FluxCD

---

# Commit Strategy

Preferred strategies:

- commit directly to branch
- create pull requests
- create merge requests

Provider capabilities determine supported workflows.

---

# Branch Management

Support:

- configurable target branches
- environment branches
- feature branches
- temporary manifest branches

Examples:

- main
- develop
- staging
- production

---

# Pull Request Workflow

Support:

- automatic PR creation
- merge request creation
- reviewers assignment
- commit metadata
- deployment summaries

Example:

- generated deployment manifest update PR

---

# Repository Normalization

All providers must normalize repositories into shared models.

```ts
interface Repository {
  id: string;
  provider: string;
  organization: string;
  name: string;
  defaultBranch?: string;
  visibility?: string;
}
```

Frontend should not care:

- whether repository comes from GitHub
- GitLab
- future providers

---

# Provider Capabilities

Different providers support different features.

```ts
interface ProviderCapabilities {
  pullRequests: boolean;
  mergeRequests: boolean;
  branchProtection: boolean;
  commitSigning: boolean;
}
```

Frontend adapts dynamically.

---

# Backend Responsibilities

Backend MUST:

- proxy provider access securely
- validate repository ownership
- enforce RBAC
- encrypt credentials
- sanitize provider responses
- normalize metadata
- audit repository operations

Never expose provider internals directly.

---

# Secret Management

Repository credentials should integrate with:

- Vault
- secrets providers
- encrypted credential stores

Avoid:

- plaintext configuration files
- environment variable leakage
- direct frontend credential handling

---

# Audit Logging

All repository operations must be auditable.

Audit:

- provider registration
- repository binding
- token rotation
- manifest commits
- pull request creation
- repository synchronization

---

# Multi-Tenant Isolation

Prevent:

- cross-team repository access
- unauthorized manifest modifications
- provider credential leakage
- unrestricted repository browsing

Repository access must always respect:

- tenant boundaries
- project ownership
- RBAC rules

---

# Frontend UX Expectations

The repository management experience should support:

- provider registration
- repository browsing
- repository search
- branch selection
- environment bindings
- credential validation
- repository ownership visibility

The UI should remain:

- provider-agnostic
- simple
- secure
- workflow-oriented

---

# Suggested Backend Structure

```text
internal/
  repository/
    providers/
      github/
      gitlab/
    interfaces/
    security/
    encryption/
    normalization/
    bindings/
    workflows/
```

---

# Recommended MVP

## Phase 1

- provider abstraction
- GitHub provider
- encrypted PAT storage (should stored in vault)
- repository registration
- repository RBAC
- manifest commit support

## Phase 2

- GitLab provider
- pull request workflows
- branch strategies
- environment repositories
- audit logging

## Phase 3

- GitOps automation
- ArgoCD integration
- repository templates
- drift detection
- policy enforcement

---

# Engineering Principles

Prefer:

- provider abstractions
- normalized repository models
- least privilege access
- encrypted credential storage
- centralized RBAC
- GitOps-compatible workflows

Avoid:

- hardcoded provider logic
- provider-specific frontend behavior
- plaintext token handling
- unrestricted repository access

---

# Long-Term Vision

The repository provider system should become:

- the GitOps integration layer
- deployment manifest management layer
- workflow synchronization engine
- repository automation platform

The architecture should scale as:

- runtimes increase
- GitOps usage grows
- providers expand
- deployment complexity increases

---

# Success Criteria

The feature succeeds when:

- repositories can be connected securely
- generated manifests are stored automatically
- GitHub and GitLab integrations work consistently
- RBAC boundaries are enforced
- repository access is auditable
- frontend remains provider-agnostic
- new repository providers are easy to add
- GitOps workflows integrate naturally into the platform
