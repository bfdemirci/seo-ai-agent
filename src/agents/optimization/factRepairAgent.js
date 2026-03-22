import { generateAIResponse } from "../../clients/aiClient.js";
import { buildSystemPrompt } from "../../prompts/brandMemory.js";

export async function factRepairAgent({ article, keyword, critic }) {
  const flags = (critic.factualRiskFlags || []);

  // No flags — return unchanged, no API call
  if (flags.length === 0) {
    return { text: article, inputTokens: 0, outputTokens: 0, durationMs: 0, model: "skipped" };
  }

  const system = buildSystemPrompt();
  const flagList = flags.map(f => "- " + f).join("\n");

  // Ask LLM ONLY for a find→replace JSON list, never for the full article
  const prompt = `You are a find-and-replace editor. Given factual risk flags, produce a JSON array of replacements to soften hard claims.

KEYWORD: "${keyword}"
FACTUAL RISK FLAGS:
${flagList}

ARTICLE (read-only, do not reproduce):
${article.slice(0, 3000)}${article.length > 3000 ? "\n[... rest of article ...]" : ""}

OUTPUT RULES:
- Return ONLY a valid JSON array, nothing else
- Each item: { "find": "exact phrase from article", "replace": "softer version" }
- Maximum 8 replacements
- Only soften hard numeric/statistical claims
- Do not change headings, do not add new facts
- Keep Turkish language
- If no risky claims found, return []

Example output:
[
  { "find": "200'den fazla faktör", "replace": "pek çok faktör" },
  { "find": "%75'i tıklar", "replace": "büyük çoğunluğu tıklar" }
]`;

  const t0 = Date.now();
  const res = await generateAIResponse({ system, prompt, maxTokens: 400 });

  let replacements = [];
  try {
    const cleaned = res.text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    replacements = JSON.parse(cleaned);
    if (!Array.isArray(replacements)) replacements = [];
  } catch (e) {
    // JSON parse failed — return article unchanged
    return {
      text: article,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      durationMs: res.durationMs ?? (Date.now() - t0),
      model: res.model
    };
  }

  // Apply replacements programmatically — article structure guaranteed intact
  let repairedArticle = article;
  for (const { find, replace } of replacements) {
    if (typeof find === "string" && typeof replace === "string" && find.length > 0) {
      repairedArticle = repairedArticle.split(find).join(replace);
    }
  }

  return {
    text: repairedArticle,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    durationMs: res.durationMs ?? (Date.now() - t0),
    model: res.model,
    replacements
  };
}
