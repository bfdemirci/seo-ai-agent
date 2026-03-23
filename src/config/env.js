import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const _aiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";

export const env = {
  port: process.env.PORT || 3000,
  aiProvider: process.env.AI_PROVIDER || "claude",
  claudeApiKey: _aiKey,
  anthropicApiKey: _aiKey,
  claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  jwtSecret: process.env.JWT_SECRET || "change-this-secret",
  serperApiKey: process.env.SERPER_API_KEY || "",
  semrushApiKey: process.env.SEMRUSH_API_KEY || "",
  wordpressBaseUrl: process.env.WORDPRESS_BASE_URL || "",
  wordpressUsername: process.env.WORDPRESS_USERNAME || "",
  wordpressAppPassword: process.env.WORDPRESS_APP_PASSWORD || "",
  gscClientId: process.env.GSC_CLIENT_ID || "",
  gscClientSecret: process.env.GSC_CLIENT_SECRET || "",
  gscRefreshToken: process.env.GSC_REFRESH_TOKEN || "",
  gscSiteUrl: process.env.GSC_SITE_URL || "",
  publishEnabled: process.env.PUBLISH_ENABLED === "true",
  gscSyncEnabled: process.env.GSC_SYNC_ENABLED === "true",
};
