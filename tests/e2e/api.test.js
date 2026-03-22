import { describe, it } from "node:test";
import assert from "node:assert/strict";

const BASE = "http://localhost:3000";

describe("API /api/generate", () => {
  it("keyword olmadan 400 doner", async () => {
    const res = await fetch(`${BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it("/health 200 doner", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
  });
});
