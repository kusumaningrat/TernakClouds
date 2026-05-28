# Installation

---

## Prerequisites

| Tool            | Version | Required                         |
| --------------- | ------- | -------------------------------- |
| Go              | ≥ 1.22  | Yes                              |
| Node.js         | ≥ 20    | Yes                              |
| npm             | ≥ 10    | Yes                              |
| Docker          | ≥ 24    | Yes                              |
| Docker Compose  | ≥ 2     | Yes                              |
| HashiCorp Vault | ≥ 1.15  | Only if `VAULT_ENABLED=true`     |
| Nomad           | ≥ 1.7   | Only if using Nomad runtime      |
| kubectl         | Any     | Only if using Kubernetes runtime |

---

## 1. Clone the Repository

```bash
git clone <repo-url> idp
cd idp
```

---

## 2. Configure the Backend

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your values:

```env
# Server
APP_PORT=8022
GIN_MODE=debug

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=idp_platform
DB_SSLMODE=disable

# Auth
JWT_SECRET=change-me-to-a-long-random-string-at-least-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=168h

# Bootstrap admin account (created on first run)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme123

# Vault (leave false for local development)
VAULT_ENABLED=false
VAULT_ADDR=http://localhost:8200
VAULT_ROLE_ID=
VAULT_SECRET_ID=
VAULT_KV_MOUNT=secret
```

> **Important:** Change `JWT_SECRET` and `ADMIN_PASSWORD` before any non-local deployment. Use a cryptographically random string of at least 32 characters for `JWT_SECRET`.

---

## 3. Configure the Admin Dashboard

```bash
cp admin/.env.example admin/.env
```

In development, the Vite dev server proxies all `/api/*` requests to the backend automatically. Leave `VITE_API_URL` empty:

```env
VITE_API_URL=
```

For production, set this to your backend's public URL:

```env
VITE_API_URL=https://api.yourplatform.com
```

---

## 4. Start Infrastructure

```bash
make docker-up
```

This starts PostgreSQL on `:5432` using Docker Compose. Wait a few seconds for the database to be ready before starting the API.

---

## 5. Install Frontend Dependencies

```bash
make install
```

This runs `npm install` for both the public website and the admin dashboard.

---

## 6. Start Development Servers

```bash
make dev
```

This starts the Go API and admin dashboard concurrently. Stop both with `Ctrl+C`.

Or start them individually:

```bash
make dev-backend    # Go API on :8022
make dev-admin      # Admin dashboard on :3000
make dev-site       # Public website on :4000
```

---

## 7. First Login

Open [http://localhost:3000](http://localhost:3000).

Log in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you set in `server/.env`. On first start, the server auto-migrates the database and creates:

- Default roles and permissions
- The bootstrap admin user
- A default **Platform** workspace with `dev`, `staging`, and `production` environments

---

## Setting Up Vault (Optional)

Vault is required only if you want to store provider credentials (Nomad tokens, Kubernetes tokens) securely. For local development without real runtime connections, you can leave `VAULT_ENABLED=false`.

### Start Vault

```bash
docker compose up vault -d
export VAULT_ADDR=http://localhost:8200
```

### Initialize and Unseal

```bash
vault operator init      # save the unseal keys and root token
vault operator unseal    # run 3 times with different unseal keys
```

### Enable AppRole and KV

```bash
export VAULT_TOKEN=<root-token>

vault auth enable approle
vault secrets enable -path=secret -version=2 kv

# Create policy (copy from vault-policy-example.hcl in the repo)
vault policy write idp policy.hcl

# Create AppRole
vault write auth/approle/role/idp \
  token_policies="idp" \
  token_ttl=1h \
  token_max_ttl=4h

# Get credentials for .env
vault read auth/approle/role/idp/role-id
vault write -f auth/approle/role/idp/secret-id
```

Update `server/.env`:

```env
VAULT_ENABLED=true
VAULT_ADDR=http://localhost:8200
VAULT_ROLE_ID=<role-id>
VAULT_SECRET_ID=<secret-id>
VAULT_KV_MOUNT=secret
```

---

## Environment Variable Reference

### `server/.env`

| Variable             | Default                 | Required | Description                            |
| -------------------- | ----------------------- | -------- | -------------------------------------- |
| `APP_PORT`           | `8022`                  | Yes      | HTTP listen port                       |
| `GIN_MODE`           | `debug`                 | No       | `debug` (dev) or `release` (prod)      |
| `DB_HOST`            | `localhost`             | Yes      | PostgreSQL host                        |
| `DB_PORT`            | `5432`                  | Yes      | PostgreSQL port                        |
| `DB_USER`            | `postgres`              | Yes      | PostgreSQL user                        |
| `DB_PASSWORD`        | —                       | Yes      | PostgreSQL password                    |
| `DB_NAME`            | `idp_platform`          | Yes      | Database name                          |
| `DB_SSLMODE`         | `disable`               | No       | `disable` in dev, `require` in prod    |
| `JWT_SECRET`         | —                       | Yes      | HMAC-SHA256 signing key (min 32 chars) |
| `JWT_ACCESS_EXPIRY`  | `15m`                   | No       | Access token TTL                       |
| `JWT_REFRESH_EXPIRY` | `168h`                  | No       | Refresh token TTL                      |
| `ADMIN_EMAIL`        | —                       | Yes      | Bootstrap admin email                  |
| `ADMIN_PASSWORD`     | —                       | Yes      | Bootstrap admin password               |
| `VAULT_ENABLED`      | `false`                 | No       | Enable Vault integration               |
| `VAULT_ADDR`         | `http://localhost:8200` | If Vault | Vault server URL                       |
| `VAULT_ROLE_ID`      | —                       | If Vault | AppRole role ID                        |
| `VAULT_SECRET_ID`    | —                       | If Vault | AppRole secret ID                      |
| `VAULT_KV_MOUNT`     | `secret`                | If Vault | KV v2 mount path                       |

### `admin/.env`

| Variable       | Required  | Description                                       |
| -------------- | --------- | ------------------------------------------------- |
| `VITE_API_URL` | Prod only | Backend URL. Empty in dev (Vite proxy handles it) |

---

## Resetting the Database

During development, you can wipe and re-seed the database:

```bash
make reset-db-dev
# or
cd server && go run ./cmd/reset-db
```

This drops all tables, re-runs migrations, and re-seeds defaults. All data is lost.

---

## Production Deployment

### Build

```bash
make build
```

Produces:

- `server/bin/api` — Go binary
- `admin/dist/` — Admin dashboard static bundle
- `dist/` — Public website static bundle

### Serve

**Backend:**

```bash
GIN_MODE=release ./server/bin/api
```

**Admin dashboard:** Deploy `admin/dist/` to your CDN or static host (Nginx, Caddy, Cloudflare Pages, Vercel). Set `VITE_API_URL` at build time to your backend's public URL.

**Public website:** Deploy `dist/` to your CDN.

### Full stack with Docker Compose

```bash
docker compose up -d
```

The Docker image uses a two-stage build (Go builder → Alpine runtime). Final image is approximately 15 MB.

---

## Connecting Runtimes

Once the platform is running, connect your first runtime:

1. Open the admin dashboard → select a workspace → open an environment
2. Go to **Platform → Runtime**
3. Click **Add provider** → select `Kubernetes` or `Nomad`
4. Enter the API endpoint and authentication token
5. Click **Verify** to confirm connectivity

See [Runtimes](../runtimes/overview.md) for detailed provider configuration.
