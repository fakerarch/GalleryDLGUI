#!/usr/bin/env bash
# ============================================================
# setup.sh — First-time setup for gallery-dl GUI (Linux)
#
# What this does:
#   1. Checks for Node.js >= 18 — installs via nvm if missing
#   2. Runs npm install
#   3. Launches the app
#
# No root / sudo required.
# Safe to re-run — skips steps that are already done.
# ============================================================
set -euo pipefail

NVM_VERSION="v0.39.7"
NODE_VERSION="lts/*"   # always installs the current LTS

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

info()    { echo -e "${BOLD}[*]${RESET} $*"; }
success() { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
die()     { echo -e "${RED}[✗]${RESET} $*"; exit 1; }

echo ""
echo -e "${BOLD}══════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  gallery-dl GUI — setup${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════${RESET}"
echo ""

# ── 1. Check / install Node.js ────────────────────────────────

node_ok() {
  command -v node >/dev/null 2>&1 || return 1
  local ver
  ver=$(node --version | cut -c2- | cut -d. -f1)
  [ "$ver" -ge 18 ]
}

if node_ok; then
  success "Node.js $(node --version) already installed — skipping"
else
  warn "Node.js >= 18 not found. Installing via nvm (no sudo needed)..."
  echo ""

  # Install nvm if not already present
  NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -f "$NVM_DIR/nvm.sh" ]; then
    info "Downloading nvm ${NVM_VERSION}..."
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
  else
    success "nvm already installed at $NVM_DIR"
  fi

  # Load nvm into this shell session
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"

  info "Installing Node.js LTS..."
  nvm install "$NODE_VERSION"
  nvm use "$NODE_VERSION"

  success "Node.js $(node --version) installed"
  echo ""

  # Remind user to add nvm to their shell profile for future sessions
  warn "nvm was added to your shell profile (~/.bashrc / ~/.zshrc)."
  warn "To use 'node' in future terminal sessions, run:  source ~/.bashrc"
  echo ""
fi

# ── 2. npm install ────────────────────────────────────────────

info "Installing npm dependencies..."
npm install
success "Dependencies ready"
echo ""

# ── 3. Launch the app ─────────────────────────────────────────

info "Launching gallery-dl GUI..."
echo ""
npm start
