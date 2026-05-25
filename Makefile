# ─── IDP Monorepo Makefile ───────────────────────────────────────────────────
# Structure:
#   /           Public website (docs + platform intro) — Vite + React
#   backend/    Go/Gin REST API
#   frontend/   Admin dashboard — TanStack Start + React
#
# Usage:
#   make install       Install all npm dependencies (root + frontend/)
#   make dev           Start backend + admin dashboard concurrently
#   make dev-backend   Start backend only
#   make dev-frontend  Start admin dashboard only
#   make dev-site      Start public website only
#   make build         Build everything
#   make test          Run all tests
#   make docker-up     Start Postgres via Docker Compose
#   make docker-down   Stop Docker services
#   make fmt           Format all code
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: install dev dev-backend dev-frontend dev-site \
        build build-backend build-frontend build-site \
        test docker-up docker-down fmt clean

# ── Dependencies ─────────────────────────────────────────────────────────────

install:
	npm install
	cd frontend && npm install

# ── Development ──────────────────────────────────────────────────────────────

dev:
	@echo "Starting backend (:8022) and admin dashboard (:3000)…"
	@trap 'kill 0' SIGINT; \
	  $(MAKE) dev-backend & \
	  $(MAKE) dev-frontend & \
	  wait

dev-backend:
	cd backend && go run ./cmd/api

dev-frontend:
	cd frontend && npm run dev

dev-site:
	npm run dev

# ── Build ─────────────────────────────────────────────────────────────────────

build: build-backend build-frontend build-site

build-backend:
	cd backend && go build -o bin/api ./cmd/api

build-frontend:
	cd frontend && npm run build

build-site:
	npm run build

# ── Tests ────────────────────────────────────────────────────────────────────

test:
	cd backend && go test ./...

# ── Docker infrastructure ────────────────────────────────────────────────────

docker-up:
	docker compose up -d

docker-down:
	docker compose down

# ── Formatting ───────────────────────────────────────────────────────────────

fmt:
	cd backend && go fmt ./...
	cd frontend && npm run format

# ── Clean ────────────────────────────────────────────────────────────────────

clean:
	rm -rf backend/bin
	rm -rf frontend/dist frontend/.tanstack frontend/.wrangler
	rm -rf dist
