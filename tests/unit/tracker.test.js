import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTracker } from "../../src/utils/tracker.js";

describe("createTracker", () => {
  it("step kaydeder", () => {
    const tracker = createTracker();
    tracker.record({
      step: "test",
      inputTokens: 100,
      outputTokens: 200,
      durationMs: 500,
      model: "claude-sonnet-4-20250514"
    });
    const s = tracker.summary();
    assert.equal(s.steps.length, 1);
    assert.equal(s.steps[0].step, "test");
    assert.equal(s.totalTokens, 300);
  });

  it("maliyet hesaplar", () => {
    const tracker = createTracker();
    tracker.record({
      step: "cost-test",
      inputTokens: 1000000,
      outputTokens: 1000000,
      durationMs: 100,
      model: "claude-sonnet-4-20250514"
    });
    const s = tracker.summary();
    assert.equal(s.totalCost, 18);
  });

  it("step zorunlu hata firlatir", () => {
    const tracker = createTracker();
    assert.throws(() => {
      tracker.record({ inputTokens: 100, outputTokens: 100 });
    }, /step/);
  });

  it("birden fazla step toplar", () => {
    const tracker = createTracker();
    tracker.record({ step: "a", inputTokens: 100, outputTokens: 100, durationMs: 100 });
    tracker.record({ step: "b", inputTokens: 200, outputTokens: 200, durationMs: 200 });
    const s = tracker.summary();
    assert.equal(s.steps.length, 2);
    assert.equal(s.totalTokens, 600);
    assert.equal(s.totalDuration, 300);
  });
});
