# TernakClouds IDP

An Internal Developer Platform (IDP) that gives engineering teams a single control plane to deploy services, manage secrets, govern access, and observe infrastructure — across multiple environments.

---

## Repository structure

```
idp/
├── src/                Public website source (Vite + React)
├── index.html
├── package.json
│
├── server/             Go/Gin REST API
├── admin/              Admin dashboard (TanStack Start + React)
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
│  / (repo root)      │     │  admin/              │
│  Public website     │     │  Admin dashboard     │
│  :4000              │     │  :3000               │
└─────────────────────┘     └────────┬─────────────┘
                                      │ /api/*  (proxy)
                                      ▼
                             ┌─────────────────────┐
                             │  server/             │
                             │  Go/Gin REST API     │
                             │  :8022               │
                             │
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

| Tool           | Version | Purpose                   |
| -------------- | ------- | ------------------------- |
| Go             | ≥ 1.22  | Backend API               |
| Node.js        | ≥ 20    | Frontend apps             |
| npm            | ≥ 10    | Frontend dependencies     |
| Docker         | ≥ 24    | Infrastructure (Postgres) |
| Docker Compose | ≥ 2     | Orchestration             |

Optional: HashiCorp Vault ≥ 1.15, Nomad ≥ 1.7, kubectl

---

## Getting started

### 1. Clone the repository

```bash
git clone <repo-url> idp
cd idp
```

### 2. Configure the server

```bash
cp server/.env.example server/.env
```

Open `server/.env` and fill in the required values:

```env
APP_PORT=8022

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=idp_platform
DB_SSLMODE=disable

GIN_MODE=debug

JWT_SECRET=change-me-to-a-long-random-string

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme123

# Leave these as-is to disable Vault in development
VAULT_ENABLED=false
```

### 3. Configure the admin dashboard

```bash
cp admin/.env.example admin/.env
```

In development the Vite proxy forwards `/api/*` to the server, so `VITE_API_URL` can be left empty:

```env
VITE_API_URL=
```

### 4. Start the database

```bash
make docker-up
```

This starts Postgres on `:5432`. Wait a few seconds for it to be ready.

### 5. Install frontend dependencies

```bash
make install
```

### 6. Start development servers

```bash
make dev
```

This starts both the Go API (`:8022`) and the admin dashboard (`:3000`) together. Stop with `Ctrl+C`.

Or start them individually:

```bash
make dev-backend    # Go API on :8022
make dev-admin      # Admin dashboard on :3000
make dev-site       # Public website on :4000
```

### 7. Open the app

| URL                   | What            |
| --------------------- | --------------- |
| http://localhost:3000 | Admin dashboard |
| http://localhost:4000 | Public website  |
| http://localhost:8022 | API (direct)    |

Log in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you set in `server/.env`.

---

## Environment variables

### `server/.env`

| Variable          | Required | Default   | Description                            |
| ----------------- | -------- | --------- | -------------------------------------- |
| `APP_PORT`        | Yes      | `8022`    | API listen port                        |
| `DB_HOST`         | Yes      | —         | PostgreSQL host                        |
| `DB_PORT`         | Yes      | `5432`    | PostgreSQL port                        |
| `DB_USER`         | Yes      | —         | PostgreSQL user                        |
| `DB_PASSWORD`     | Yes      | —         | PostgreSQL password                    |
| `DB_NAME`         | Yes      | —         | PostgreSQL database name               |
| `DB_SSLMODE`      | No       | `disable` | `disable` in dev, `require` in prod    |
| `GIN_MODE`        | No       | `debug`   | `debug` (dev) or `release` (prod)      |
| `JWT_SECRET`      | Yes      | —         | Secret key for signing JWTs            |
| `ADMIN_EMAIL`     | Yes      | —         | Initial admin account email            |
| `ADMIN_PASSWORD`  | Yes      | —         | Initial admin account password         |
| `VAULT_ENABLED`   | No       | `false`   | Set `true` to enable Vault integration |
| `VAULT_ADDR`      | If Vault | —         | Vault server address                   |
| `VAULT_ROLE_ID`   | If Vault | —         | AppRole role ID                        |
| `VAULT_SECRET_ID` | If Vault | —         | AppRole secret ID                      |
| `VAULT_KV_MOUNT`  | If Vault | —         | KV v2 mount path                       |

### `admin/.env`

| Variable       | Required  | Description                                              |
| -------------- | --------- | -------------------------------------------------------- |
| `VITE_API_URL` | Prod only | Backend URL (leave empty in dev — Vite proxy handles it) |

---

## Common commands

```bash
# Development
make dev              # start server + admin dashboard
make dev-backend      # server only (:8022)
make dev-admin        # admin dashboard only (:3000)
make dev-site         # public website only (:5173)

# Build
make build            # build everything (binary + both frontend bundles)
make build-backend    # Go binary → server/bin/api
make build-admin      # admin bundle → admin/dist/
make build-site       # public website bundle → dist/

# Testing & quality
make test             # run Go tests
make fmt              # format Go + frontend code

# Infrastructure
make docker-up        # start Postgres (detached)
make docker-down      # stop all Docker services

# Misc
make install          # npm install for root site + admin dashboard
make clean            # remove all build artifacts
```

---

## Production deployment

Build all artifacts:

```bash
make build
```

Then serve:

- **Server**: run `server/bin/api` with production env vars (`GIN_MODE=release`, real DB credentials, strong `JWT_SECRET`)
- **Admin dashboard**: deploy `admin/dist/` to your CDN or static host; set `VITE_API_URL` to your backend origin
- **Public website**: deploy `dist/` (repo root) to your CDN

Or use Docker Compose for the full stack:

```bash
docker compose up -d
```

---

## Contributing

1. Create a feature branch from `main`
2. Keep server and frontend changes in the same commit/PR when they are coupled
3. Run `make test` and `make fmt` before opening a PR
4. Describe the API contract change in the PR description if you modify server endpoints
