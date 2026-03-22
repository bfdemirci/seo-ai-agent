import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "../../src/prompts/brandMemory.js";

describe("brandMemory", () => {
  it("system prompt uretir", () => {
    const prompt = buildSystemPrompt();
    assert.ok(typeof prompt === "string");
    assert.ok(prompt.length > 0);
    assert.ok(prompt.includes("SEO"));
  });

  it("tone iceriyor", () => {
    const prompt = buildSystemPrompt();
    assert.ok(prompt.includes("professional"));
  });

  it("forbidden kelimeler iceriyor", () => {
    const prompt = buildSystemPrompt();
    assert.ok(prompt.includes("AI generated"));
  });
});
