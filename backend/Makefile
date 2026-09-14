.PHONY: generate build local migrateup migratedown migrateversion

include .env
export

generate:
	@echo "Generating OpenAPI code..."
	# oapi-codegen -generate types,server,spec -package handler api/openapi.yaml > internal/handler/api.gen.go
	@echo "Generating SQL code..."
	# sqlc generate
	@echo "Done."

build:
	sam build

local:
	sam local start-api

migrateup:
	go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path db/migration -database "$(DATABASE_URL)" up

migratedown:
	go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path db/migration -database "$(DATABASE_URL)" down

migrateversion:
	go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path db/migration -database "$(DATABASE_URL)" version
