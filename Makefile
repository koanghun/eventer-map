.PHONY: generate deploy-init deploy-be deploy-fe deploy-all stack-outputs

STACK_NAME ?= eventer-map-stack
AWS_REGION ?= ap-northeast-1

# Generate both Backend (oapi-codegen + sqlc) and Frontend (Orval) code
generate:
	cd backend && $(MAKE) generate
	cd frontend && npm run generate:api

# 1. First-time AWS SAM interactive setup (creates backend/samconfig.toml)
deploy-init:
	cd backend && $(MAKE) deploy-guided STACK_NAME=$(STACK_NAME) AWS_REGION=$(AWS_REGION)

# 2. Deploy Backend & Infrastructure (Lambda, API Gateway, S3, CloudFront)
deploy-be:
	cd backend && $(MAKE) deploy STACK_NAME=$(STACK_NAME) AWS_REGION=$(AWS_REGION)

# 3. Build & Deploy Frontend to S3 + Invalidate CloudFront
deploy-fe:
	@echo "Fetching CloudFormation outputs from $(STACK_NAME)..."
	@S3_BUCKET=$${S3_BUCKET:-$$(aws cloudformation describe-stacks --stack-name $(STACK_NAME) --region $(AWS_REGION) --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)}; \
	CF_DIST_ID=$${CF_DIST_ID:-$$(aws cloudformation describe-stacks --stack-name $(STACK_NAME) --region $(AWS_REGION) --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text)}; \
	API_URL=$${REACT_APP_API_URL:-$$(aws cloudformation describe-stacks --stack-name $(STACK_NAME) --region $(AWS_REGION) --query "Stacks[0].Outputs[?OutputKey=='EventerMapApi'].OutputValue" --output text)}; \
	if [ -z "$$S3_BUCKET" ] || [ "$$S3_BUCKET" = "None" ]; then \
		echo "Error: Could not resolve FrontendBucketName. Run 'make deploy-be' first."; exit 1; \
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
