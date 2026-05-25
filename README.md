# TernakClouds IDP

An Internal Developer Platform (IDP) that gives engineering teams a single control plane to deploy services, manage secrets, govern access, and observe infrastructure — across multiple environments.

---

## Repository structure

```
idp/                    Public website — platform intro & docs (Vite + React)
├── src/                Website source
├── index.html
├── package.json
├── vite.config.ts
│
├── backend/            Go/Gin REST API
├── frontend/           Admin dashboard (TanStack Start + React)
│
├── docker-compose.yml  Infrastructure services (Postgres, API)
├── Makefile            Unified dev/build/test commands
└── README.md
```

> The repo root **is** the public website. `npm run dev` at the root starts the docs/intro site.

---

## Architecture overview

```
┌─────────────────────┐     ┌─────────────────────┐
│  / (repo root)      │     │  frontend/           │
│  Public website     │     │  Admin dashboard     │
│  :5173 (dev)        │     │  :3000 (dev)         │
└─────────────────────┘     └────────┬─────────────┘
                                      │ /api/*  (proxy)
                                      ▼
                             ┌─────────────────────┐
                             │  backend/            │
                             │  Go/Gin REST API     │
                             │  :8022 (dev)         │
                             │  :8080 (prod)        │
                             └────────┬─────────────┘
                                      │
                                 ┌────┴────┐
                                 │         │
                             ┌───▼───┐ ┌──▼───┐
                             │  PG   │ │Vault │
                             │ :5432 │ │:8200 │
                             └───────┘ └──────┘
```

**Key flows:**
- Admin dashboard proxies all `/api/*` requests to the backend in development
- Backend issues short-lived JWTs; the frontend stores them in localStorage and refreshes automatically
- Secrets capability uses HashiCorp Vault (optional); disable with `VAULT_ENABLED=false`
- Nomad and Kubernetes providers are bound per-environment via Platform → Runtime

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Go | ≥ 1.22 | Backend |
| Node.js | ≥ 20 | Frontend |
| npm | ≥ 10 | Frontend dependencies |
| Docker | ≥ 24 | Infrastructure (Postgres) |
| Docker Compose | ≥ 2 | Orchestration |

Optional: HashiCorp Vault ≥ 1.15, Nomad ≥ 1.7, kubectl

---

## Quickstart

### 1. Clone

```bash
git clone <repo-url> idp
cd idp
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values (see Environment variables below)
```

### 3. Start infrastructure

```bash
make docker-up          # starts Postgres on :5432
```

### 4. Install frontend dependencies

```bash
make install            # installs npm deps for root site + admin dashboard
```

### 5. Start development servers

```bash
# Backend + admin dashboard together:
make dev

# Or individually:
make dev-backend        # Go API on :8022
make dev-frontend       # Admin dashboard on :3000
make dev-site           # Public website on :5173
```

Open [http://localhost:3000](http://localhost:3000) for the admin dashboard.  
Open [http://localhost:5173](http://localhost:5173) for the public website.

---

## Environment variables

### `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_PORT` | Yes | API listen port (default `8022`) |
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PORT` | Yes | PostgreSQL port (default `5432`) |
| `DB_USER` | Yes | PostgreSQL user |
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `DB_NAME` | Yes | PostgreSQL database name |
| `DB_SSLMODE` | No | `disable` in dev, `require` in prod |
| `GIN_MODE` | No | `debug` (dev) or `release` (prod) |
| `JWT_SECRET` | Yes | Secret key for signing JWTs |
| `ADMIN_EMAIL` | Yes | Initial admin account email |
| `ADMIN_PASSWORD` | Yes | Initial admin account password |
| `VAULT_ENABLED` | No | `true` to enable Vault integration |
| `VAULT_ADDR` | If Vault | Vault server address |
| `VAULT_ROLE_ID` | If Vault | AppRole role ID |
| `VAULT_SECRET_ID` | If Vault | AppRole secret ID |
| `VAULT_KV_MOUNT` | If Vault | KV v2 mount path |

### `frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Prod only | Backend URL (leave empty in dev — Vite proxy handles it) |

---

## Common commands

```bash
make dev              # start backend + admin dashboard
make dev-backend      # backend only
make dev-frontend     # admin dashboard only
make dev-site         # public website only

make build            # build all (binary + both frontend bundles)
make build-backend    # Go binary → backend/bin/api
make build-frontend   # admin bundle → frontend/dist/
make build-site       # public website bundle → dist/

make test             # run Go tests
make fmt              # format Go + frontend code

make docker-up        # start Postgres (detached)
make docker-down      # stop all Docker services

make install          # npm install for both frontends
make clean            # remove all build artifacts
```

---

## Production deployment

Build all artifacts:

```bash
make build
```

Then serve:
- **Backend**: run `backend/bin/api` with production env vars (`GIN_MODE=release`, real DB creds, strong `JWT_SECRET`)
- **Admin dashboard**: deploy `frontend/dist/` to your CDN or static host; set `VITE_API_URL` to your backend origin
- **Public website**: deploy `dist/` (repo root) to your CDN

Or use Docker Compose for the backend:

```bash
docker compose up -d
```

---

## Project documentation

Additional design and architecture documents are in `backend/`:

- [`backend/Docs.md`](backend/Docs.md) — API reference
- [`backend/Authentication.md`](backend/Authentication.md) — Auth flow
- [`backend/Flow.md`](backend/Flow.md) — Request lifecycle
- [`backend/design.md`](backend/design.md) — System design
- [`backend/workspace.md`](backend/workspace.md) — Workspace model
- [`backend/env-workspace-isolation.md`](backend/env-workspace-isolation.md) — Environment isolation
- [`backend/vault-config-example.hcl`](backend/vault-config-example.hcl) — Vault setup

---

## Contributing

1. Create a feature branch from `main`
2. Keep backend and frontend changes in the same commit/PR when they are coupled
3. Run `make test` and `make fmt` before opening a PR
4. Describe the API contract change in the PR description if you modify backend endpoints
