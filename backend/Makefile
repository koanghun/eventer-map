.PHONY: generate build local

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
