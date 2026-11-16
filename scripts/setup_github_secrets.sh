#!/usr/bin/env bash
set -u

export PATH="$HOME/go/bin:$HOME/.local/bin:/usr/local/bin:/snap/bin:$PATH:/home/parkkh/go/bin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"
FRONTEND_ENV="$ROOT_DIR/frontend/.env"

AWS_REGION="${AWS_REGION:-ap-southeast-2}"
OIDC_STACK_NAME="${OIDC_STACK_NAME:-eventer-map-github-oidc}"
GITHUB_REPO_SLUG="${GITHUB_REPO_SLUG:-koanghun/eventer-map}"
CHECK_ONLY=false

if [[ "${1:-}" == "--check" || "${1:-}" == "--dry-run" ]]; then
  CHECK_ONLY=true
fi

# Read a KEY=VALUE from a dotenv file safely without executing arbitrary shell code.
read_dotenv_var() {
  local file="$1"
  local key="$2"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  local line
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" 2>/dev/null | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 0
  fi
  local val="${line#*=}"
  val="${val#"${val%%[![:space:]]*}"}"
  val="${val%"${val##*[![:space:]]}"}"
  if [[ "$val" =~ ^\"(.*)\"$ ]]; then
    val="${BASH_REMATCH[1]}"
  elif [[ "$val" =~ ^\'(.*)\'$ ]]; then
    val="${BASH_REMATCH[1]}"
  fi
  printf "%s" "$val"
}

is_private_or_local_db() {
  local url="$1"
  printf "%s" "$url" | grep -qE '(@|//)(localhost|127\.0\.0\.1|192\.168\.[0-9.]+|10\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9.]+)(:|/)'
}

echo "=========================================="
echo " Eventer Map GitHub Secrets Setup"
echo " Target Repo: $GITHUB_REPO_SLUG"
echo "=========================================="
echo ""

# 1. Resolve AWS_ROLE_ARN from environment or CloudFormation OIDC stack
RESOLVED_ROLE_ARN="${AWS_ROLE_ARN:-}"
if [[ -z "$RESOLVED_ROLE_ARN" ]] && command -v aws >/dev/null 2>&1; then
  if aws sts get-caller-identity >/dev/null 2>&1; then
    RESOLVED_ROLE_ARN="$(aws cloudformation describe-stacks \
      --stack-name "$OIDC_STACK_NAME" \
      --region "$AWS_REGION" \
      --query "Stacks[0].Outputs[?OutputKey=='GitHubActionsRoleArn'].OutputValue | [0]" \
      --output text 2>/dev/null || true)"
    if [[ "$RESOLVED_ROLE_ARN" == "None" ]]; then
      RESOLVED_ROLE_ARN=""
    fi
  fi
fi

# 2. Load values from backend/.env & frontend/.env (never echo raw secret values)
PROD_DB_URL="$(read_dotenv_var "$BACKEND_ENV" "PROD_DATABASE_URL")"
LOCAL_DB_URL="$(read_dotenv_var "$BACKEND_ENV" "DATABASE_URL")"
EFFECTIVE_DB_URL=""
if [[ -n "$PROD_DB_URL" ]] && ! is_private_or_local_db "$PROD_DB_URL"; then
  EFFECTIVE_DB_URL="$PROD_DB_URL"
elif [[ -n "$LOCAL_DB_URL" ]] && ! is_private_or_local_db "$LOCAL_DB_URL"; then
  EFFECTIVE_DB_URL="$LOCAL_DB_URL"
fi

JWT_SECRET_VAL="$(read_dotenv_var "$BACKEND_ENV" "JWT_SECRET")"
CORS_ORIGINS_VAL="$(read_dotenv_var "$BACKEND_ENV" "CORS_ORIGINS")"
COOKIE_DOMAIN_VAL="$(read_dotenv_var "$BACKEND_ENV" "COOKIE_DOMAIN")"
COOKIE_SAMESITE_VAL="$(read_dotenv_var "$BACKEND_ENV" "COOKIE_SAMESITE")"
X_CLIENT_ID_VAL="$(read_dotenv_var "$BACKEND_ENV" "X_CLIENT_ID")"
X_CLIENT_SECRET_VAL="$(read_dotenv_var "$BACKEND_ENV" "X_CLIENT_SECRET")"
X_REDIRECT_URI_VAL="$(read_dotenv_var "$BACKEND_ENV" "X_REDIRECT_URI")"
X_REQUEST_EMAIL_VAL="$(read_dotenv_var "$BACKEND_ENV" "X_REQUEST_EMAIL")"
SMTP_HOST_VAL="$(read_dotenv_var "$BACKEND_ENV" "SMTP_HOST")"
SMTP_PORT_VAL="$(read_dotenv_var "$BACKEND_ENV" "SMTP_PORT")"
SMTP_USER_VAL="$(read_dotenv_var "$BACKEND_ENV" "SMTP_USER")"
SMTP_PASSWORD_VAL="$(read_dotenv_var "$BACKEND_ENV" "SMTP_PASSWORD")"
SMTP_FROM_VAL="$(read_dotenv_var "$BACKEND_ENV" "SMTP_FROM")"

GOOGLE_MAPS_KEY_VAL="$(read_dotenv_var "$FRONTEND_ENV" "REACT_APP_GOOGLE_MAPS_API_KEY")"
GOOGLE_CLIENT_ID_VAL="$(read_dotenv_var "$FRONTEND_ENV" "REACT_APP_GOOGLE_CLIENT_ID")"

if [[ "$GOOGLE_MAPS_KEY_VAL" == *"YOUR_GOOGLE_MAPS_API_KEY"* ]]; then
  GOOGLE_MAPS_KEY_VAL=""
fi
if [[ "$GOOGLE_CLIENT_ID_VAL" == *"YOUR_GOOGLE_CLIENT_ID"* ]]; then
  GOOGLE_CLIENT_ID_VAL=""
fi

declare -a REQUIRED_KEYS=(
  "AWS_ROLE_ARN"
  "DATABASE_URL"
  "JWT_SECRET"
  "REACT_APP_GOOGLE_MAPS_API_KEY"
  "REACT_APP_GOOGLE_CLIENT_ID"
)

declare -a OPTIONAL_KEYS=(
  "PROD_DATABASE_URL"
  "CORS_ORIGINS"
  "COOKIE_DOMAIN"
  "COOKIE_SAMESITE"
  "X_CLIENT_ID"
  "X_CLIENT_SECRET"
  "X_REDIRECT_URI"
  "X_REQUEST_EMAIL"
  "SMTP_HOST"
  "SMTP_PORT"
  "SMTP_USER"
  "SMTP_PASSWORD"
  "SMTP_FROM"
)

get_secret_value() {
  case "$1" in
    AWS_ROLE_ARN) printf "%s" "$RESOLVED_ROLE_ARN" ;;
    DATABASE_URL) printf "%s" "$EFFECTIVE_DB_URL" ;;
    PROD_DATABASE_URL)
      if [[ -n "$PROD_DB_URL" ]] && ! is_private_or_local_db "$PROD_DB_URL"; then
        printf "%s" "$PROD_DB_URL"
      fi
      ;;
    JWT_SECRET) printf "%s" "$JWT_SECRET_VAL" ;;
    CORS_ORIGINS) printf "%s" "$CORS_ORIGINS_VAL" ;;
    COOKIE_DOMAIN) printf "%s" "$COOKIE_DOMAIN_VAL" ;;
    COOKIE_SAMESITE) printf "%s" "$COOKIE_SAMESITE_VAL" ;;
    X_CLIENT_ID) printf "%s" "$X_CLIENT_ID_VAL" ;;
    X_CLIENT_SECRET) printf "%s" "$X_CLIENT_SECRET_VAL" ;;
    X_REDIRECT_URI) printf "%s" "$X_REDIRECT_URI_VAL" ;;
    X_REQUEST_EMAIL) printf "%s" "$X_REQUEST_EMAIL_VAL" ;;
    SMTP_HOST) printf "%s" "$SMTP_HOST_VAL" ;;
    SMTP_PORT) printf "%s" "$SMTP_PORT_VAL" ;;
    SMTP_USER) printf "%s" "$SMTP_USER_VAL" ;;
    SMTP_PASSWORD) printf "%s" "$SMTP_PASSWORD_VAL" ;;
    SMTP_FROM) printf "%s" "$SMTP_FROM_VAL" ;;
    REACT_APP_GOOGLE_MAPS_API_KEY) printf "%s" "$GOOGLE_MAPS_KEY_VAL" ;;
    REACT_APP_GOOGLE_CLIENT_ID) printf "%s" "$GOOGLE_CLIENT_ID_VAL" ;;
  esac
}

MISSING_REQUIRED=0

echo "1. Secret Readiness Checklist"
for key in "${REQUIRED_KEYS[@]}"; do
  val="$(get_secret_value "$key")"
  if [[ -n "$val" ]]; then
    printf "  [READY]   %-30s (required, length: %d)\n" "$key" "${#val}"
  else
    printf "  [MISSING] %-30s (required)\n" "$key"
    MISSING_REQUIRED=$((MISSING_REQUIRED + 1))
  fi
done

for key in "${OPTIONAL_KEYS[@]}"; do
  val="$(get_secret_value "$key")"
  if [[ -n "$val" ]]; then
    printf "  [READY]   %-30s (optional, length: %d)\n" "$key" "${#val}"
  else
    printf "  [SKIP]    %-30s (optional, unset)\n" "$key"
  fi
done

echo ""
echo "2. GitHub CLI & Sync Status"
GH_READY=false
if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    GH_READY=true
    echo "  [OK]   GitHub CLI installed and authenticated"
  else
    echo "  [WARN] GitHub CLI installed, but not authenticated (run: gh auth login)"
  fi
else
  echo "  [WARN] GitHub CLI (gh) is not installed (https://cli.github.com/)"
fi

if [[ "$CHECK_ONLY" == "true" ]]; then
  echo ""
  echo "Check-only mode enabled; no secrets were modified."
  exit 0
fi

if [[ "$GH_READY" == "false" ]]; then
  echo ""
  echo "Next Steps to Sync Secrets to GitHub ($GITHUB_REPO_SLUG):"
  if [[ -z "$RESOLVED_ROLE_ARN" ]]; then
    echo "  1. Configure AWS CLI credentials:       aws configure"
    echo "  2. Provision GitHub OIDC IAM Role:      make setup-oidc"
  fi
  echo "  3. Install & authenticate GitHub CLI:   gh auth login"
  echo "  4. Sync secrets to GitHub Actions:      make setup-github-secrets"
  exit 1
fi

SYNC_FAILURES=0
SYNCED_COUNT=0
for key in "${REQUIRED_KEYS[@]}" "${OPTIONAL_KEYS[@]}"; do
  val="$(get_secret_value "$key")"
  if [[ -z "$val" ]]; then
    continue
  fi
  if printf "%s" "$val" | gh secret set "$key" --repo "$GITHUB_REPO_SLUG" >/dev/null 2>&1; then
    printf "  [SYNCED]  %s\n" "$key"
    SYNCED_COUNT=$((SYNCED_COUNT + 1))
  else
    printf "  [FAILED]  %s\n" "$key"
    SYNC_FAILURES=$((SYNC_FAILURES + 1))
  fi
done

echo ""
echo "=========================================="
printf " Synced: %d secret(s), Missing required: %d, Failures: %d\n" "$SYNCED_COUNT" "$MISSING_REQUIRED" "$SYNC_FAILURES"
echo "=========================================="

if [[ "$MISSING_REQUIRED" -gt 0 || "$SYNC_FAILURES" -gt 0 ]]; then
  exit 1
fi
