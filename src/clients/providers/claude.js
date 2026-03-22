import { env } from "../../config/env.js";

export async function claudeClient({ system, prompt, maxTokens }) {
  if (!env.claudeApiKey) {
    throw new Error("CLAUDE_API_KEY eksik");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.claudeApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: env.claudeModel,
      max_tokens: maxTokens,
      system,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || `Anthropic API error: ${res.status}`);
  }

  if (data?.error) {
    throw new Error(data.error.message);
  }

  const usage = data?.usage || {};

  return {
    text: data?.content?.[0]?.text || "",
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    model: env.claudeModel
  };
}
