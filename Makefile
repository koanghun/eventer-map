.PHONY: generate verify-codegen test-be test-fe ci install-aws-cli deploy-check setup-oidc setup-github-secrets deploy-init deploy-be deploy-fe deploy-all stack-outputs

STACK_NAME ?= eventer-map-stack
AWS_REGION ?= ap-southeast-2

export PATH := $(HOME)/go/bin:$(HOME)/.local/bin:/usr/local/bin:/snap/bin:$(PATH)

# Generate both Backend (oapi-codegen + sqlc) and Frontend (Orval) code
generate:
	cd backend && $(MAKE) generate
	cd frontend && npm run generate:api

# Verify generated code is up to date with OpenAPI spec and SQL queries
verify-codegen: generate
	@echo "Verifying generated code is in sync..."
	git diff --exit-code backend/internal/handler/openapi.gen.go backend/internal/repository/ frontend/src/api/generated/

# Run Backend CI checks (go vet, tests, Lambda build)
test-be:
	cd backend && $(MAKE) ci

# Run Frontend CI checks (TypeScript typecheck, unit tests, production build)
test-fe:
	cd frontend && npx tsc --noEmit && CI=true npm test -- --watchAll=false && CI=true npm run build

# Run full local CI suite
ci: verify-codegen test-be test-fe

# Install AWS CLI v2 into ~/.local/bin without sudo
install-aws-cli:
	bash scripts/install_aws_cli.sh

# Verify local AWS CLI credentials, backend/.env, and frontend/.env before deploying
deploy-check:
	AWS_REGION=$(AWS_REGION) bash scripts/check_aws_env.sh

# Provision GitHub Actions OIDC Identity Provider and IAM Deploy Role
setup-oidc:
	cd backend && $(MAKE) setup-oidc AWS_REGION=$(AWS_REGION)

# Sync GitHub Actions Secrets from .env files and OIDC Role ARN
setup-github-secrets:
	AWS_REGION=$(AWS_REGION) bash scripts/setup_github_secrets.sh

# 1. First-time AWS SAM interactive setup (creates backend/samconfig.toml)
deploy-init:
	cd backend && $(MAKE) deploy-guided STACK_NAME=$(STACK_NAME) AWS_REGION=$(AWS_REGION)

# 2. Deploy Backend & Infrastructure (Lambda, API Gateway, S3, CloudFront)
deploy-be:
	cd backend && $(MAKE) deploy STACK_NAME=$(STACK_NAME) AWS_REGION=$(AWS_REGION)

# 3. Build & Deploy Frontend to S3 + Invalidate CloudFront
deploy-fe:
	@echo "Fetching CloudFormation outputs from $(STACK_NAME)..."
	@OVERRIDE_API_URL="$${REACT_APP_API_URL:-}"; \
	if [ -f frontend/.env ]; then \
		set -a; . ./frontend/.env; set +a; \
	fi; \
	S3_BUCKET=$${S3_BUCKET:-$$(aws cloudformation describe-stacks --stack-name $(STACK_NAME) --region $(AWS_REGION) --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)}; \
	CF_DIST_ID=$${CF_DIST_ID:-$$(aws cloudformation describe-stacks --stack-name $(STACK_NAME) --region $(AWS_REGION) --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text)}; \
	CF_API_URL=$$(aws cloudformation describe-stacks --stack-name $(STACK_NAME) --region $(AWS_REGION) --query "Stacks[0].Outputs[?OutputKey=='EventerMapApi'].OutputValue" --output text); \
	API_URL="$${OVERRIDE_API_URL:-$$CF_API_URL}"; \
	if [ -z "$$S3_BUCKET" ] || [ "$$S3_BUCKET" = "None" ]; then \
		echo "Error: Could not resolve FrontendBucketName. Run 'make deploy-be' first."; exit 1; \
	fi; \
	if [ -z "$$API_URL" ] || [ "$$API_URL" = "None" ]; then \
		echo "Error: Could not resolve EventerMapApi URL. Run 'make deploy-be' first."; exit 1; \
	fi; \
	echo "Building Frontend with REACT_APP_API_URL=$$API_URL ..."; \
	cd frontend && REACT_APP_API_URL="$$API_URL" npm run build; \
	echo "Syncing hashed static assets to s3://$$S3_BUCKET ..."; \
	aws s3 sync build/ "s3://$$S3_BUCKET" --region $(AWS_REGION) --delete \
		--exclude "index.html" --exclude "asset-manifest.json" \
		--cache-control "public, max-age=31536000, immutable"; \
	echo "Uploading index.html (no-cache)..."; \
	aws s3 cp build/index.html "s3://$$S3_BUCKET/index.html" --region $(AWS_REGION) \
		--cache-control "no-cache, no-store, must-revalidate"; \
	if [ -f build/asset-manifest.json ]; then \
		aws s3 cp build/asset-manifest.json "s3://$$S3_BUCKET/asset-manifest.json" --region $(AWS_REGION) \
			--cache-control "no-cache, no-store, must-revalidate"; \
	fi; \
	echo "Invalidating CloudFront cache ($$CF_DIST_ID)..."; \
	aws cloudfront create-invalidation --distribution-id "$$CF_DIST_ID" --paths "/index.html" "/"

# Deploy both Backend and Frontend sequentially
deploy-all: deploy-be deploy-fe

# Print current deployed URLs and resource IDs
stack-outputs:
	@aws cloudformation describe-stacks --stack-name $(STACK_NAME) --region $(AWS_REGION) \
		--query "Stacks[0].Outputs[*].[OutputKey,OutputValue]" --output table
