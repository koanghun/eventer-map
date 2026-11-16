#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"

INSTALL_DIR="$HOME/.local/aws-cli"
BIN_DIR="$HOME/.local/bin"
FORCE_UPDATE=false

if [[ "${1:-}" == "--update" || "${1:-}" == "--force" ]]; then
  FORCE_UPDATE=true
fi

if command -v aws >/dev/null 2>&1 && [[ "$FORCE_UPDATE" == "false" ]]; then
  echo "AWS CLI is already installed: $(aws --version)"
  echo "Location: $(command -v aws)"
  echo "Run with --update to reinstall/upgrade in $INSTALL_DIR."
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: 'curl' is required to install AWS CLI v2." >&2
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
  echo "Error: 'unzip' or 'python3' is required to extract AWS CLI v2." >&2
  exit 1
fi

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64)
    PKG_ARCH="x86_64"
    ;;
  aarch64|arm64)
    PKG_ARCH="aarch64"
    ;;
  *)
    echo "Error: Unsupported architecture '$ARCH'. Supported: x86_64, aarch64." >&2
    exit 1
    ;;
esac

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

ZIP_URL="https://awscli.amazonaws.com/awscli-exe-linux-${PKG_ARCH}.zip"
echo "Downloading AWS CLI v2 ($PKG_ARCH) from $ZIP_URL ..."
curl -fsSL "$ZIP_URL" -o "$TMP_DIR/awscliv2.zip"

echo "Extracting archive..."
if command -v unzip >/dev/null 2>&1; then
  unzip -q "$TMP_DIR/awscliv2.zip" -d "$TMP_DIR"
else
  python3 - "$TMP_DIR/awscliv2.zip" "$TMP_DIR" <<'PYEOF'
import os, sys, zipfile
zip_path, out_dir = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zip_path, 'r') as zf:
    for info in zf.infolist():
        target = zf.extract(info, out_dir)
        mode = (info.external_attr >> 16) & 0o777
        if mode:
            os.chmod(target, mode)
PYEOF
fi

mkdir -p "$BIN_DIR"
echo "Installing AWS CLI v2 to $INSTALL_DIR (symlinks in $BIN_DIR)..."
"$TMP_DIR/aws/install" -i "$INSTALL_DIR" -b "$BIN_DIR" --update

echo "Installation complete: $("$BIN_DIR/aws" --version)"
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo "Note: Add '$BIN_DIR' to your shell PATH (e.g., ~/.bashrc) if not already present."
fi
