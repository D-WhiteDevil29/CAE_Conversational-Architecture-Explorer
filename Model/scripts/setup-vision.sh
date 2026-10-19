#!/usr/bin/env bash
# setup-vision.sh
# Downloads pre-built llama.cpp vision binaries for macOS arm64 (Apple Silicon).
# No cmake, no brew required — uses curl which is built into macOS.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/../llama.cpp/build/bin"
RELEASE="b8508"
TARBALL_URL="https://github.com/ggml-org/llama.cpp/releases/download/${RELEASE}/llama-${RELEASE}-bin-macos-arm64.tar.gz"
TARBALL="/tmp/llama-macos-arm64.tar.gz"

echo "==> CAE Vision Setup"
echo "    Target: $TARGET_DIR"

mkdir -p "$TARGET_DIR"

# --- check if already present ---
if [[ -f "$TARGET_DIR/llama-qwen2vl-cli" ]] || [[ -f "$TARGET_DIR/llama-llava-cli" ]]; then
  echo "==> Vision binary already present in $TARGET_DIR"
  ls "$TARGET_DIR" | grep -E "llama-(cli|llava|qwen)"
  exit 0
fi

# --- check if tarball cached ---
if [[ ! -f "$TARBALL" ]]; then
  echo "==> Downloading llama-${RELEASE}-bin-macos-arm64.tar.gz (~38 MB)..."
  curl -L --progress-bar "$TARBALL_URL" -o "$TARBALL"
else
  echo "==> Using cached tarball: $TARBALL"
fi

echo "==> Extracting binaries and libraries..."
tar xf "$TARBALL" -C "$TARGET_DIR" --strip-components=1

chmod +x "$TARGET_DIR"/llama-* 2>/dev/null || true

echo ""
echo "==> Done. Vision binaries installed:"
ls "$TARGET_DIR" | grep -E "llama-(cli|llava|qwen)"
echo ""
echo "The /api/upload-architecture-image and /api/analyze-image endpoints are now ready."

