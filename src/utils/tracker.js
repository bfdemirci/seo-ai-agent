import { env } from "../config/env.js";

const PRICING = {
  "claude-sonnet-4-20250514": {
    input: 3 / 1000000,
    output: 15 / 1000000
  },
  "claude-sonnet-4": {
    input: 3 / 1000000,
    output: 15 / 1000000
  }
};

function calcCost(inputTokens, outputTokens, model) {
  const rates =
    PRICING[model] ||
    PRICING["claude-sonnet-4-20250514"] ||
    { input: 0, output: 0 };

  return inputTokens * rates.input + outputTokens * rates.output;
}

export function createTracker() {
  const steps = [];

  function record({
    step,
    inputTokens = 0,
    outputTokens = 0,
    durationMs = 0,
    model
  }) {
    if (!step) {
      throw new Error("tracker record requires step");
    }

    const totalTokens = inputTokens + outputTokens;
    const cost = calcCost(inputTokens, outputTokens, model || env.claudeModel);

    steps.push({
      step,
      model: model || env.claudeModel,
      inputTokens,
      outputTokens,
      totalTokens,
      cost: Number(cost.toFixed(6)),
      durationMs
    });
  }

  function summary() {
    return {
      steps,
      totalCost: Number(steps.reduce((sum, x) => sum + x.cost, 0).toFixed(6)),
      totalDuration: steps.reduce((sum, x) => sum + x.durationMs, 0),
      totalTokens: steps.reduce((sum, x) => sum + x.totalTokens, 0)
    };
  }

  return { record, summary };
}
