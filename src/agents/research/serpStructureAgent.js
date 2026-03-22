import { generateAIResponse } from "../../clients/aiClient.js";
import { buildSystemPrompt } from "../../prompts/brandMemory.js";

export async function serpStructureAgent({ keyword }) {
  const system = buildSystemPrompt();
  const prompt = `
Simulate SERP structure for keyword: "${keyword}"

Return ONLY valid JSON, no markdown, no explanation:
{
  "topResults": ["title1", "title2", "title3"],
  "peopleAlsoAsk": ["question1", "question2"],
  "relatedSearches": ["search1", "search2"],
  "commonHeadings": ["heading1", "heading2"],
  "patterns": ["pattern1", "pattern2"]
}
`;

  const res = await generateAIResponse({ system, prompt, maxTokens: 1500 });

  try {
    const text = res.text.trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text);
    return { ...parsed, _raw: res };
  } catch {
    return {
      topResults: [],
      peopleAlsoAsk: [],
      relatedSearches: [],
      commonHeadings: [],
      patterns: [res.text],
      _raw: res
    };
  }
}
