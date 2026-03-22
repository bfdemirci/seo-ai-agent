module.exports = {
  apps: [{
    name: 'seo-ai-agent',
    script: 'src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      ENABLE_SCHEDULER: 'true'
    }
  }]
};
