# Contributing

---

## Development Setup

Follow the [installation guide](../getting-started/installation.md) to get the platform running locally. You only need:

- Go ≥ 1.22
- Node.js ≥ 20
- Docker + Docker Compose (for PostgreSQL)
- Vault is **not** required — set `VAULT_ENABLED=false`

```bash
git clone <repo-url> idp && cd idp
cp server/.env.example server/.env   # edit DB_* and JWT_SECRET
cp admin/.env.example admin/.env
make docker-up
make install
make dev
```

---

## Repository Structure

```
idp/
├── server/                   Go REST API
│   ├── cmd/api/              Main entrypoint (main.go)
│   ├── cmd/reset-db/         Dev utility to wipe + re-seed
│   ├── internal/             Domain packages (one per bounded context)
│   └── pkg/                  Shared utilities (JWT, responses, pagination)
│
├── admin/                    Admin dashboard
│   ├── src/routes/           File-based routing (TanStack Router)
│   ├── src/components/       Reusable UI components
│   └── src/lib/              API query hooks, types, auth
│
├── src/                      Public website
├── docs/                     Platform documentation
├── docker-compose.yml
└── Makefile
```

---

## Backend Conventions

### Package Structure

Each domain package follows the same layout:

```
internal/<domain>/
├── models.go     GORM model definitions
├── types.go      Request/response DTOs (no GORM annotations)
├── repository.go Database operations (queries, writes)
├── service.go    Business logic (calls repository, vault, other services)
├── handler.go    HTTP handlers (parse request → call service → respond)
└── routes.go     Route registration function
```

### Route Registration

Routes are registered in `server/internal/server/server.go`. Each package exposes a `RegisterRoutes(rg *gin.RouterGroup, h *Handler, ...)` function.

Never register routes inline in `server.go`. Keep all routing logic in the package's `routes.go`.

### Error Handling

Use the shared response helpers from `pkg/`:

```go
pkg.RespondOK(c, http.StatusOK, data)
pkg.RespondErr(c, http.StatusBadRequest, "descriptive error message")
pkg.RespondMessage(c, http.StatusOK, "operation succeeded")
```

Return specific errors from services using typed sentinel errors:

```go
var ErrNotFound = errors.New("resource not found")
var ErrAlreadyExists = errors.New("resource already exists")
```

Map them to HTTP status codes in the handler:

```go
if errors.Is(err, ErrNotFound) {
    pkg.RespondErr(c, http.StatusNotFound, "not found")
    return
}
```

### Database Models

All models embed `models.Base`:

```go
type MyModel struct {
    models.Base              // UUID primary key, CreatedAt, UpdatedAt, DeletedAt
    Name string `gorm:"not null"`
}
```

Use UUIDs as primary keys. Use GORM soft deletes (the `DeletedAt` field on `models.Base`). Never use integer auto-increment IDs.

### Vault Token Paths

Provider credential paths follow this convention:

```
idp/capabilities/{environmentID}/{capabilityName}/{providerName}/token
```

Example:
```
idp/capabilities/550e8400-e29b-41d4-a716-446655440000/runtime/nomad/token
```

---

## Frontend Conventions

### File-Based Routing

The admin dashboard uses TanStack Router with file-based routing. Route files live in `src/routes/`. The naming convention maps directly to URL paths:

```
dashboard.environments.$envId.logs.tsx  →  /dashboard/environments/:envId/logs
dashboard.environments.$envId.platform.runtime.tsx  →  /dashboard/environments/:envId/platform/runtime
```

### API Query Hooks

All API calls go through TanStack Query hooks in `src/lib/queries.ts`. Never call `fetch` or `api.*` directly in components — always use a hook.

Pattern for read operations:
```typescript
export function useMyResource(slug: string, id: string) {
  return useQuery<MyResource, ApiError>({
    queryKey: ["workspaces", slug, "my-resource", id],
    queryFn: () => api.get(`/api/v1/workspaces/${slug}/my-resource/${id}`),
    enabled: !!slug && !!id,
  });
}
```

Pattern for mutations:
```typescript
export function useCreateMyResource() {
  const queryClient = useQueryClient();
  return useMutation<MyResource, ApiError, { slug: string; input: CreateInput }>({
    mutationFn: ({ slug, input }) =>
      api.post(`/api/v1/workspaces/${slug}/my-resource`, input),
    onSuccess: (_, { slug }) => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces", slug, "my-resource"] });
    },
  });
}
```

### Types

All API response and request types live in `src/lib/types.ts`. Add types here before using them in hooks or components. Use exact field names from the Go JSON tags.

### Component Style

- Use Tailwind CSS utility classes
- Follow the existing dark-mode–first approach (use `bg-card`, `text-foreground`, `border-border`, etc. — CSS variables defined in the theme)
- Small, focused components over large monolithic ones
- No inline styles

---

## Adding a New Capability Provider

1. **Backend — seed the provider catalogue** (`internal/providers/` or `internal/database/seed.go`):
   ```go
   {Name: "my-provider", DisplayName: "My Provider", CapabilityName: "logs", Description: "..."}
   ```

2. **Backend — implement verify logic** if needed in `capability/service.go` (the `VerifyProvider` method probes `{endpoint}/ready` — adjust the path for your provider if needed)

3. **Frontend — add endpoint placeholder** in the capability page for the relevant capability (e.g. `platform.logs.tsx`):
   ```typescript
   endpointPlaceholders={{ "my-provider": "https://my-provider.internal:9200" }}
   ```

4. **Frontend — handle token optionality** in `CapabilityPage.tsx` if your provider doesn't require a token:
   ```typescript
   const isTokenOptional = selectedProvider?.name === "loki" || selectedProvider?.name === "my-provider";
   ```

---

## Adding a New Runtime

See the extensibility section in [Runtimes](../runtimes/overview.md#adding-a-new-runtime-extensibility).

---

## Makefile Reference

```bash
# Development
make dev              # Start API + admin dashboard
make dev-backend      # Go API only (:8022)
make dev-admin        # Admin dashboard only (:3000)
make dev-site         # Public website only (:4000)

# Build
make build            # Build all artifacts
make build-backend    # Go binary → server/bin/api
make build-admin      # Admin bundle → admin/dist/
make build-site       # Site bundle → dist/

# Quality
make test             # go test ./...
make fmt              # go fmt + prettier
make lint             # eslint (admin)

# Database
make docker-up        # Start Postgres
make docker-down      # Stop all Docker services
make reset-db-dev     # Drop + re-migrate + re-seed (dev only)

# Dependencies
make install          # npm install (root + admin)
make clean            # Remove build artifacts
```

---

## Pull Request Guidelines

1. **Branch from `main`**. Use a descriptive branch name: `feature/logs-search`, `fix/nomad-allocation-resolver`, `docs/runtime-guide`.

2. **Keep backend and frontend changes together** when they are coupled (e.g. a new API endpoint and its query hook belong in the same PR).

3. **Before opening a PR:**
   ```bash
   make test    # all Go tests must pass
   make fmt     # format everything
   cd admin && npm run lint   # no lint errors
   ```

4. **PR description should include:**
   - What changed and why
   - Any API contract changes (new endpoints, changed response shapes)
   - How to test it manually

5. **Do not amend published commits.** Push new commits for review feedback.

---

## Database Migrations

The server uses GORM `AutoMigrate`. To add a column or table:

1. Update the model in `internal/<domain>/models.go`
2. `AutoMigrate` will apply the change on next server start

For destructive changes (drop column, rename, change type), `AutoMigrate` will not do it automatically. Write a manual migration or use `make reset-db-dev` during development.

Do not write raw SQL migration files — the project relies on GORM AutoMigrate for schema management.
