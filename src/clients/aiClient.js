import { env } from "../config/env.js";
import { claudeClient } from "./providers/claude.js";

export async function generateAIResponse({ system, prompt, maxTokens = 4000 }) {
  const start = Date.now();

  let result;

  switch (env.aiProvider) {
    case "claude":
      result = await claudeClient({ system, prompt, maxTokens });
      break;
    default:
      throw new Error(`Unsupported provider: ${env.aiProvider}`);
  }

  return {
    ...result,
    durationMs: Date.now() - start
  };
}
