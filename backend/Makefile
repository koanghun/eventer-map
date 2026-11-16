.PHONY: install-tools generate vet test ci build build-EventerMapApiFunction deploy deploy-guided setup-oidc local migrateup migratedown migrateversion

-include .env
export

STACK_NAME ?= eventer-map-stack
AWS_REGION ?= ap-southeast-2
ARTIFACT_BUCKET ?=
OIDC_STACK_NAME ?= eventer-map-github-oidc
GITHUB_ORG ?= koanghun
GITHUB_REPO ?= eventer-map
GITHUB_BRANCH ?= *
EXISTING_OIDC_PROVIDER_ARN ?=
OAPI_CODEGEN_VERSION ?= v2.8.2
SQLC_VERSION ?= v1.31.1

export PATH := $(HOME)/go/bin:$(HOME)/.local/bin:/usr/local/bin:/snap/bin:$(PATH):/home/parkkh/go/bin

install-tools:
	@if ! command -v oapi-codegen >/dev/null 2>&1; then \
		echo "Installing oapi-codegen ($(OAPI_CODEGEN_VERSION))..."; \
		GOTOOLCHAIN=auto go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@$(OAPI_CODEGEN_VERSION); \
	fi
	@if ! command -v sqlc >/dev/null 2>&1; then \
		echo "Installing sqlc ($(SQLC_VERSION))..."; \
		GOTOOLCHAIN=auto go install github.com/sqlc-dev/sqlc/cmd/sqlc@$(SQLC_VERSION); \
	fi

generate: install-tools
	@echo "Generating OpenAPI code..."
	oapi-codegen -generate types,std-http,spec -package handler api/openapi.yaml > internal/handler/openapi.gen.go
	@echo "Generating SQL code..."
	sqlc generate
	@echo "Done."

vet:
	go vet ./...

test:
	go test -v -race ./...

ci: vet test build

# Target invoked by AWS SAM (if using 'sam build')
build-EventerMapApiFunction:
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -ldflags="-s -w" -o $(ARTIFACTS_DIR)/bootstrap ./cmd/server

# Direct Go cross-compilation for AWS Lambda (arm64) — works without SAM CLI!
build:
	@echo "Building Go Lambda binary (linux/arm64)..."
	@mkdir -p .build
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -ldflags="-s -w" -o .build/bootstrap ./cmd/server
	@echo "Build complete: .build/bootstrap"

# Guided interactive SAM deployment (creates samconfig.toml when SAM CLI is installed)
deploy-guided: build
	@if command -v sam >/dev/null 2>&1; then \
		sam deploy --guided --template-file template.yaml --stack-name $(STACK_NAME) --region $(AWS_REGION) --capabilities CAPABILITY_IAM; \
	else \
		echo "Error: AWS SAM CLI is not installed. Use 'make deploy' (which uses AWS CLI CloudFormation directly)."; \
		exit 1; \
	fi

# Provision GitHub Actions OIDC Provider + IAM Deploy Role
setup-oidc:
	@echo "Deploying GitHub Actions OIDC stack ($(OIDC_STACK_NAME)) in $(AWS_REGION)..."
	@set -e; \
	EXISTING_ARN="$(EXISTING_OIDC_PROVIDER_ARN)"; \
	if [ -z "$$EXISTING_ARN" ]; then \
		EXISTING_ARN=$$(aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?ends_with(Arn, ':oidc-provider/token.actions.githubusercontent.com')].Arn | [0]" --output text 2>/dev/null || true); \
		if [ "$$EXISTING_ARN" = "None" ]; then EXISTING_ARN=""; fi; \
	fi; \
	if [ -n "$$EXISTING_ARN" ]; then \
		echo "Reusing existing GitHub OIDC Provider: $$EXISTING_ARN"; \
	fi; \
	aws cloudformation deploy \
		--template-file github-oidc.yaml \
		--stack-name $(OIDC_STACK_NAME) \
		--region $(AWS_REGION) \
		--capabilities CAPABILITY_NAMED_IAM \
		--no-fail-on-empty-changeset \
		--parameter-overrides \
			GitHubOrg="$(GITHUB_ORG)" \
			GitHubRepo="$(GITHUB_REPO)" \
			GitHubBranch="$(GITHUB_BRANCH)" \
			ExistingOIDCProviderArn="$$EXISTING_ARN"; \
	echo ""; \
	echo "GitHub Actions OIDC Outputs:"; \
	aws cloudformation describe-stacks --stack-name $(OIDC_STACK_NAME) --region $(AWS_REGION) \
		--query "Stacks[0].Outputs[*].[OutputKey,OutputValue]" --output table

# Deploy using SAM CLI if installed, otherwise fallback to standard AWS CLI (cloudformation package + deploy)
deploy: build
	@set -e; \
	DEPLOY_DB_URL="$${PROD_DATABASE_URL:-$${DATABASE_URL}}"; \
	if [ -z "$$DEPLOY_DB_URL" ]; then \
		echo "Error: PROD_DATABASE_URL (or DATABASE_URL) is not set. Configure backend/.env or environment variables."; \
		exit 1; \
	fi; \
	if echo "$$DEPLOY_DB_URL" | grep -qE '(@|//)(localhost|127\.0\.0\.1|192\.168\.[0-9.]+|10\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9.]+)(:|/)'; then \
		echo "Error: PROD_DATABASE_URL/DATABASE_URL points to a local or private IP address reachable only inside your LAN."; \
		echo "       Set PROD_DATABASE_URL in backend/.env to a publicly reachable DB host (e.g., DDNS/Neon/RDS) for AWS Lambda."; \
		exit 1; \
	fi; \
	if [ -z "$${JWT_SECRET}" ]; then \
		echo "Error: JWT_SECRET is not set. Set a strong secret in backend/.env or environment variables."; \
		exit 1; \
	fi; \
	if command -v sam >/dev/null 2>&1; then \
		echo "Deploying with AWS SAM CLI..."; \
		sam deploy --template-file template.yaml --stack-name $(STACK_NAME) --region $(AWS_REGION) \
			--resolve-s3 --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset \
			--parameter-overrides \
			Stage="$${STAGE:-prod}" \
			DatabaseUrl="$$DEPLOY_DB_URL" \
			JwtSecret="$${JWT_SECRET}" \
			CorsOrigins="$${CORS_ORIGINS}" \
			CookieDomain="$${COOKIE_DOMAIN}" \
			CookieSameSite="$${COOKIE_SAMESITE:-None}" \
			XClientId="$${X_CLIENT_ID}" \
			XClientSecret="$${X_CLIENT_SECRET}" \
			XRedirectUri="$${X_REDIRECT_URI}" \
			XRequestEmail="$${X_REQUEST_EMAIL:-false}" \
			SmtpHost="$${SMTP_HOST}" \
			SmtpPort="$${SMTP_PORT:-587}" \
			SmtpUser="$${SMTP_USER}" \
			SmtpPassword="$${SMTP_PASSWORD}" \
			SmtpFrom="$${SMTP_FROM}"; \
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
			DatabaseUrl="$$DEPLOY_DB_URL" \
			JwtSecret="$${JWT_SECRET}" \
			CorsOrigins="$${CORS_ORIGINS}" \
			CookieDomain="$${COOKIE_DOMAIN}" \
			CookieSameSite="$${COOKIE_SAMESITE:-None}" \
			XClientId="$${X_CLIENT_ID}" \
			XClientSecret="$${X_CLIENT_SECRET}" \
			XRedirectUri="$${X_REDIRECT_URI}" \
			XRequestEmail="$${X_REQUEST_EMAIL:-false}" \
			SmtpHost="$${SMTP_HOST}" \
			SmtpPort="$${SMTP_PORT:-587}" \
			SmtpUser="$${SMTP_USER}" \
			SmtpPassword="$${SMTP_PASSWORD}" \
			SmtpFrom="$${SMTP_FROM}"; \
	fi

local:
	sam local start-api

migrateup:
	go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path db/migration -database "$(DATABASE_URL)" up

migratedown:
	go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path db/migration -database "$(DATABASE_URL)" down

migrateversion:
	go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path db/migration -database "$(DATABASE_URL)" version
