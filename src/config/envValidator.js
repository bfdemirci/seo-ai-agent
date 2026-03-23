export function validateEnv() {
  const required = [];
  const aiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!aiKey) required.push("ANTHROPIC_API_KEY");
  if (process.env.PUBLISH_ENABLED === "true") {
    required.push("WORDPRESS_BASE_URL", "WORDPRESS_USERNAME", "WORDPRESS_APP_PASSWORD");
  }
  if (process.env.GSC_SYNC_ENABLED === "true") {
    required.push("GSC_CLIENT_ID", "GSC_CLIENT_SECRET", "GSC_REFRESH_TOKEN");
  }
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    missing.forEach(k => console.error("[ENV] missing required env var:", k));
    process.exit(1);
  }
  console.log("[ENV] validation passed — aiKey:", !!aiKey);
}
