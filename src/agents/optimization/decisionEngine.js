export function decisionEngine({ score, critic, keyword, article, outline, iterationCount = 0, maxIterations = 2 }) {
  const { seoScore, intentScore, readabilityScore, structureScore, usefulnessScore, overallScore } = score;

  if (iterationCount >= maxIterations) {
    return { action: "pass", targets: [], shouldIterate: false, reason: "Max iterations reached", confidence: 1, priority: "none", nextAgent: null, stopReason: "max_iterations" };
  }

  // HARD BLOCK RULES — pass verilmez
  const weaknessText = critic.weaknesses?.join(" ").toLowerCase() || "";
  const hasIncomplete = ["cuts off", "incomplete", "missing", "truncated"].some(w => weaknessText.includes(w));
  const hasFactualRisk = critic.factualRiskFlags?.length > 0;
  const hasHighPriority = critic.improvementActions?.some(a => a.priority === "high");
  const hasRepetition = critic.repeatedSections?.length > 0;

  const forceOptimize = hasIncomplete || hasFactualRisk || hasHighPriority || (hasRepetition && overallScore < 90);

  // PASS only if tüm koşullar temiz
  if (!forceOptimize && overallScore >= 90) {
    return { action: "pass", targets: [], shouldIterate: false, reason: "Score above threshold and no hard blocks", confidence: 1, priority: "none", nextAgent: null, stopReason: "threshold_met" };
  }

  // REWRITE — intent çok zayıfsa
  if (intentScore < 65) {
    return { action: "rewrite", targets: ["intent"], shouldIterate: true, reason: "Intent score critically low", confidence: 0.95, priority: "high", nextAgent: "targetedOptimizer", stopReason: null };
  }

  // OPTIMIZE — targets belirle
  const targets = [];
  if (seoScore < 80)         targets.push("seo");
  if (intentScore < 80)      targets.push("intent");
  if (readabilityScore < 80) targets.push("readability");
  if (usefulnessScore < 80)  targets.push("usefulness");
  if (structureScore < 80)   targets.push("structure");
  if (hasFactualRisk)        targets.push("factual");
  if (hasRepetition)         targets.push("repetition");
  if (hasIncomplete)         targets.push("completeness");

  const confidence = Math.min(0.95, (100 - overallScore) / 100 + 0.5);
  const priority = overallScore < 70 ? "high" : overallScore < 80 ? "medium" : "low";

  const reason = [
    forceOptimize ? "Hard block triggered" : null,
    hasIncomplete ? "structural incompleteness" : null,
    hasFactualRisk ? "factual risk flags" : null,
    hasHighPriority ? "high priority actions pending" : null,
    hasRepetition ? "repeated sections detected" : null,
    overallScore < 90 ? `score below threshold (${overallScore})` : null
  ].filter(Boolean).join(", ");

  return {
    action: "optimize",
    targets,
    shouldIterate: true,
    reason,
    confidence: parseFloat(confidence.toFixed(2)),
    priority,
    nextAgent: "targetedOptimizer",
    stopReason: null
  };
}
