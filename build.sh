#!/usr/bin/env bash
# ============================================================
# build.sh — Build gallery-dl GUI  (Linux AppImage)
# Run this on a Linux machine (Ubuntu 20.04+ recommended).
# Produces:  dist/gallery-dl-GUI-<version>-linux-x64.AppImage
# ============================================================
set -euo pipefail

echo ""
echo "══════════════════════════════════════════════"
echo "  gallery-dl GUI  — Linux AppImage builder"
echo "══════════════════════════════════════════════"
echo ""

# ── 1. Prerequisites ──────────────────────────────────────────
command -v node >/dev/null 2>&1 || { echo "❌  Node.js not found. Install from https://nodejs.org"; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "❌  npm not found. Install from https://nodejs.org"; exit 1; }

NODE_VER=$(node --version | cut -c2- | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌  Node.js >= 18 required (found $NODE_VER). Upgrade from https://nodejs.org"
  exit 1
fi

echo "✓  Node.js $(node --version)   npm $(npm --version)"
echo ""

# ── 2. Install npm dependencies ───────────────────────────────
echo "📦  Installing dependencies..."
npm install
echo ""

# ── 3. Build AppImage ─────────────────────────────────────────
echo "🔨  Building Linux AppImage..."
npx electron-builder --linux AppImage --x64

echo ""
echo "✅  Build complete!  Output in ./dist/"
ls -lh dist/*.AppImage 2>/dev/null || true

# ── 4. Make the AppImage executable ───────────────────────────
chmod +x dist/*.AppImage 2>/dev/null || true

echo ""
echo "To run:  ./dist/gallery-dl-GUI-*.AppImage"
echo ""
