#!/bin/bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun &> /dev/null; then
    curl -fsSL https://bun.sh/install | bash
fi

# Build the application
bun install
bun run build

# Restart PM2 process
pm2 restart ecosystem.config.js --env production
