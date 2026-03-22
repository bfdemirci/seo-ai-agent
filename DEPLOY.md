# Deploy Guide

## Prerequisites
- Node.js 18+
- PM2: `npm install -g pm2`
- `.env` file with all required vars on VPS

## Required ENV vars
```
PORT=3000
NODE_ENV=production
JWT_SECRET=change_me

ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=change_me

ANTHROPIC_API_KEY=

GSC_CLIENT_ID=
GSC_CLIENT_SECRET=
GSC_REFRESH_TOKEN=
GSC_SITE_URL=https://yourdomain.com/

WORDPRESS_BASE_URL=https://yourdomain.com
WORDPRESS_USERNAME=
WORDPRESS_APP_PASSWORD=

ENABLE_SCHEDULER=true
SCHEDULER_INTERVAL_MS=3600000
GSC_SYNC_ENABLED=true
PUBLISH_ENABLED=true
CAMPAIGN_SAFE_MODE=true
MAX_CAMPAIGNS_PER_CYCLE=3
```

## First deploy
```bash
git clone <repo> seo-ai-agent-system
cd seo-ai-agent-system
cp .env.example .env   # fill in values
npm install --production
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup            # follow the printed command
```

## Subsequent deploys
```bash
bash scripts/deploy.sh
```

## PM2 commands
```bash
pm2 status
pm2 logs seo-ai-agent
pm2 restart seo-ai-agent
pm2 stop seo-ai-agent
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## Health checks
```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/health/details
curl http://localhost:3000/api/v1/health/runtime
```

## Disable publish in production (safe mode)
```
PUBLISH_ENABLED=false
```

## Disable GSC sync
```
GSC_SYNC_ENABLED=false
```

## Run campaigns in safe mode (no publish)
```
CAMPAIGN_SAFE_MODE=true
```

## Nginx reverse proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
