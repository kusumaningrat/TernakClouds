# TernakClouds — First-Time User Experience Design

> Principal Product Designer · Staff UX Designer · Platform Engineer · SaaS Onboarding Expert
>
> Every screen must answer: What is this? What do I do next? What is my service status? What needs attention?

---

## Table of Contents

1. [Current UX Problems](#1-current-ux-problems)
2. [New User Journey](#2-new-user-journey)
3. [Onboarding Flow](#3-onboarding-flow)
4. [Navigation Structure](#4-navigation-structure)
5. [Empty State Design](#5-empty-state-design)
6. [Home Page Design](#6-home-page-design)
7. [Service Workspace Design](#7-service-workspace-design)
8. [Platform Workspace Design](#8-platform-workspace-design)
9. [User Flow Diagrams](#9-user-flow-diagrams)
10. [Wireframe Concepts](#10-wireframe-concepts)
11. [Product Reasoning](#11-product-reasoning)
12. [Migration Strategy](#12-migration-strategy)

---

## 1. Current UX Problems

### Problem 1: Empty Dashboard on First Login

**What happens:** User logs in → sees a dashboard with empty widgets, zero metrics, blank charts.

**Why it fails:** An empty dashboard communicates nothing. It creates anxiety — "Is something broken? Did my setup fail? What do I do here?"

**The rule it breaks:** Dashboards earn their existence. A dashboard with no data is worse than no dashboard.

---

### Problem 2: No Guided Path

**What happens:** There is no sequence. The user is dropped into a full navigation with many options but no indication of what to do first.

**Why it fails:** Without a next step, users explore randomly, get confused by infrastructure concepts (runtime, namespace, datacenter), and often leave.

---

### Problem 3: Infrastructure-Centric Language in Developer Flows

**What happens:** Service deployment requires the developer to know: runtime provider, datacenter, namespace, Nomad job name, Vault role, container port.

**Why it fails:** A developer deploying a web app should not need to know what Nomad namespace to use. These are platform concerns, not developer concerns.

---

### Problem 4: Settings is the Entry Point for Critical Setup

**What happens:** Runtime configuration, registries, and environments are all in Settings — a low-priority page users visit last.

**Why it fails:** These are prerequisites for using the platform. They should be in an onboarding flow, not Settings.

---

### Problem 5: Service Creation Has No Template (Golden Path)

**What happens:** Creating a service requires the user to fill in technical fields with no defaults, no guidance, and no template.

**Why it fails:** A new user doesn't know what values are valid. There is no "start here" option. The form is a blank slate with jargon.

---

### Problem 6: No Progress Tracking

**What happens:** The user doesn't know if they are 20% or 80% set up. There is no checklist, no progress indicator, no "you're almost ready" state.

**Why it fails:** Users who don't know their progress give up early.

---

### Problem 7: Logs and Secrets are Top-Level

**What happens:** Logs and Secrets appear in the primary navigation.

**Why it fails:** These are not goals — they are tools. A developer's goal is to manage a service, and logs/secrets are part of that service. They don't belong in global navigation.

---

## 2. New User Journey

### User Archetypes

```
Type A — Solo Developer / Indie Hacker
  Goal: Deploy a personal project in under 5 minutes
  Needs: Fast setup, sensible defaults, no infrastructure knowledge required

Type B — Startup Engineer (Team of 2–10)
  Goal: Set up a dev environment, deploy a staging service
  Needs: Environment isolation, shared team access, clear deployment history

Type C — Enterprise Platform Team
  Goal: Onboard multiple teams, enforce governance, manage multiple runtimes
  Needs: RBAC, team ownership, platform separation, cost visibility
```

---

### Journey: Type A (Solo Developer)

```
1. Signup / Login
   ↓
2. Welcome + Setup Wizard (4 steps, takes ~3 minutes)
   ↓
3. Connect Runtime (Kubernetes / Nomad / Docker)
   ↓
4. Create First Environment (e.g. "Development")
   ↓
5. Create First Service (from Golden Path template)
   ↓
6. Deploy → First deployment running
   ↓
7. Dashboard (NOW useful: shows service health, logs, one deployment)
   ↓
8. Continue building: add more services, secrets, environments
```

**Time to first success: < 5 minutes**

---

### Journey: Type B (Startup Team)

```
1. Invite received → Account created
   ↓
2. Guided workspace setup (if admin) OR
   Service catalog (if developer joining existing workspace)
   ↓
3. See existing services → understand platform state immediately
   ↓
4. Deploy to staging → follow existing deployment pattern
   ↓
5. Collaborate: share logs, request access, view team services
```

---

### Journey: Type C (Enterprise)

```
1. Platform engineer sets up runtimes + environments
   ↓
2. Platform engineer creates team structure
   ↓
3. Developers invited to teams
   ↓
4. Developers see only their team's services
   ↓
5. Service creation locked to approved blueprints
   ↓
6. Deployments require approvals in production
```

---

## 3. Onboarding Flow

### 3.1 First Login: What the User Sees

Instead of an empty dashboard, show a **Setup Experience**.

The decision logic:

```
if (no_runtime AND no_environment AND no_services):
  → Show Setup Wizard (full screen, replaces dashboard)
else if (runtime exists AND environment exists AND no_services):
  → Show "Create your first service" empty state
else if (services exist but nothing deployed):
  → Show "Deploy your first service" guided state
else:
  → Show Dashboard (earned)
```

---

### 3.2 Setup Wizard

**Screen: Welcome**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🚀  Welcome to TernakClouds                               │
│                                                             │
│  TernakClouds is your Internal Developer Platform.         │
│  Let's get you set up in about 3 minutes.                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Step 1  Connect a Runtime        ○  pending        │   │
│  │  Step 2  Create an Environment    ○  pending        │   │
│  │  Step 3  Create a Service         ○  pending        │   │
│  │  Step 4  Deploy                   ○  pending        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                        [ Let's start → ]                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

**Step 1: Connect Runtime**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1 of 4 — Connect a Runtime                           │
│  ████░░░░░░░░░░░░░  25%                                    │
│                                                             │
│  A runtime is where your services will run.                │
│  Choose the platform you already have:                     │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │  ☸  K8s │  │  📦 Nomad│  │ 🐳 Docker│  │  ☁  ECS │      │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
│                                                             │
│  [After selecting Kubernetes:]                              │
│                                                             │
│  Endpoint: [ https://k8s.example.com ____________ ]        │
│  Token:    [ ●●●●●●●●●●●●●●●●●●●●● ______________ ]        │
│  Namespace (optional): [ default ]                         │
│                                                             │
│  ● Connection validated ✓                                  │
│                                                             │
│  [ ← Back ]                        [ Next: Environments → ]│
└─────────────────────────────────────────────────────────────┘
```

**What makes this different:**
- "Runtime" is never called "Kubernetes" in the developer-facing steps
- Connection is validated inline before moving on
- Error message is specific: "Could not connect. Check your endpoint and token."

---

**Step 2: Create Environment**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 2 of 4 — Create an Environment                       │
│  ████████░░░░░░░░░  50%                                    │
│                                                             │
│  An environment is where you deploy your services.         │
│  Most teams start with Development.                        │
│                                                             │
│  Name: [ Development __________________ ]                  │
│                                                             │
│  ✓ Tip: You can add Production and Staging later.          │
│                                                             │
│  Runtime: Kubernetes Production  ✓ connected               │
│                                                             │
│  [ ← Back ]                             [ Create → ]       │
└─────────────────────────────────────────────────────────────┘
```

**What makes this different:**
- Just one field: a name
- Runtime is auto-selected from step 1
- Tip reduces anxiety about "am I missing something?"

---

**Step 3: Create a Service**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 3 of 4 — Create your first Service                   │
│  ████████████░░░░░  75%                                    │
│                                                             │
│  What kind of service is this?                             │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  ⚙️  REST API │  │  👷 Worker   │  │  🌐 Frontend │     │
│  │  Web service │  │  Background  │  │  React/Next  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │  ⏱️  Cron Job │  │  ✦ Custom    │                        │
│  │  Scheduled   │  │  Blank start │                        │
│  └──────────────┘  └──────────────┘                        │
│                                                             │
│  [After selecting REST API:]                                │
│                                                             │
│  Service name: [ my-api _______________________ ]          │
│                                                             │
│  Defaults applied:  500m CPU · 512MB RAM · port 8080       │
│  Change these later in service settings.                   │
│                                                             │
│  [ ← Back ]                             [ Next: Deploy → ] │
└─────────────────────────────────────────────────────────────┘
```

**What makes this different:**
- Template cards hide all technical defaults
- Single required field: a name
- Defaults are shown but not editable here (reduce friction)
- "Change these later" removes anxiety

---

**Step 4: Deploy**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 4 of 4 — Deploy your first version                   │
│  ████████████████░  95%                                    │
│                                                             │
│  Service:      my-api                                       │
│  Environment:  Development                                  │
│                                                             │
│  Container image:                                           │
│  [ nginx:latest ___________________________________ ]      │
│  or [ Browse registry ▾ ]                                  │
│                                                             │
│  ✓ Tip: Use any public Docker image to get started.         │
│         You can update it after deployment.                 │
│                                                             │
│  [ ← Back ]               [ 🚀 Deploy my-api → ]           │
└─────────────────────────────────────────────────────────────┘
```

---

**Step 5: First Deployment Running**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ✅  Setup complete!                                        │
│                                                             │
│  my-api is deploying to Development                        │
│                                                             │
│  ████████████████████  Deploying…                          │
│                                                             │
│  ✓  Runtime connected                                      │
│  ✓  Environment created                                    │
│  ✓  Service created                                        │
│  ●  Deployment running…                                    │
│                                                             │
│  [ View service →]          [ Add another service ]        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.3 Onboarding Checklist (Post-Wizard)

After wizard completion, a persistent checklist appears in the sidebar until all items are done:

```
Getting started  5/8

✓  Connect runtime
✓  Create environment
✓  Create first service
✓  Deploy first service
○  Add a second environment (Staging)
○  Connect a container registry
○  Invite a team member
○  Set up a secret
```

The checklist is **dismissible** after the first 4 items are complete.

---

## 4. Navigation Structure

### Principle

Navigation is organized around what a user IS, not what the platform HAS.

```
Developers navigate by: Services → Do things to my service
Platform Engineers navigate by: Platform → Manage infrastructure
```

### Primary Sidebar (Always Visible)

```
[TC Logo]
──────────────────
⊞  Home
◫  Services          ← PRIMARY — always first
◈  Teams
⟁  Insights
──────────────────   ← separator — platform engineer only
⚙  Platform
──────────────────
⚙  Settings
──────────────────
●  [Avatar]
```

### What Each Nav Item Does

| Item | Who Sees It | What It Shows |
|------|-------------|---------------|
| Home | Everyone | My services health, alerts, activity |
| Services | Everyone | All services in workspace (catalog) |
| Teams | Everyone | Teams and ownership |
| Insights | Everyone | Health scores, maturity, risk |
| Platform | Platform engineer + Admin | Runtimes, environments, providers |
| Settings | Admin | Workspace, RBAC, access |

### What Navigation Does NOT Contain

❌ Deployments (lives inside service detail)
❌ Logs (lives inside service detail)
❌ Secrets (lives inside service detail)
❌ Runtime (lives inside Platform)
❌ Kubernetes / Nomad (never shown to developers)

---

### Environment Filter (in Topbar)

The environment is a **filter**, not a navigation destination.

```
[TC Logo]  [Context: glynac-ai]   All · Production · Staging · Development
```

The environment filter persists across all developer pages. It filters:
- Service health view on the catalog
- Deployment list on service pages
- Logs on service pages

Developers think "show me Production" not "go to Production environment".

---

## 5. Empty State Design

### Rule

> An empty state must answer: "Why is this empty?" and "What should I do?"

Every empty state has three components:
1. **Illustration / icon** — communicates the category
2. **Headline** — states what's missing without blame
3. **Action** — single primary CTA

---

### Empty State: No Runtime

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                   [Server icon]                             │
│                                                             │
│              No runtime connected                          │
│                                                             │
│  A runtime is where your services will run.                │
│  Connect Kubernetes, Nomad, Docker, or ECS to continue.    │
│                                                             │
│               [ Connect a runtime → ]                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Empty State: No Environment

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                   [Globe icon]                              │
│                                                             │
│              No environments yet                           │
│                                                             │
│  Environments represent where you deploy — Development,     │
│  Staging, Production. Create one to continue.              │
│                                                             │
│               [ Create environment → ]                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Empty State: No Services

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                   [Layers icon]                             │
│                                                             │
│              No services yet                               │
│                                                             │
│  Services are the core of TernakClouds. Create your        │
│  first service from a template to get started.             │
│                                                             │
│    [ Create from template → ]     [ Import existing ]     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Empty State: Service Created but Not Deployed

```
┌─────────────────────────────────────────────────────────────┐
│  payment-api                                               │
│  ● Not deployed                                            │
│                                                             │
│  This service has never been deployed.                     │
│  Choose an environment to deploy it into:                  │
│                                                             │
│  [ 🚀 Deploy to Development ]                              │
│  [ 🚀 Deploy to Staging     ]                              │
│  [ 🚀 Deploy to Production  ]                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Empty State: Service Catalog (Filter Returns Nothing)

```
No services match "payment"

[ Clear search ]
```

Short. No explanation needed — user understands the filter.

---

### Anti-Patterns (Never Do These)

❌ Empty chart with axes but no data
❌ "No data available" in a widget without explanation
❌ Table headers with no rows and no context
❌ Metric cards showing "—" or "0" with no next step
❌ Welcome message with no action

---

## 6. Home Page Design

### Scenario A: Brand New User (No Setup)

The home page IS the setup wizard. Full screen. No sidebar visible.

```
TernakClouds

Welcome, Kusuma.

Let's get your platform set up. This takes about 3 minutes.

[ Start setup → ]

Already have a setup? [ Skip ]
```

The sidebar is visible but all items except Home are dimmed with a tooltip: "Complete setup to unlock."

---

### Scenario B: Solo Developer (Setup Done, Has Services)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Thursday, Jun 4      Good morning, Kusuma.                        │
│  3 services running · 1 deployment in progress                     │
│                                    [ Insights ] [ Teams ]          │
├──────────────────────────────┬──────────────────────────────────────┤
│  HEALTH SUMMARY              │                                      │
│  ●  2  Healthy               │  QUICK ACTIONS                      │
│  ⚠  1  Degraded              │                                      │
│  ○  0  Not deployed          │  [ + Create service ]               │
│                              │  [ 🚀 Deploy service ]              │
│  → View insights             │  [ 🔑 Manage secrets ]              │
├──────────────────────────────┴──────────────────────────────────────┤
│  MY SERVICES                                          [ View all → ]│
│                                                                     │
│  api-gateway    ● HEALTHY    prod ● stg ● dev ●   2d ago           │
│  user-service   ⚠ DEGRADED   prod ● stg ● dev ✗   20m ago          │
│  frontend-web   ● HEALTHY    prod ● stg ● dev ●   3d ago           │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  RECENT DEPLOYMENTS                           [ View all → ]        │
│                                                                     │
│  user-service  →  development   ● failed   20m ago   Rollback      │
│  api-gateway   →  production    ● running  2d ago                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Every element answers a question:**
- Health summary: "What is the status of my services?"
- Quick actions: "What should I do next?"
- Degraded service row: "What needs attention?"

---

### Scenario C: Team (Multiple Services, Multiple Members)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Thursday, Jun 4      Good morning, Kusuma.                        │
│  8 services · 2 issues · 1 pending approval                        │
├──────────────────────────┬──────────────────────────────────────────┤
│  WORKSPACE HEALTH        │  PENDING APPROVALS                      │
│                          │                                          │
│  ●  6  Healthy           │  ⚠ Budi Santoso — developer access      │
│  ⚠  2  Issues            │    "Need prod deploy access"            │
│  ○  1  Not deployed      │  [ Approve ] [ Deny ]                   │
│                          │                                          │
├──────────────────────────┴──────────────────────────────────────────┤
│  MY TEAM'S SERVICES (Platform team)             [ View all → ]     │
│                                                                     │
│  api-gateway        ● HEALTHY   prod ● stg ● dev ●                │
│  metrics-collector  ● HEALTHY   prod ● stg ● dev ●                │
│                                                                     │
│  ALL WORKSPACE SERVICES                         [ View catalog → ] │
│                                                                     │
│  ⚠ user-service: FAILED in development — 20 minutes ago           │
│  ⚠ data-sync: FAILED in staging — 11 hours ago                    │
│  ✓ 6 other services healthy                                        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ACTIVE DEPLOYMENTS                                                 │
│                                                                     │
│  notification-service  →  staging  ● pending   3m ago             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**What's different in Scenario C:**
- "My Team's Services" appears first (ownership matters)
- Pending approvals are surfaced (admin task)
- Workspace-wide issues are highlighted separately from team services
- No empty widgets — every section shows real data

---

## 7. Service Workspace Design

### Route: `/services/:name`

```
← Services    api-gateway    ● HEALTHY    [Deploy ▾]

Overview · Deployments · Logs · Secrets · Metrics · Dependencies · Ownership · Settings
─────────────────────────────────────────────────────────────────────────────────────
```

The service name and health badge persist across ALL tabs.

---

### Tab: Overview

Answers: **"Is this service healthy right now?"**

```
DEPLOYMENT STATUS

  Production    ● Running    nginx:v2.4.1   deployed 2d ago by @kusuma
  Staging       ● Running    nginx:v2.5.0   deployed 6h ago by @rudi
  Development   ✗ Not deployed                  [ Deploy now → ]

─────────────────────────────────────────────────────────────────────

SERVICE INFO

  Repository    github.com/org/api-gateway
  Runtime       Kubernetes
  Team          Platform
  Type          gateway · port 8080

QUICK LINKS

  View logs →       Manage secrets →      All deployments →
```

---

### Tab: Deployments

Answers: **"What is deployed and how did I get here?"**

```
DEPLOY NEW VERSION                [ 🚀 Deploy → ]

DEPLOYMENT HISTORY

  prod   v2.4.1   ● running   2d ago   @kusuma   commit a3f8c91   [ Rollback ]
  stg    v2.5.0   ● running   6h ago   @rudi     commit b7d2e44   [ Rollback ]
  prod   v2.3.9   ✓ replaced  8d ago   @kusuma   commit f8b1d22
  prod   ✗ failed 10d ago   @kusuma   commit e1a7c88            [ View logs ]
```

**Rollback is always visible** for failed or replaced deployments.

---

### Tab: Logs

Answers: **"What is this service doing right now?"**

```
  Environment:  [ Production ▾ ]     Filter: [_____________]

  ● LIVE STREAM

  2026-06-04T10:23:41Z [INFO]  GET /health → 200 (2ms)
  2026-06-04T10:23:42Z [INFO]  POST /api/v1/route → 201 (148ms)
  2026-06-04T10:23:43Z [WARN]  Rate limit: 192.168.1.45 (87/100)
```

Key design decision: **Environment is a tab-level filter, not a navigation destination.** The developer stays in the service workspace.

---

### Tab: Secrets

Answers: **"What secrets does this service use?"**

```
  PRODUCTION                            [ + Add secret ]

    DATABASE_URL       ●●●●●●●●●   updated 30d ago by @kusuma  [ Edit ]
    JWT_SECRET         ●●●●●●●●●   updated 60d ago by @kusuma  [ Edit ]

  STAGING

    DATABASE_URL       ●●●●●●●●●   updated 14d ago by @rudi    [ Edit ]
```

Key design decision: **Secrets are organized by service first, then environment.** Not "go to Environment → Secrets."

---

### Tab: Metrics *(requires metrics provider)*

**Empty state if no provider:**

```
  No metrics configured

  Connect a metrics provider (Prometheus, Grafana) to see:
  request rate · error rate · latency · resource usage

  [ Configure metrics → ]
```

**When configured:**

```
  [ 1h · 6h · 24h · 7d ]    Environment: [ Production ▾ ]

  Request rate         Error rate          P95 latency
  ████ 1,234 req/min   ██░ 0.2%            █░░ 145ms

  CPU                  Memory
  ████░ 62%            ███░░ 48%
```

---

### Tab: Dependencies

Answers: **"What does this service depend on?"**

```
  UPSTREAM (api-gateway calls these)

    → user-service        ● healthy     runtime dependency
    → redis               ● healthy     cache
    → billing-service     ● healthy     runtime dependency

  DOWNSTREAM (these call api-gateway)

    ← frontend-web        ● healthy
    ← mobile-app          external

  [ + Register dependency ]
```

---

### Tab: Ownership

Answers: **"Who is responsible when this breaks?"**

```
  Owner team:       Platform
  On-call:          PagerDuty → platform-oncall
  Slack channel:    #platform-alerts
  Repository:       github.com/org/api-gateway

  READINESS CHECKLIST          72 / 100

  ✓  Owner team assigned
  ✓  Repository linked
  ✓  Production monitoring
  ✗  Incident runbook missing       [ Add runbook ]
  ✗  Deployment automation         [ Configure CI/CD ]
  ✗  SLO defined                   [ Define SLO ]

  RUNBOOKS
  Incident · Deployment · Maintenance    [ + Add ]
```

---

### Tab: Settings

```
  CONFIGURATION
  Name:        api-gateway
  Type:        gateway
  Runtime:     kubernetes
  Template:    rest-api
  Default CPU: 500m   Default memory: 512Mi

  DANGER ZONE
  Archive this service   (removes all deployments)
```

---

## 8. Platform Workspace Design

### Route: `/platform`

Only accessible to `platform_engineer` and `admin`.

**Key principle:** Platform pages hide infrastructure complexity from the route itself. Developers never see `/platform/*`.

```
Platform

Infrastructure management · Environments · Runtimes · Providers
───────────────────────────────────────────────────────────────

ENVIRONMENTS

  Production   → Kubernetes Production    ● healthy    16 services
  │  [ RUNTIME ] [ SECRETS ] [ LOGS ]
  │
  Staging      → Nomad Staging            ● healthy    14 services
  │  [ RUNTIME ] [ SECRETS ] [ LOGS ]
  │
  Development  → Kubernetes Dev           ● healthy    11 services
     [ RUNTIME ] [ SECRETS ] [ LOGS ]

  [ + Create environment ]

───────────────────────────────────────────────────────────────

RUNTIMES

  Kubernetes Production    ● healthy   12 nodes   v1.29.2
  Nomad Staging            ● healthy   6 nodes    v1.7.3
  Kubernetes Dev           ● healthy   3 nodes    v1.29.2

  [ + Register runtime ]

───────────────────────────────────────────────────────────────

CONTAINER REGISTRIES     3 connected    [ Manage ]

REPOSITORY PROVIDERS     2 connected    [ Manage ]
```

---

### Platform Onboarding (First-Time Platform Engineer)

If a Platform Engineer logs in first (before developers), they see:

```
Set up the platform first

Before developers can deploy, you need to:

  ○  Register a runtime (Kubernetes, Nomad, ECS, Docker)
  ○  Create at least one environment
  ○  (Optional) Connect a container registry
  ○  (Optional) Connect a git provider

Developers will not see these steps.
They'll deploy services into the environments you create.

[ Start platform setup → ]
```

---

## 9. User Flow Diagrams

### Flow 1: First Login → First Deployment

```
Login
  │
  ├─ [Admin / Solo] ──────────────────────────────────────────────────┐
  │                                                                   │
  │  No runtime?                                                      │
  │    → Setup Wizard: Connect Runtime                                │
  │       → Create Environment                                        │
  │          → Create Service (template selection)                   │
  │             → Deploy (image input)                               │
  │                → ✅ First deployment running                      │
  │                   → Dashboard (now meaningful)                    │
  │                                                                   │
  └─ [Developer invited to existing workspace] ───────────────────────┤
                                                                      │
     Setup already done by admin                                      │
       → Land on Service Catalog                                      │
          → See existing services + their health                      │
             → Click service → Service Workspace                      │
                → Deploy to their environment                         │
                   → ✅ Deployment done                               │
                                                                      │
                                                                      ┘
```

---

### Flow 2: Service Deployment

```
Services Catalog
  │
  Click "Deploy" on a service (or Enter service → Deployments tab)
  │
  Deploy modal:
    Environment: [ Production ▾ ]
    Image:       [ registry/image:tag ]
    CPU:         [ 500m ] (pre-filled from service defaults)
    Memory:      [ 512Mi ] (pre-filled)
    Replicas:    [ 2 ]
    │
    [ Confirm deploy ]
    │
    Deployment status: ● pending → ● running (or ✗ failed)
    │
    ✗ failed → inline error with "View logs" link
    ● running → success toast + service overview updated
```

---

### Flow 3: Developer Requesting Access

```
Developer clicks a locked feature (e.g. deploy to production)
  │
  "You need developer access to deploy to Production"
  │
  [ Request access ]
  │
  Reason: [ __________________________ ]
  Role:   developer
  │
  [ Submit request ]
  │
  → Admin sees badge on "Access" nav item
  → Admin reviews → Approve / Deny
  → Developer receives notification
  → Access granted immediately on approval
```

---

### Flow 4: Secret Management

```
Service Workspace → Secrets tab
  │
  Select environment
  │
  [ + Add secret ]
  │
  Key:   [ DATABASE_URL ]
  Value: [ ●●●●●●●●●●●● ] ← never logged, never displayed
  │
  [ Save ]
  │
  Secret stored in Vault (or configured provider)
  Available to service at runtime via env var
  │
  (Service restart may be needed)
  → Notification: "Restart deployment to apply new secret?"
     [ Restart now ]  [ Later ]
```

---

## 10. Wireframe Concepts

### Wireframe A: Setup Wizard Progress Bar

```
●──────●──────○──────○
1       2       3       4
Runtime  Env    Service  Deploy

                         [ Back ]  [ Next → ]
```

Simple 4-step progress. No "skip" on steps 1–3. "Skip for now" only on step 4 (if user wants to deploy later).

---

### Wireframe B: Service Catalog Card vs. Row

Two views: **Card** (visual, good for <10 services) and **Row** (dense, good for >10 services).

**Card view:**
```
┌─────────────────────────────┐
│  ⚙️  api-gateway  ● HEALTHY │
│  Platform · gateway         │
│                             │
│  PROD ● STG ● DEV ●         │
│                             │
│  Last deployed 2d ago       │
│              [ Deploy ▾ ]   │
└─────────────────────────────┘
```

**Row view (default for >10):**
```
api-gateway   Platform   PROD ● STG ● DEV ●   2d ago   [Deploy ▾] [Logs]
```

Toggle between views is in the top right of the catalog page.

---

### Wireframe C: Health Indicator System

```
●  green    = running, all healthy
⚠  amber    = degraded, some issues
✗  red      = failed, immediate attention needed
○  grey     = not deployed, idle
```

Used consistently across: catalog row, service card, topbar badge, home summary, deployment row.

---

### Wireframe D: Topbar Context Strip

```
[TC]  [Context: glynac-ai ▾]    All · Production · Staging · Development
                                                      [Search ⌘K] [🔔] [?] [KN ▾]
```

The workspace switcher is a dropdown — allows switching between workspaces without going to settings.

The environment filter is a tab strip — selecting "Production" filters everything on screen without navigating away.

---

### Wireframe E: Notification + Alert System

```
Bell icon in topbar, with badge when unread

Notification types:
  🔴 Deployment failed: user-service in development
  🟡 Access request from Budi Santoso
  🟢 Deployment succeeded: api-gateway in production
  🟡 Secrets rotation reminder: JWT_SECRET (60d old)

Click opens notification drawer (not a full page)
```

---

## 11. Product Reasoning

### Why Setup Wizard Instead of Empty Dashboard?

An empty dashboard tells the user nothing. It implies the product is broken or the user did something wrong. A setup wizard:

1. Communicates that setup is required (honest)
2. Tells the user exactly what to do (clear)
3. Shows progress (motivating)
4. Results in a meaningful first experience (fast success)

**Precedent:** Vercel, Railway, Render all show setup flows on first login. None of them drop you into an empty dashboard.

---

### Why Are Logs/Secrets/Deployments Inside Services?

Because developers don't think "I need to go to Logs." They think "I need to check what my service is doing." The goal is always service-oriented. Logs, secrets, and deployments are tools for understanding and changing a service.

Making them top-level navigation creates a mental model mismatch: the developer navigates away from the service to see information about that service.

---

### Why Does Environment = Filter, Not Navigation?

Because an environment is context, not a destination. A developer cares about their service. The environment is a dimension of that service's state.

The current model (navigate to Environment → find service) requires the user to start from the wrong place. The correct model: start from Service → filter by Environment.

---

### Why is Platform Separate from Developer Navigation?

Because Platform Engineers and Developers have fundamentally different goals:

- Developer: "Deploy my service to staging"
- Platform Engineer: "Configure the Kubernetes cluster that staging runs on"

Mixing these creates confusion for both. Developers see infrastructure jargon they don't understand. Platform engineers see service-level views that aren't relevant to their work.

The separator in the sidebar is a visual boundary that matches the mental model.

---

### Why Template-First Service Creation?

Because a blank form with fields like "default_cpu", "default_memory", "health_check_path" is incomprehensible to a developer who just wants to deploy a REST API.

A template pre-fills all defaults that are correct for 80% of use cases. The 20% who need custom values can find them in service settings after creation.

The sequence: **Template → Name → Deploy** is faster than **Form → Fill every field → Deploy**.

---

### Why Readiness Scores Instead of Raw Metrics?

A readiness score answers: "Is this service production-ready?" A raw metric (CPU: 45%) doesn't answer that question.

Readiness (does this service have an owner? a runbook? monitoring?) is actionable. It tells the developer what to do. Raw metrics describe state but don't prescribe action.

---

## 12. Migration Strategy

### Phase 0: Instrument What Exists (1 week)

Before changing anything, add tracking to understand:
- What screens users land on after login
- Where they drop off
- What they click first
- How long the average user takes to deploy their first service

This baseline lets us measure improvement.

---

### Phase 1: Empty States (1 sprint)

Replace every empty chart, blank table, and "—" metric with a proper empty state that explains the situation and provides an action.

**This is the highest-impact, lowest-risk change.** No routing or architecture change needed. Just better content in existing components.

Affected: Dashboard home, Service catalog, Deployments tab, Metrics tab.

---

### Phase 2: Setup Wizard (2 sprints)

Add the setup wizard as a new route (`/setup`) that appears automatically when:
- No runtime is configured
- The user is an admin or the workspace owner

The wizard does not change the underlying API — it just guides the user through existing setup flows in a linear, focused sequence.

After completion, redirect to home.

---

### Phase 3: Home Page Redesign (1 sprint)

Implement the three-scenario home page (new user / solo developer / team). This replaces the current dashboard widgets.

The key change: **conditional rendering based on workspace state.** If no services exist, show the "getting started" state. If services exist, show the operational home.

---

### Phase 4: Navigation Restructure (2 sprints)

Implement the new navigation:
- Remove Deployments and Logs from top-level nav
- Add Teams and Insights
- Add Platform section (gated by role)
- Add environment filter to topbar

Protect existing deep links with redirects:
- `/environments/:id/logs` → `/services/:name/logs`
- `/environments/:id/secrets` → `/services/:name/secrets`

---

### Phase 5: Service Workspace (2 sprints)

Enhance the service detail page with the full workspace:
- Add Dependencies tab (with registration UI)
- Add Ownership tab (with readiness checklist)
- Add Metrics tab (with empty state → connect provider flow)
- Move secrets to be service-first (filter by env within service)

---

### Phase 6: Onboarding Checklist (1 sprint)

Add the persistent "Getting started" checklist that tracks user progress through the first 8 setup actions and clears itself when complete.

---

### Risk Table

| Change | User Impact | Rollback Risk |
|--------|-------------|---------------|
| Empty states | Low — additive only | None |
| Setup wizard | Medium — new screen for new users | Easy — feature flag |
| Home page redesign | High — replaces existing | Medium — keep old behind flag |
| Navigation restructure | High — changes muscle memory | Hard — add redirects |
| Service workspace | Low — additive tabs | None |
| Onboarding checklist | Low — additive | None |

---

### Success Metrics

| Metric | Target |
|--------|--------|
| Time to first deployment | < 5 minutes |
| % users who deploy in first session | > 60% |
| % users who complete setup wizard | > 80% |
| Day 7 retention | > 40% |
| Avg screens visited before first deploy | < 5 |
| Support tickets: "how do I start?" | → 0 |
