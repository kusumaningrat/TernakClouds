# TernakClouds

TernakClouds is a self-hosted Internal Developer Platform (IDP) for platform engineering teams. It centralizes deployment, runtime management, access control, secrets, and observability across multiple runtimes (Kubernetes, Nomad, Docker) behind a single consistent interface.

---

## What It Does

- **Runtime abstraction** — manage Kubernetes, Nomad, and Docker workloads without exposing cluster credentials to developers
- **Environment management** — workspace-scoped environments (dev, staging, production) with independent capability providers per environment
- **Infrastructure management** — bind and verify runtime providers per environment via **Platform → Infrastructure**
- **Secrets** — Vault-backed secret grants with RBAC enforcement; credentials never stored in the database
- **Deployments** — blueprint-driven provisioning, service catalog, manifest generation (Nomad HCL, Kubernetes YAML)
- **Observability** — centralized log streaming over SSE from any bound runtime
- **Multi-tenancy** — workspace isolation with two-layer authorization (platform roles + workspace membership)
- **User lifecycle** — admin-created users are assigned to a workspace at creation and required to change their password on first login

---

## Repository Layout

```
TernakClouds/
├── backend/        Go/Gin REST API
├── ui/             Admin dashboard (TanStack Router + React)
├── docs-site/      Public documentation site (Docusaurus)
├── docs/           Documentation source (Markdown)
├── docker-compose.yml
└── Makefile
```

---

## Quick Start

```bash
# 1. Clone
git clone <repo-url> idp && cd idp

# 2. Configure backend
cp backend/.env.example backend/.env
# edit backend/.env (DB, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD)

# 3. Start infrastructure (Postgres + Vault)
make infra-up

# 4. Install dependencies
make prepare

# 5. Start dev servers (backend :8022 + dashboard :3000)
make dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your configured admin credentials. The server auto-migrates the database and seeds default roles, the admin user, and a default **Platform** workspace on first start.

---

## Documentation

Full documentation lives in `docs/` and is served by the Docusaurus site in `docs-site/`.

- [Platform Overview](./docs/introduction/overview.md)
- [Installation Guide](./docs/getting-started/installation.md)
- [Architecture](./docs/architecture/overview.md)
- [Authentication & RBAC](./docs/authentication/rbac.md)
- [Runtime Providers](./docs/runtimes/overview.md)
- [Secrets](./docs/secrets/overview.md)
- [Contributing](./docs/contributing/guide.md)

---

## Contributing

See [`docs/contributing/guide.md`](./docs/contributing/guide.md).
