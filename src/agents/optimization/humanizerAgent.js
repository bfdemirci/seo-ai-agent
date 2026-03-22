import { generateAIResponse } from "../../clients/aiClient.js";
import { buildSystemPrompt } from "../../prompts/brandMemory.js";

export async function humanizerAgent({ article, keyword, score, critic }) {
  const system = buildSystemPrompt();

  const weaknesses = (critic?.weaknesses || [])
    .filter(w => /robot|tekrar|mekanik|akici|dogal|yazim|stil|okunabilir|kuru|soguk|monoton/i.test(w))
    .join("\n- ") || "genel okunabilirlik iyilestirmesi";

  const prompt = `You are a readability editor. Your ONLY job is to make robotic or repetitive sentences sound more natural in Turkish.

KEYWORD: "${keyword}"
READABILITY ISSUES: ${weaknesses}

RULES:
1. Return ONLY a valid JSON array of { "find": "...", "replace": "..." } objects
2. Maximum 10 replacements
3. Only patch sentences that are robotic, mechanical, or awkwardly repetitive
4. Do NOT touch headings (lines starting with #)
5. Do NOT change facts, numbers, or statistics
6. Do NOT add new information
7. Keep the same meaning and detail level
8. Keep Turkish language throughout
9. Each "find" must be an exact substring from the article
10. If nothing needs changing, return []

WHAT TO FIX (examples):
- Overly stiff openings: "Bu makalede ele alacagiz" -> "Simdi bakalim"
- Robotic repetition: same phrase used 3+ times -> vary wording
- Mechanical transitions: "Bunun yani sira" repeated -> use "Ayrica", "Ote yandan"
- Cold passive constructions where active reads better

ARTICLE (read-only):
${article.slice(0, 4000)}${article.length > 4000 ? "\n[... rest of article ...]" : ""}

Output ONLY the JSON array:`;

  const t0 = Date.now();
  const res = await generateAIResponse({ system, prompt, maxTokens: 500 });

  let patches = [];
  try {
    const cleaned = res.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    patches = JSON.parse(cleaned);
    if (!Array.isArray(patches)) patches = [];
  } catch {
    return { text: article, inputTokens: res.inputTokens, outputTokens: res.outputTokens, durationMs: res.durationMs ?? (Date.now() - t0), model: res.model, patches: [] };
  }

  // Apply patches programmatically — structure is guaranteed intact
  let humanized = article;
  for (const { find, replace } of patches) {
    if (typeof find === "string" && typeof replace === "string" && find.length > 0) {
      humanized = humanized.split(find).join(replace);
    }
  }

  return {
    text: humanized,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    durationMs: res.durationMs ?? (Date.now() - t0),
    model: res.model,
    patches
  };
}
