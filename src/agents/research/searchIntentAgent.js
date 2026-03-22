import { generateAIResponse } from "../../clients/aiClient.js";
import { buildSystemPrompt } from "../../prompts/brandMemory.js";

export async function searchIntentAgent({ keyword }) {
  const system = buildSystemPrompt();
  const prompt = `
Analyze search intent for keyword: "${keyword}"

Return ONLY valid JSON, no markdown, no explanation:
{
  "primary": "informational | transactional | navigational | commercial",
  "secondary": ["..."],
  "expectations": ["..."],
  "contentAngle": "..."
}
`;

  const res = await generateAIResponse({ system, prompt, maxTokens: 1000 });

  try {
    const text = res.text.trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text);
    return { ...parsed, _raw: res };
  } catch {
    return {
      primary: "informational",
      secondary: [],
      expectations: [],
      contentAngle: res.text,
      _raw: res
    };
  }
}
