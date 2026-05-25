# TernakClouds — Frontend

React SPA for the Internal Developer Platform. Provides workspace management, environment configuration, capability/provider bindings, and a self-service access request workflow. Built with TanStack Router, TanStack Query, Tailwind CSS, and Radix UI.

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Routing](#routing)
- [State Management](#state-management)
- [Authentication](#authentication)
- [Workspace Context](#workspace-context)
- [Role-Based UI](#role-based-ui)
- [API Layer](#api-layer)

---

## Architecture

```
src/
  components/         — shared UI components
    DashboardSidebar.tsx   — navigation, workspace switcher, env capability badges
    DashboardTopbar.tsx    — page header bar
    CapabilityPage.tsx     — reusable capability provider management UI
  lib/
    api.ts            — typed fetch wrapper with JWT attach + auto-refresh
    auth.ts           — token storage (localStorage), TTL helpers
    queries.ts        — all TanStack Query hooks (useQuery + useMutation)
    types.ts          — TypeScript interfaces mirroring backend API responses
    workspace-context.tsx  — selected workspace persisted in localStorage
  routes/             — file-based routes (TanStack Router)
  routeTree.gen.ts    — auto-generated route tree (do not edit manually)
```

---

## Prerequisites

| Tool           | Version            |
| -------------- | ------------------ |
| Node.js        | 18+                |
| npm            | 9+                 |
| Clouds-backend | running on `:8022` |

---

## Quick Start

```bash
cd Clouds-frontend
npm install
npm run dev
# App available at http://localhost:8080
```

The Vite dev server proxies API calls to `http://localhost:8022` automatically (CORS is configured on the backend to allow `localhost:8080`).

---

## Project Structure

### `src/lib/`

| File                    | Purpose                                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.ts`                | `api.get / post / put / delete` — attaches `Authorization` header, handles 401 by auto-refreshing the access token once, throws `ApiError` on failure |
| `auth.ts`               | `storeTokens`, `clearTokens`, `getAccessToken`, `getRefreshToken`, `tokenTTLSeconds`                                                                  |
| `types.ts`              | All request/response interfaces. Grouped by domain: auth, roles, departments, workspaces, environments, capabilities, access requests, Nomad, secrets |
| `queries.ts`            | Every `useQuery` and `useMutation` hook. Follows `[domain, ...key]` query key convention. Cache invalidation is co-located with each mutation         |
| `workspace-context.tsx` | `WorkspaceProvider` + `useWorkspaceContext`. Selected workspace is persisted in `localStorage` under key `Clouds_workspace_v2`                        |

### `src/components/`

**`DashboardSidebar`**

- Workspace switcher dropdown — admins/managers see all workspaces; developers/viewers see only their own
- Capability-grouped environment navigation (Overview / Applications / Platform / Observability / Access / Settings)
- Provider badges on Platform nav items (shows provider name or "N providers")
- Admin nav section with live pending-request badge on "Access Requests"
- "Request Access" link for non-privileged users

**`CapabilityPage`**

- Generic capability UI used by Runtime, Secrets, Networking, Storage pages
- `AddProviderForm` — workspace-aware provider picker (filters already-bound), endpoint/region/namespace/token fields
- `EditProviderForm` — inline edit with optional token rotation ("leave blank to keep existing")
- `ProviderCard` — bound provider card with Edit / Remove actions
- Accepts `extraContent` for capability-specific content (e.g. Nomad cluster node list)

---

## Routing

Routes use TanStack Router's file-based convention. Dots in filenames become path segments.

| Route file                                              | URL                              | Description                                        |
| ------------------------------------------------------- | -------------------------------- | -------------------------------------------------- |
| `index.tsx`                                             | `/`                              | Redirects to `/dashboard`                          |
| `login.tsx`                                             | `/login`                         | Login form                                         |
| `register.tsx`                                          | `/register`                      | Self-registration                                  |
| `dashboard.tsx`                                         | `/dashboard`                     | Layout with sidebar (requires auth)                |
| `dashboard.index.tsx`                                   | `/dashboard`                     | Dashboard home                                     |
| `dashboard.environments.tsx`                            | `/dashboard/environments`        | Environments layout                                |
| `dashboard.environments.index.tsx`                      | `/dashboard/environments`        | Environment picker grid                            |
| `dashboard.environments.$envId.tsx`                     | `/dashboard/environments/:envId` | Environment layout                                 |
| `dashboard.environments.$envId.index.tsx`               | `/dashboard/environments/:envId` | Environment overview                               |
| `dashboard.environments.$envId.platform.tsx`            | `.../platform`                   | Platform nav layout                                |
| `dashboard.environments.$envId.platform.runtime.tsx`    | `.../platform/runtime`           | Runtime capability (Nomad/Kubernetes)              |
| `dashboard.environments.$envId.platform.secrets.tsx`    | `.../platform/secrets`           | Secrets capability (Vault)                         |
| `dashboard.environments.$envId.platform.networking.tsx` | `.../platform/networking`        | Networking capability (Consul)                     |
| `dashboard.environments.$envId.platform.storage.tsx`    | `.../platform/storage`           | Storage capability (MinIO)                         |
| `dashboard.environments.$envId.integrations.tsx`        | `.../integrations`               | Workspace integrations                             |
| `dashboard.environments.$envId.services.tsx`            | `.../services`                   | Nomad jobs                                         |
| `dashboard.environments.$envId.deployments.tsx`         | `.../deployments`                | Nomad deployments                                  |
| `dashboard.environments.$envId.secrets.tsx`             | `.../secrets`                    | Vault secret grants                                |
| `dashboard.environments.$envId.settings.tsx`            | `.../settings`                   | Environment settings                               |
| `dashboard.workspaces.tsx`                              | `/dashboard/workspaces`          | Workspace CRUD + member management (admin)         |
| `dashboard.departments.tsx`                             | `/dashboard/departments`         | Department CRUD (admin)                            |
| `dashboard.users.tsx`                                   | `/dashboard/users`               | User list + role management (admin)                |
| `dashboard.roles.tsx`                                   | `/dashboard/roles`               | Role + permission viewer (admin)                   |
| `dashboard.access-requests.tsx`                         | `/dashboard/access-requests`     | Pending request approval queue (admin)             |
| `dashboard.no-access.tsx`                               | `/dashboard/no-access`           | Empty state for users with no workspace membership |
| `dashboard.profile.tsx`                                 | `/dashboard/profile`             | Current user profile                               |

**Route generation**: `routeTree.gen.ts` is auto-generated by the TanStack Router plugin on every `vite dev` or `vite build` run. Never edit it manually.

---

## State Management

All server state is managed by **TanStack Query** (`@tanstack/react-query`). There is no global client-side state store (no Redux, no Zustand).

Query key conventions in `queries.ts`:

| Scope                     | Key shape                              |
| ------------------------- | -------------------------------------- |
| Current user              | `['me']`                               |
| Workspaces list           | `['workspaces', 'list']`               |
| Workspace mine            | `['workspaces', 'mine']`               |
| Workspace directory       | `['workspaces', 'directory']`          |
| Environments              | `['workspaces', slug, 'environments']` |
| Capabilities              | `['capabilities', slug, envId]`        |
| Access requests (mine)    | `['access-requests', 'mine']`          |
| Access requests (pending) | `['access-requests', 'pending']`       |
| Users list                | `['users', 'list', params]`            |

Mutations invalidate their related queries in `onSuccess`. `staleTime` is set per query to reduce redundant refetches (`60s` for slow-changing data like roles, `30s` for access requests).

---

## Authentication

Tokens are stored in `localStorage`:

- `Clouds_access_token` — short-lived JWT (default 15 min)
- `Clouds_refresh_token` — long-lived token (default 7 days)

The `api.ts` fetch wrapper:

1. Attaches the access token to every request as `Authorization: Bearer <token>`
2. On 401 response, attempts a single silent refresh via `POST /api/v1/auth/refresh`
3. If refresh succeeds, retries the original request with the new token
4. If refresh fails, clears tokens and the caller receives an `ApiError`

The sidebar displays the JWT TTL in real time. When it drops below 60 seconds the value shows in seconds rather than minutes.

---

## Workspace Context

`WorkspaceProvider` (wrapping the dashboard layout) manages the currently selected workspace:

- Reads from `localStorage` on mount (`isHydrated: false` until then — prevents flash)
- `setSelectedWorkspace(ws)` — updates state and persists to localStorage
- If the stored workspace is no longer in the user's available list (e.g. after DB reset), it is cleared automatically
- Privileged users (admin/manager) see all workspaces via `GET /api/v1/workspaces`; others see only their memberships via `GET /api/v1/workspaces/mine`

The workspace switcher in the sidebar is clickable when:

- The user is privileged (admin/manager), **or**
- The user is a member of more than one workspace

---

## Role-Based UI

The `isAdminOrManager` helper (in `DashboardSidebar` and `dashboard.environments.index`) checks `me.roles[].role.name` to determine if the current user is `admin` or `manager`.

| Condition                      | UI behaviour                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `privileged` (admin/manager)   | Admin nav section visible; workspace switcher always clickable; "Create workspace" CTA on empty state |
| Not privileged, no workspaces  | "Request Workspace Access" CTA → `/dashboard/no-access`                                               |
| Not privileged, has workspaces | Normal workspace nav; "Request Access" link in sidebar                                                |
| Admin nav: Access Requests     | Live badge shows count of pending requests                                                            |

Platform capabilities (Runtime, Secrets tabs) call `environments:write`-gated backend endpoints. The UI does not hide the tabs for developers, but all mutating actions will return 403 — consider adding client-side permission checks if you want to hide the buttons preemptively.

---

## API Layer

All backend calls go through `src/lib/api.ts`:

```typescript
// GET with typed response
const data = await api.get<MyType>("/api/v1/endpoint");

// POST / PUT / DELETE
await api.post("/api/v1/endpoint", bodyObject);
await api.put("/api/v1/endpoint", bodyObject);
await api.delete("/api/v1/endpoint");
```

`api.get/post/put/delete` return the `data` field from the JSON envelope `{ "data": ... }`. Error responses (`{ "error": "..." }`) are thrown as `ApiError` instances with a `.message` property.

All API hooks are exported from `src/lib/queries.ts`. Prefer using the hooks over calling `api.*` directly in components.
