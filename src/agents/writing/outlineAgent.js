import { generateAIResponse } from "../../clients/aiClient.js";
import { buildSystemPrompt } from "../../prompts/brandMemory.js";

export async function outlineAgent({ keyword, research }) {
  const system = buildSystemPrompt();

  const prompt = `
Create a concise SEO article outline for keyword: "${keyword}"

Research context:
${typeof research === "string" ? research.slice(0, 800) : JSON.stringify(research).slice(0, 800)}

Return ONLY the outline structure:
- H1 title
- Max 6 H2 sections
- Max 2 H3 per H2
- FAQ section (max 5 questions, no answers)
- Conclusion direction (1 sentence)

No descriptions, no notes, no word count targets. Structure only.
`;

  return generateAIResponse({
    system,
    prompt,
    maxTokens: 800
  });
}
