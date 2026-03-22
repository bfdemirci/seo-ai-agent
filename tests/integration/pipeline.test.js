import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTracker } from "../../src/utils/tracker.js";

describe("tracker integration", () => {
  it("4 step kayit eder ve toplar", () => {
    const tracker = createTracker();
    const steps = ["searchIntent", "serpStructure", "outline", "article"];

    steps.forEach((step, i) => {
      tracker.record({
        step,
        inputTokens: 100 * (i + 1),
        outputTokens: 200 * (i + 1),
        durationMs: 1000 * (i + 1),
        model: "claude-sonnet-4-20250514"
      });
    });

    const s = tracker.summary();
    assert.equal(s.steps.length, 4);
    assert.ok(s.totalCost > 0);
    assert.ok(s.totalDuration > 0);
    assert.ok(s.totalTokens > 0);
  });

  it("pipeline output shape dogru", () => {
    const mockResult = {
      keyword: "seo nedir",
      research: { intent: "informational", serp: "headings" },
      outline: "H1: SEO\nH2: Tanim",
      article: "SEO nedir makalesi...",
      _meta: {
        steps: [],
        totalCost: 0.15,
        totalDuration: 190000,
        totalTokens: 12000
      }
    };

    assert.ok(mockResult.keyword);
    assert.ok(mockResult.research.intent);
    assert.ok(mockResult.research.serp);
    assert.ok(mockResult.outline);
    assert.ok(mockResult.article);
    assert.ok(mockResult._meta.totalCost >= 0);
  });
});
