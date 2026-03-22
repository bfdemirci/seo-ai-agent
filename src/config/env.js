import dotenv from "dotenv";
dotenv.config();

export const env = {
  port: process.env.PORT || 3000,
  aiProvider: process.env.AI_PROVIDER || "claude",
  claudeApiKey: process.env.CLAUDE_API_KEY || "",
  claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",

  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  jwtSecret: process.env.JWT_SECRET || "change-this-secret",

  serperApiKey: process.env.SERPER_API_KEY || "",
  semrushApiKey: process.env.SEMRUSH_API_KEY || ""
};
