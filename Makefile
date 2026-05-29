# Structure:
#   /           Public website (docs + platform intro) — Vite + React
#   server/    Go/Gin REST API
#   admin/   Admin dashboard — TanStack Start + React
#
# Usage:
#   make install       Install all npm dependencies (root + admin/)
#   make dev           Start backend + admin dashboard concurrently
#   make dev-backend   Start backend only
#   make dev-admin  Start admin dashboard only
#   make dev-site      Start public website only
#   make build         Build everything
#   make test          Run all tests
#   make docker-up     Start Postgres via Docker Compose
#   make docker-down   Stop Docker services
#   make fmt           Format all code
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: install dev dev-backend dev-admin dev-site \
        build build-backend build-admin build-site \
        test docker-up docker-down fmt clean

# ── Dependencies ─────────────────────────────────────────────────────────────

prepare:
	cd server && go mod tidy
	npm install
	cd admin && npm install

# ── Development ──────────────────────────────────────────────────────────────

dev:
	@echo "Starting backend (:8022) and admin dashboard (:3000)…"
	@trap 'kill 0' SIGINT; \
	  $(MAKE) dev-backend & \
	  $(MAKE) dev-admin & \
	  wait

dev-backend:
	cd server && go run ./cmd/api

dev-admin:
	cd admin && npm run dev

dev-site:
	npm run dev

# ── Build ─────────────────────────────────────────────────────────────────────

build: build-backend build-admin build-site

build-backend:
	cd server && go build -o bin/api ./cmd/api

build-admin:
	cd admin && npm run build

build-site:
	npm run build

# ── Tests ────────────────────────────────────────────────────────────────────

test:
	cd server && go test ./...

# ── Docker infrastructure ────────────────────────────────────────────────────

docker-up:
	docker compose up -d

docker-down:
	docker compose down

# ── Formatting ───────────────────────────────────────────────────────────────

fmt:
	cd server && go fmt ./...
	cd admin && npm run format

# ── Clean ────────────────────────────────────────────────────────────────────

clean:
	rm -rf server/bin
	rm -rf admin/dist admin/.tanstack admin/.wrangler
	rm -rf dist

# ── Admin Linting ────────────────────────────────────────────────────────────────────

lint-admin:
	cd admin && npm run lint