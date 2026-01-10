#!/bin/bash

# Build the application
bun install
bun run build

# Restart PM2 process
pm2 restart ecosystem.config.js --env production
