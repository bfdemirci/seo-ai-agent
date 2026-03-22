import { getKeywordIntel } from '../services/seo/semrush.service.js';
import { generateAIResponse } from "../clients/aiClient.js";
import { buildSystemPrompt } from "../prompts/brandMemory.js";
import { searchIntentAgent } from "../agents/research/searchIntentAgent.js";
import { serpStructureAgent } from "../agents/research/serpStructureAgent.js";
import { fetchSerperData } from "../providers/serperProvider.js";
import { fetchKeywordOverview as fetchSemrushData } from "../providers/semrushProvider.js";
import { withTimeout } from "../utils/timeout.js";
import { withRetry } from "../utils/retry.js";

export async function researchPipeline({ keyword }) {
  const start = Date.now();

  console.log(`[START] research:intent`);
  const intent = await withRetry(
    () => withTimeout(searchIntentAgent({ keyword }), 30000, "searchIntent"),
    { retries: 1, name: "searchIntent" }
  );
  console.log(`[END] research:intent`);

  console.log(`[START] research:serp`);
  const [serpAI, serperData, semrushData] = await Promise.all([
    withRetry(
      () => withTimeout(serpStructureAgent({ keyword }), 30000, "serpStructure"),
      { retries: 1, name: "serpStructure" }
    ),
    withRetry(
      () => withTimeout(fetchSerperData(keyword), 15000, "serper"),
      { retries: 1, name: "serper" }
    ),
    withRetry(
      () => withTimeout(fetchSemrushData(keyword), 15000, "semrush"),
      { retries: 1, name: "semrush" }
    )
  ]);
  console.log(`[END] research:serp`);

  console.log(`[START] research:synthesis`);
  const system = buildSystemPrompt();
  const prompt = `
Analyze this SEO research for keyword: "${keyword}"

INTENT: ${JSON.stringify(intent)}
SERP AI: ${JSON.stringify(serpAI)}
SERPER LIVE DATA: ${JSON.stringify(serperData)}
SEMRUSH DATA: ${JSON.stringify(semrushData)}

Return ONLY valid JSON, no markdown:
{
  "suggestedHeadings": ["..."],
  "opportunities": ["..."],
  "gaps": ["..."],
  "questionsToAnswer": ["..."]
}
`;

  const synthesisRes = await withRetry(
    () => withTimeout(
      generateAIResponse({ system, prompt, maxTokens: 2000 }),
      40000,
      "synthesis"
    ),
    { retries: 1, name: "synthesis" }
  );

  let synthesis;
  try {
    const text = synthesisRes.text.trim().replace(/```json|```/g, "").trim();
    synthesis = JSON.parse(text);
  } catch {
    synthesis = {
      suggestedHeadings: [],
      opportunities: [],
      gaps: [],
      questionsToAnswer: [synthesisRes.text]
    };
  }
  console.log(`[END] research:synthesis`);

  return {
    text: JSON.stringify({ intent, serp: serpAI, serperData, semrushData, synthesis }),
    inputTokens: synthesisRes.inputTokens,
    outputTokens: synthesisRes.outputTokens,
    durationMs: Date.now() - start,
    model: synthesisRes.model,
    structured: {
      keyword,
      intent,
      serp: {
        ...serpAI,
        topResults: serperData.topResults,
        peopleAlsoAsk: serperData.peopleAlsoAsk,
        relatedSearches: serperData.relatedSearches
      },
      semrush: semrushData,
      synthesis
    }
  };
}
