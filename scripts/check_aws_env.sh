#!/usr/bin/env bash
set -u

export PATH="$HOME/.local/bin:/usr/local/bin:/snap/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"
FRONTEND_ENV="$ROOT_DIR/frontend/.env"

ERRORS=0
WARNINGS=0

ok()   { printf "  [OK]   %s\n" "$1"; }
warn() { printf "  [WARN] %s\n" "$1"; WARNINGS=$((WARNINGS + 1)); }
fail() { printf "  [FAIL] %s\n" "$1"; ERRORS=$((ERRORS + 1)); }

# Read a KEY=VALUE from a dotenv file safely without executing arbitrary shell code.
read_dotenv_var() {
  local file="$1"
  local key="$2"
  local line
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" 2>/dev/null | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 0
  fi
  local val="${line#*=}"
  # Trim leading/trailing whitespace
  val="${val#"${val%%[![:space:]]*}"}"
  val="${val%"${val##*[![:space:]]}"}"
  # Strip surrounding matching single or double quotes
  if [[ "$val" =~ ^\"(.*)\"$ ]]; then
    val="${BASH_REMATCH[1]}"
  elif [[ "$val" =~ ^\'(.*)\'$ ]]; then
    val="${BASH_REMATCH[1]}"
  fi
  printf "%s" "$val"
}

echo "=========================================="
echo " Eventer Map AWS Deployment Pre-flight"
echo "=========================================="

echo ""
echo "1. CLI Tools & AWS Credentials"
if command -v go >/dev/null 2>&1; then
  ok "Go installed ($(go version | awk '{print $3}'))"
else
  fail "Go compiler not found (required for Lambda build)"
fi

if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  ok "Node.js & npm installed ($(node --version), npm $(npm --version))"
else
  fail "Node.js or npm not found (required for frontend build)"
fi

if command -v sam >/dev/null 2>&1; then
  ok "AWS SAM CLI installed ($(sam --version))"
else
  warn "AWS SAM CLI not installed (Makefile will fallback to 'aws cloudformation')"
fi

if command -v aws >/dev/null 2>&1; then
  ok "AWS CLI installed ($(aws --version 2>&1 | head -n 1))"
  if CALLER_ID="$(aws sts get-caller-identity --output json 2>/dev/null)"; then
    ACCOUNT_ID="$(printf "%s" "$CALLER_ID" | grep -oE '"Account":[[:space:]]*"[^"]+"' | cut -d'"' -f4 || true)"
    ARN="$(printf "%s" "$CALLER_ID" | grep -oE '"Arn":[[:space:]]*"[^"]+"' | cut -d'"' -f4 || true)"
    ok "AWS credentials valid (Account: ${ACCOUNT_ID:-unknown}, Identity: ${ARN:-unknown})"

    TARGET_REGION="${AWS_REGION:-ap-southeast-2}"
    if CFN_OUT="$(aws cloudformation list-stacks --region "$TARGET_REGION" --max-items 1 2>&1)"; then
      ok "Target AWS region '$TARGET_REGION' is accessible"
    elif printf "%s" "$CFN_OUT" | grep -qi "service control policy"; then
      SCP_ARN="$(printf "%s" "$CFN_OUT" | grep -oE 'arn:aws:organizations::[^ ]+' | head -n 1 || true)"
      fail "Target region '$TARGET_REGION' is blocked by AWS Organizations SCP (${SCP_ARN:-unknown}). Allow '$TARGET_REGION' in the management account SCP."
    else
      warn "Could not verify CloudFormation access in '$TARGET_REGION': $(printf "%s" "$CFN_OUT" | tr '\n' ' ')"
    fi
  else
    fail "AWS credentials not configured or expired (run 'aws configure' or 'aws sso login')"
  fi
else
  fail "AWS CLI not found (run 'make install-aws-cli' to install into ~/.local/bin)"
fi

echo ""
echo "2. Backend Configuration ($BACKEND_ENV)"
if [[ ! -f "$BACKEND_ENV" ]]; then
  fail "backend/.env file not found (copy from backend/.env.example)"
else
  ok "backend/.env exists"

  PROD_DB="$(read_dotenv_var "$BACKEND_ENV" "PROD_DATABASE_URL")"
  LOCAL_DB="$(read_dotenv_var "$BACKEND_ENV" "DATABASE_URL")"
  DEPLOY_DB="${PROD_DB:-$LOCAL_DB}"

  if [[ -z "$DEPLOY_DB" ]]; then
    fail "PROD_DATABASE_URL (or DATABASE_URL) is not set in backend/.env"
  else
    # Extract host from URL without printing credentials
    DB_HOST="$(printf "%s" "$DEPLOY_DB" | sed -E 's#^[^:]+://([^@]+@)?([^:/?]+).*#\2#')"
    if printf "%s" "$DEPLOY_DB" | grep -qE '(@|//)(localhost|127\.0\.0\.1|192\.168\.[0-9.]+|10\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9.]+)(:|/)'; then
      fail "Deployment DB host '$DB_HOST' is a local/private IP; AWS Lambda cannot reach it. Set PROD_DATABASE_URL to a public host (e.g., DDNS/RDS/Neon)."
    else
      ok "Deployment DB configured (host: $DB_HOST)"
    fi
  fi

  JWT_SEC="$(read_dotenv_var "$BACKEND_ENV" "JWT_SECRET")"
  if [[ -z "$JWT_SEC" ]]; then
    fail "JWT_SECRET is not set in backend/.env (required by Go backend)"
  elif [[ "$JWT_SEC" == *"change-in-production"* || "$JWT_SEC" == *"your-secret"* || ${#JWT_SEC} -lt 16 ]]; then
    warn "JWT_SECRET looks short or placeholder-like (recommend >= 32 random characters)"
  else
    ok "JWT_SECRET configured (length: ${#JWT_SEC})"
  fi

  COOKIE_SS="$(read_dotenv_var "$BACKEND_ENV" "COOKIE_SAMESITE")"
  if [[ -n "$COOKIE_SS" ]]; then
    ok "COOKIE_SAMESITE=${COOKIE_SS}"
  else
    warn "COOKIE_SAMESITE not set in backend/.env (deploy defaults to 'None')"
  fi

  SMTP_HOST="$(read_dotenv_var "$BACKEND_ENV" "SMTP_HOST")"
  SMTP_USER="$(read_dotenv_var "$BACKEND_ENV" "SMTP_USER")"
  SMTP_PASS="$(read_dotenv_var "$BACKEND_ENV" "SMTP_PASSWORD")"
  if [[ -n "$SMTP_HOST" ]]; then
    if [[ -n "$SMTP_USER" && -n "$SMTP_PASS" ]]; then
      ok "SMTP email configured (host: $SMTP_HOST)"
    else
      warn "SMTP_HOST is set ($SMTP_HOST) but SMTP_USER or SMTP_PASSWORD is missing"
    fi
  else
    warn "SMTP_HOST is empty — verification codes will only be logged via MockMailer (CloudWatch Logs)"
  fi

  X_ID="$(read_dotenv_var "$BACKEND_ENV" "X_CLIENT_ID")"
  X_SEC="$(read_dotenv_var "$BACKEND_ENV" "X_CLIENT_SECRET")"
  if [[ -n "$X_ID" && -n "$X_SEC" ]]; then
    ok "X (Twitter) OAuth credentials configured"
  elif [[ -n "$X_ID" || -n "$X_SEC" ]]; then
    warn "X OAuth partially configured (both X_CLIENT_ID and X_CLIENT_SECRET are required)"
  else
    warn "X (Twitter) OAuth not configured (X login button will return 503 until set)"
  fi
fi

echo ""
echo "3. Frontend Configuration ($FRONTEND_ENV)"
if [[ ! -f "$FRONTEND_ENV" ]]; then
  fail "frontend/.env file not found (copy from frontend/.env.example)"
else
  ok "frontend/.env exists"

  MAPS_KEY="$(read_dotenv_var "$FRONTEND_ENV" "REACT_APP_GOOGLE_MAPS_API_KEY")"
  if [[ -z "$MAPS_KEY" || "$MAPS_KEY" == *"YOUR_GOOGLE_MAPS_API_KEY"* ]]; then
    fail "REACT_APP_GOOGLE_MAPS_API_KEY is missing or placeholder in frontend/.env"
  else
    ok "REACT_APP_GOOGLE_MAPS_API_KEY configured"
  fi

  GOOGLE_CID="$(read_dotenv_var "$FRONTEND_ENV" "REACT_APP_GOOGLE_CLIENT_ID")"
  if [[ -z "$GOOGLE_CID" || "$GOOGLE_CID" == *"YOUR_GOOGLE_CLIENT_ID"* ]]; then
    fail "REACT_APP_GOOGLE_CLIENT_ID is missing or placeholder in frontend/.env"
  else
    ok "REACT_APP_GOOGLE_CLIENT_ID configured"
  fi
fi

echo ""
echo "=========================================="
printf " Summary: %d error(s), %d warning(s)\n" "$ERRORS" "$WARNINGS"
echo "=========================================="

if [[ "$ERRORS" -gt 0 ]]; then
  exit 1
fi
