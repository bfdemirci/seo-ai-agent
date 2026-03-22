import { generateAIResponse } from "../../clients/aiClient.js";
import { buildSystemPrompt } from "../../prompts/brandMemory.js";

export async function targetedOptimizerAgent({ article, keyword, outline, score, critic, targets }) {
  const system = buildSystemPrompt();

  const highPriorityActions = critic.improvementActions
    ?.filter(a => a.priority === "high")
    .map(a => `- ${a.action} → ${a.target}`)
    .join("\n") || "none";

  const prompt = `
You are a minimal SEO editor. Make ONLY these specific fixes:

KEYWORD: "${keyword}"

FIXES TO MAKE:
${highPriorityActions}

ADDITIONAL:
- Merge repeated content: ${critic.repeatedSections?.slice(0, 1).join("") || "none"}

RULES — READ CAREFULLY:
- Copy the article EXACTLY as-is
- ONLY touch the specific sections listed above
- Do NOT change any sentence that is not mentioned
- Do NOT add new sections
- Do NOT remove existing sections
- Do NOT change headings
- Do NOT improve general writing style
- Return the COMPLETE article

ARTICLE:
${article}
`;

  const res = await generateAIResponse({ system, prompt, maxTokens: 4500 });
  return {
    text: res.text,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    durationMs: res.durationMs,
    model: res.model
  };
}
