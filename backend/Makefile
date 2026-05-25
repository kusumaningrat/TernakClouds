APP_NAME=idp-backend

run:
	go run ./cmd/api

build:
	go build -o bin/api ./cmd/api

docker-build:
	docker build -t $(APP_NAME) .

up:
	docker compose up --build

reset-db-dev:
	go run ./cmd/reset-db

migrate:
	migrate -path migrations \
		-database "postgres://kusumaningrat:kusumaningrat16@localhost:5433/idp?sslmode=disable" \
		up

down:
	docker compose down

fmt:
	go fmt ./...

test:
	go test ./...