import { generateAIResponse } from "../../clients/aiClient.js";
import { buildSystemPrompt } from "../../prompts/brandMemory.js";

export async function scoreAgent({ keyword, research, outline, article }) {
  const system = buildSystemPrompt();
  const prompt = `
You are an objective SEO content evaluator.

KEYWORD: "${keyword}"
OUTLINE: ${outline.slice(0, 400)}
ARTICLE: ${article.slice(0, 2500)}

Return ONLY valid JSON, no markdown:
{
  "seoScore": 0-100,
  "intentScore": 0-100,
  "readabilityScore": 0-100,
  "structureScore": 0-100,
  "usefulnessScore": 0-100,
  "overallScore": 0-100
}
`;

  const res = await generateAIResponse({ system, prompt, maxTokens: 400 });
  try {
    const parsed = JSON.parse(res.text.trim().replace(/```json|```/g, "").trim());
    return {
      seoScore: parsed.seoScore ?? 0,
      intentScore: parsed.intentScore ?? 0,
      readabilityScore: parsed.readabilityScore ?? 0,
      structureScore: parsed.structureScore ?? 0,
      usefulnessScore: parsed.usefulnessScore ?? 0,
      overallScore: parsed.overallScore ?? 0
    };
  } catch {
    return { seoScore: 0, intentScore: 0, readabilityScore: 0, structureScore: 0, usefulnessScore: 0, overallScore: 0 };
  }
}
