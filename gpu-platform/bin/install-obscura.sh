#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# G P Unite — Obscura Installer
# Downloads the latest obscura headless browser binary
# Source: https://github.com/h4ckf0r0day/obscura
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

BIN_DIR="$(cd "$(dirname "$0")" && pwd)"
OBScura_BIN="${BIN_DIR}/obscura"
VERSION="${1:-latest}"

# Detect OS and architecture
detect_platform() {
  local os arch
  case "$(uname -s)" in
    Linux*)   os="linux" ;;
    Darwin*)  os="macos" ;;
    MINGW*|MSYS*|CYGWIN*)  os="windows" ;;
    *)        echo "❌ Unsupported OS: $(uname -s)" && exit 1 ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64)   arch="x86_64" ;;
    aarch64|arm64)  arch="aarch64" ;;
    *)              echo "❌ Unsupported arch: $(uname -m)" && exit 1 ;;
  esac

  echo "${arch}-${os}"
}

# Download obscura binary
download_obscura() {
  local platform
  platform=$(detect_platform)
  local ext="tar.gz"
  local url

  if [[ "$platform" == *"windows"* ]]; then
    ext="zip"
    url="https://github.com/h4ckf0r0day/obscura/releases/${VERSION}/download/obscura-${platform}.${ext}"
  else
    url="https://github.com/h4ckf0r0day/obscura/releases/${VERSION}/download/obscura-${platform}.${ext}"
  fi

  echo "📥 Downloading obscura for ${platform}..."
  echo "   URL: ${url}"

  local tmp_file="${BIN_DIR}/obscura-download.${ext}"
  curl -L -o "$tmp_file" "$url"

  echo "📦 Extracting..."
  if [[ "$ext" == "zip" ]]; then
    unzip -o "$tmp_file" -d "$BIN_DIR"
  else
    tar xzf "$tmp_file" -C "$BIN_DIR"
  fi

  rm -f "$tmp_file"

  # Make executable
  chmod +x "${BIN_DIR}/obscura" 2>/dev/null || true
  chmod +x "${BIN_DIR}/obscura-worker" 2>/dev/null || true

  echo "✅ Obscura installed to: ${BIN_DIR}/obscura"
  "${BIN_DIR}/obscura" --version 2>/dev/null || echo "✅ Binary ready (run with --version to verify)"
}

# Main
if [[ -f "$OBScura_BIN" ]]; then
  echo "ℹ️  Obscura already installed at ${OBScura_BIN}"
  echo "   Use: ${OBScura_BIN} --version"
  echo "   Re-install with: $0 force"
  if [[ "${1:-}" == "force" ]]; then
    download_obscura
  fi
else
  download_obscura
fi
