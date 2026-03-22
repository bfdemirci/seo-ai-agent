export function validateEnv() {
  const required = [
    'ANTHROPIC_API_KEY',
    'GSC_CLIENT_ID',
    'GSC_CLIENT_SECRET',
    'GSC_REFRESH_TOKEN',
    'WORDPRESS_BASE_URL',
    'WORDPRESS_USERNAME',
    'WORDPRESS_APP_PASSWORD',
  ];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    missing.forEach(k => console.error('[ENV] missing required env var:', k));
    console.error('[ENV] ' + missing.length + ' required env vars missing. Exiting.');
    process.exit(1);
  }
}
