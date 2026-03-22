import { generateAIResponse } from "../../clients/aiClient.js";
import { buildSystemPrompt } from "../../prompts/brandMemory.js";

export async function criticAgent({ keyword, outline, article, score }) {
  const system = buildSystemPrompt();

  const prompt = `
You are a senior SEO content editor. Analyze this article critically.

KEYWORD: "${keyword}"
OVERALL SCORE: ${score?.overallScore ?? "unknown"}
WEAK AREAS: seo:${score?.seoScore}, intent:${score?.intentScore}, readability:${score?.readabilityScore}, structure:${score?.structureScore}, usefulness:${score?.usefulnessScore}
OUTLINE: ${outline.slice(0, 300)}
ARTICLE (first 2000 chars): ${article.slice(0, 2000)}

Return ONLY valid JSON, no markdown:
{
  "strengths": ["max 3 specific strengths"],
  "weaknesses": ["max 3 specific weaknesses with location"],
  "repeatedSections": ["section names that repeat same info"],
  "factualRiskFlags": ["claims that may be inaccurate or unverifiable"],
  "improvementActions": [
    {
      "priority": "high|medium|low",
      "action": "specific action",
      "target": "which section or element",
      "expectedImpact": "which score improves"
    }
  ]
}
`;

  const res = await generateAIResponse({ system, prompt, maxTokens: 800 });

  try {
    const text = res.text.trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text);
    return {
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
      repeatedSections: parsed.repeatedSections ?? [],
      factualRiskFlags: parsed.factualRiskFlags ?? [],
      improvementActions: parsed.improvementActions ?? [],
    };
  } catch {
    return {
      strengths: [], weaknesses: [], repeatedSections: [],
      factualRiskFlags: [], improvementActions: [],
    };
  }
}
