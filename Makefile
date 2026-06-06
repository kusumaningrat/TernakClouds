# Structure:
#   /           Public website (docs + platform intro) — Vite + React
#   backend/    Go/Gin REST API
#   ui/   Admin dashboard — TanStack Start + React
#
# Usage:
#   make install       Install all npm dependencies (root + ui/)
#   make dev           Start backend + ui dashboard concurrently
#   make dev-backend   Start backend only
#   make dev-ui  Start ui dashboard only
#   make dev-site      Start public website only
#   make build         Build everything
#   make test          Run all tests
#   make docker-up     Start Postgres via Docker Compose
#   make docker-down   Stop Docker services
#   make fmt           Format all code
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: install dev dev-backend dev-ui dev-site \
        build build-backend build-ui build-site \
        test docker-up docker-down fmt clean

# ── Dependencies ─────────────────────────────────────────────────────────────

prepare:
	cd backend && go mod tidy
	npm install
	cd ui && npm install

# ── Development ──────────────────────────────────────────────────────────────

dev:
	@echo "Starting backend (:8022) and ui dashboard (:3000)…"
	@trap 'kill 0' SIGINT; \
	  $(MAKE) dev-backend & \
	  $(MAKE) dev-ui & \
	  wait

dev-backend:
	cd backend && go run ./cmd/api

dev-ui:
	cd ui && npm run dev

dev-site:
	npm run dev

# ── Build ─────────────────────────────────────────────────────────────────────

build: build-backend build-ui build-site

build-backend:
	cd backend && go build -o bin/api ./cmd/api

build-ui:
	cd ui && npm run build

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
	cd ui && npm run format

# ── Clean ────────────────────────────────────────────────────────────────────

clean:
	rm -rf backend/bin
	rm -rf ui/dist ui/.tanstack ui/.wrangler
	rm -rf dist

# ── ui Linting ────────────────────────────────────────────────────────────────────

lint-ui:
	cd ui && npm run lint

lint-autofix:
	cd ui && npm run lint -- --fix