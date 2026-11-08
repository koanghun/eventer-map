.PHONY: generate build build-EventerMapApiFunction deploy deploy-guided local migrateup migratedown migrateversion

-include .env
export

STACK_NAME ?= eventer-map-stack
AWS_REGION ?= ap-northeast-1
ARTIFACT_BUCKET ?=

generate:
	@echo "Generating OpenAPI code..."
	go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest -generate types,std-http,spec -package handler api/openapi.yaml > internal/handler/openapi.gen.go
	@echo "Generating SQL code..."
	go run github.com/sqlc-dev/sqlc/cmd/sqlc@latest generate
	@echo "Done."

# Target invoked by AWS SAM (if using 'sam build')
build-EventerMapApiFunction:
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -ldflags="-s -w" -o $(ARTIFACTS_DIR)/bootstrap ./cmd/server

# Direct Go cross-compilation for AWS Lambda (arm64) — works without SAM CLI!
build:
	@echo "Building Go Lambda binary (linux/arm64)..."
	@mkdir -p .build
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -ldflags="-s -w" -o .build/bootstrap ./cmd/server
	@echo "Build complete: .build/bootstrap"

# Deploy using SAM CLI if installed, otherwise fallback to standard AWS CLI (cloudformation package + deploy)
deploy: build
	@if command -v sam >/dev/null 2>&1; then \
		echo "Deploying with AWS SAM CLI..."; \
		sam deploy --template-file template.yaml --stack-name $(STACK_NAME) --region $(AWS_REGION) \
			--resolve-s3 --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset \
			--parameter-overrides \
			Stage="$${STAGE:-prod}" \
			DatabaseUrl="$${DATABASE_URL}" \
			JwtSecret="$${JWT_SECRET}" \
			CorsOrigins="$${CORS_ORIGINS}" \
			CookieDomain="$${COOKIE_DOMAIN}" \
			CookieSameSite="$${COOKIE_SAMESITE:-None}"; \
	else \
		echo "Deploying with AWS CLI (CloudFormation) in $(AWS_REGION)..."; \
		if [ -z "$(ARTIFACT_BUCKET)" ]; then \
			ACCOUNT_ID=$$(aws sts get-caller-identity --query Account --output text); \
			BUCKET="$(STACK_NAME)-artifacts-$${ACCOUNT_ID}-$(AWS_REGION)"; \
			if ! aws s3api head-bucket --bucket "$$BUCKET" --region $(AWS_REGION) 2>/dev/null; then \
				echo "Creating deployment artifact bucket: s3://$$BUCKET"; \
				aws s3 mb "s3://$$BUCKET" --region $(AWS_REGION); \
			fi; \
		else \
			BUCKET="$(ARTIFACT_BUCKET)"; \
			echo "Using existing artifact bucket: s3://$$BUCKET"; \
		fi; \
		aws cloudformation package \
			--template-file template.yaml \
			--s3-bucket "$$BUCKET" \
			--output-template-file .build/packaged.yaml \
			--region $(AWS_REGION); \
		aws cloudformation deploy \
			--template-file .build/packaged.yaml \
			--stack-name $(STACK_NAME) \
			--region $(AWS_REGION) \
			--capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
			--no-fail-on-empty-changeset \
			--parameter-overrides \
			Stage="$${STAGE:-prod}" \
			DatabaseUrl="$${DATABASE_URL}" \
			JwtSecret="$${JWT_SECRET}" \
			CorsOrigins="$${CORS_ORIGINS}" \
			CookieDomain="$${COOKIE_DOMAIN}" \
			CookieSameSite="$${COOKIE_SAMESITE:-None}"; \
	fi

local:
	sam local start-api

migrateup:
	go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path db/migration -database "$(DATABASE_URL)" up

migratedown:
	go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path db/migration -database "$(DATABASE_URL)" down

migrateversion:
	go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path db/migration -database "$(DATABASE_URL)" version
