#!/bin/bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Install bun if not available
if ! command -v bun &> /dev/null; then
    curl -fsSL https://bun.sh/install | bash
fi

# Install yt-dlp if not available (required for YouTube Downloader)
if ! command -v yt-dlp &> /dev/null; then
    echo "Installing yt-dlp..."
    pip3 install --user yt-dlp || pip install --user yt-dlp
    export PATH="$HOME/.local/bin:$PATH"
fi

# Build the application
bun install
bun run build

# Restart PM2 process
pm2 restart ecosystem.config.js --env production
