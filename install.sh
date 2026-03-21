#!/usr/bin/env bash
set -euo pipefail

# ClaudeConduit installer
# Usage: curl -fsSL https://raw.githubusercontent.com/johnwhoyou/claude-conduit/main/install.sh | bash

INSTALL_DIR="$HOME/.claude-conduit"
REPO_URL="https://github.com/johnwhoyou/claude-conduit.git"

# Colors (with fallback for non-color terminals)
if [ -t 1 ] && command -v tput &>/dev/null && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  GREEN=$(tput setaf 2)
  RED=$(tput setaf 1)
  YELLOW=$(tput setaf 3)
  BOLD=$(tput bold)
  RESET=$(tput sgr0)
else
  GREEN="" RED="" YELLOW="" BOLD="" RESET=""
fi

ok()   { echo "${GREEN}[ok]${RESET} $1"; }
fail() { echo "${RED}[x]${RESET} $1"; }
warn() { echo "${YELLOW}[!!]${RESET} $1"; }

echo
echo "${BOLD}========================================${RESET}"
echo "${BOLD}  ClaudeConduit Installer${RESET}"
echo "${BOLD}========================================${RESET}"
echo
echo "Control Claude Code from your phone via Discord."
echo "Install directory: ${BOLD}${INSTALL_DIR}${RESET}"
echo

# -------------------------------------------------------------------
# Prerequisites
# -------------------------------------------------------------------
echo "${BOLD}Checking prerequisites...${RESET}"
echo

HAS_ERRORS=false

# Git
if command -v git &>/dev/null; then
  ok "git $(git --version | head -1 | awk '{print $3}')"
else
  fail "git is not installed"
  HAS_ERRORS=true
fi

# Node.js 18+
if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version | sed 's/^v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 18 ]; then
    ok "Node.js v${NODE_VERSION}"
  else
    fail "Node.js v${NODE_VERSION} (v18+ required)"
    HAS_ERRORS=true
  fi
else
  fail "Node.js is not installed (v18+ required)"
  HAS_ERRORS=true
fi

# npm
if command -v npm &>/dev/null; then
  ok "npm $(npm --version)"
else
  fail "npm is not installed"
  HAS_ERRORS=true
fi

# Claude Code CLI (warn only)
if command -v claude &>/dev/null; then
  ok "Claude Code CLI found"
else
  warn "Claude Code CLI not found (install it from https://docs.anthropic.com/en/docs/claude-code)"
  echo "    You'll need it before running the bot."
fi

echo

if [ "$HAS_ERRORS" = true ]; then
  echo "${RED}Please install the missing prerequisites and try again.${RESET}"
  exit 1
fi

# -------------------------------------------------------------------
# Clone or update
# -------------------------------------------------------------------
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "${BOLD}Updating existing installation...${RESET}"
  cd "$INSTALL_DIR"
  git pull --ff-only
  echo
else
  echo "${BOLD}Cloning ClaudeConduit...${RESET}"
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
  echo
fi

# -------------------------------------------------------------------
# Install dependencies
# -------------------------------------------------------------------
echo "${BOLD}Installing dependencies...${RESET}"
npm install
echo

# -------------------------------------------------------------------
# Run setup wizard
# -------------------------------------------------------------------
echo "${BOLD}Starting configuration wizard...${RESET}"
echo
CLAUDE_CONDUIT_INSTALLER=1 npx tsx src/setup.ts

# -------------------------------------------------------------------
# Build
# -------------------------------------------------------------------
echo "${BOLD}Building for production...${RESET}"
npm run build
echo
ok "Build complete"
echo

# -------------------------------------------------------------------
# pm2 auto-start (optional)
# -------------------------------------------------------------------
echo "${BOLD}Auto-start Setup${RESET}"
echo "  pm2 keeps the bot running 24/7 and restarts it on crashes/reboots."
echo
read -rp "Set up auto-start with pm2? [Y/n]: " PM2_ANSWER
PM2_ANSWER=${PM2_ANSWER:-Y}

if [[ "$PM2_ANSWER" =~ ^[Yy]$ ]]; then
  # Install pm2 if needed
  if ! command -v pm2 &>/dev/null; then
    echo "  Installing pm2..."
    npm install -g pm2
  fi

  # Stop existing instance if running
  pm2 delete claude-conduit 2>/dev/null || true

  # Start the bot
  cd "$INSTALL_DIR"
  pm2 start dist/index.js --name claude-conduit
  pm2 save

  echo
  ok "Bot is running with pm2"
  echo
  echo "  To set up auto-start on reboot, run:"
  echo "    ${BOLD}pm2 startup${RESET}"
  echo "  Then run the command it prints."
  echo
  echo "  Useful pm2 commands:"
  echo "    pm2 logs claude-conduit    # View logs"
  echo "    pm2 restart claude-conduit # Restart the bot"
  echo "    pm2 stop claude-conduit    # Stop the bot"
else
  echo
  echo "  To start the bot manually:"
  echo "    ${BOLD}cd ${INSTALL_DIR} && npm start${RESET}"
  echo
  echo "  For development mode:"
  echo "    ${BOLD}cd ${INSTALL_DIR} && npm run dev${RESET}"
fi

echo
echo "${GREEN}${BOLD}========================================${RESET}"
echo "${GREEN}${BOLD}  ClaudeConduit installed!${RESET}"
echo "${GREEN}${BOLD}========================================${RESET}"
echo
echo "  Open Discord and try /session in a channel."
echo "  To reconfigure: ${BOLD}cd ${INSTALL_DIR} && npm run setup${RESET}"
echo
