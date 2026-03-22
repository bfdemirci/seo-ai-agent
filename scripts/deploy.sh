#!/bin/bash
set -e
echo "[DEPLOY] pulling latest..."
git pull

echo "[DEPLOY] installing dependencies..."
npm install --production

echo "[DEPLOY] stopping old process..."
pm2 stop seo-ai-agent || true

echo "[DEPLOY] starting with pm2..."
pm2 start ecosystem.config.cjs

echo "[DEPLOY] saving pm2 list..."
pm2 save

echo "[DEPLOY] done."
pm2 status
