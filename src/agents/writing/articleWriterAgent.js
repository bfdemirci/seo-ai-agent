import { generateAIResponse } from "../../clients/aiClient.js";
import { buildSystemPrompt } from "../../prompts/brandMemory.js";

export async function articleWriterAgent({ keyword, outline }) {
  const system = buildSystemPrompt();

  const bodyPrompt = `
Write the main body of an SEO article in Turkish for keyword: "${keyword}"

Use this outline (skip FAQ and Conclusion sections):
${outline}

Rules:
- Follow outline H1/H2/H3 structure exactly
- No repetition between sections
- No fluff, every sentence must add value
- Natural language, no keyword stuffing
- Stop before FAQ section
`;

  const body = await generateAIResponse({
    system,
    prompt: bodyPrompt,
    maxTokens: 4000
  });

  const closingPrompt = `
Write the FAQ and Conclusion for an SEO article in Turkish for keyword: "${keyword}"

Article context (do not repeat this content):
${body.text.slice(0, 500)}...

Rules:
- FAQ: max 5 questions with concise answers
- Conclusion: max 3 sentences
- No repetition from the main body
`;

  const closing = await generateAIResponse({
    system,
    prompt: closingPrompt,
    maxTokens: 1500
  });

  return {
    text: body.text + "\n\n" + closing.text,
    inputTokens: body.inputTokens + closing.inputTokens,
    outputTokens: body.outputTokens + closing.outputTokens,
    durationMs: body.durationMs + closing.durationMs,
    model: body.model
  };
}
