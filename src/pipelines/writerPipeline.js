import { createTracker } from "../utils/tracker.js";
import { withTimeout } from "../utils/timeout.js";
import { withRetry } from "../utils/retry.js";
import { researchPipeline } from "./researchPipeline.js";
import { outlineAgent } from "../agents/writing/outlineAgent.js";
import { articleWriterAgent } from "../agents/writing/articleWriterAgent.js";
import { scoreAgent } from "../agents/optimization/scoreAgent.js";
import { criticAgent } from "../agents/optimization/criticAgent.js";
import { decisionEngine } from "../agents/optimization/decisionEngine.js";
import { targetedOptimizerAgent } from "../agents/optimization/targetedOptimizerAgent.js";
import { factRepairAgent } from "../agents/optimization/factRepairAgent.js";
import { finalizationAgent } from "../agents/finalization/finalizationAgent.js";
import { createArticleRecord } from "../repositories/articleRepository.js";
import { humanizerAgent } from "../agents/optimization/humanizerAgent.js";

export async function writerPipeline({ keyword }) {
  const tracker = createTracker();

  const run = async (step, fn, timeoutMs) => {
    if (timeoutMs === undefined) timeoutMs = 60000;
    console.log("[START] " + step);
    const res = await withRetry(
      function() { return withTimeout(fn(), timeoutMs, step); },
      { retries: 1, name: step }
    );
    console.log("[END] " + step + " — " + res.durationMs + "ms");
    tracker.record({ step: step, inputTokens: res.inputTokens, outputTokens: res.outputTokens, durationMs: res.durationMs, model: res.model });
    return res;
  };

  const researchRes = await run("research", function() { return researchPipeline({ keyword: keyword }); }, 120000);
  const outlineRes  = await run("outline",  function() { return outlineAgent({ keyword: keyword, research: researchRes.text }); }, 60000);
  const articleRes  = await run("article",  function() { return articleWriterAgent({ keyword: keyword, outline: outlineRes.text }); }, 180000);

  console.log("[START] evaluation");
  const scoreV1 = await scoreAgent({ keyword: keyword, research: researchRes.structured, outline: outlineRes.text, article: articleRes.text });
  const critic  = await criticAgent({ keyword: keyword, outline: outlineRes.text, article: articleRes.text, score: scoreV1 });
  console.log("[END] evaluation — overall: " + scoreV1.overallScore);

  const decision = decisionEngine({ score: scoreV1, critic: critic, keyword: keyword, article: articleRes.text, outline: outlineRes.text, iterationCount: 0, maxIterations: 2 });
  console.log("[DECISION] action: " + decision.action + ", targets: " + decision.targets.join(", "));

  var articleFinal = articleRes.text;
  var scoreV2      = null;
  var criticV2     = null;
  var scoreV3      = null;
  var scoreV4      = null;

  // OPTIMIZATION STEP
  if (decision.shouldIterate) {
    console.log("[START] optimizer");
    const optimized = await targetedOptimizerAgent({ article: articleRes.text, keyword: keyword, outline: outlineRes.text, score: scoreV1, critic: critic, targets: decision.targets });
    tracker.record({ step: "optimizer", inputTokens: optimized.inputTokens, outputTokens: optimized.outputTokens, durationMs: optimized.durationMs, model: optimized.model });
    console.log("[END] optimizer");

    scoreV2 = await scoreAgent({ keyword: keyword, research: researchRes.structured, outline: outlineRes.text, article: optimized.text });
    console.log("[SCORE v2] overall: " + scoreV2.overallScore);

    if (scoreV2.overallScore >= scoreV1.overallScore - 3) {
      articleFinal = optimized.text;
      criticV2 = await criticAgent({ keyword: keyword, outline: outlineRes.text, article: articleFinal, score: scoreV2 });
    } else {
      console.log("[ROLLBACK] optimizer degraded score (" + scoreV1.overallScore + " to " + scoreV2.overallScore + "), reverting");
      scoreV2 = null;
      articleFinal = articleRes.text;
    }
  }

  // FACT REPAIR STEP
  var factualRiskFlags = (critic && critic.factualRiskFlags) || [];
  if (scoreV2 !== null && decision.targets.includes("factual") && factualRiskFlags.length > 0) {
    console.log("[START] factRepair");
    const repaired = await factRepairAgent({ article: articleFinal, keyword: keyword, critic: critic });
    tracker.record({ step: "factRepair", inputTokens: repaired.inputTokens, outputTokens: repaired.outputTokens, durationMs: repaired.durationMs, model: repaired.model });
    console.log("[END] factRepair");

    scoreV3 = await scoreAgent({ keyword: keyword, research: researchRes.structured, outline: outlineRes.text, article: repaired.text });
    console.log("[SCORE v3] overall: " + scoreV3.overallScore);

    var baseScore = (scoreV2 && scoreV2.overallScore) || scoreV1.overallScore;

    if (scoreV3.overallScore >= baseScore - 1) {
      articleFinal = repaired.text;
      var delta = scoreV3.overallScore - baseScore;
      var sign = delta >= 0 ? "+" : "";
      console.log("[FACT_REPAIR] accepted: true (delta: " + sign + delta + ")");
    } else {
      var deltaR = scoreV3.overallScore - baseScore;
      console.log("[FACT_REPAIR] accepted: false (delta: " + deltaR + ")");
      scoreV3 = null;
    }
  }

  // HUMANIZER STEP
  var lastScore = scoreV3 || scoreV2 || scoreV1;
  if (lastScore.readabilityScore !== undefined) {
    console.log("[START] humanizer");
    const humanized = await humanizerAgent({ article: articleFinal, keyword: keyword, score: lastScore, critic: criticV2 || critic });
    tracker.record({ step: "humanizer", inputTokens: humanized.inputTokens, outputTokens: humanized.outputTokens, durationMs: humanized.durationMs, model: humanized.model });
    var patchCount = (humanized.patches && humanized.patches.length) || 0;
    console.log("[END] humanizer — " + patchCount + " patches");

    scoreV4 = await scoreAgent({ keyword: keyword, research: researchRes.structured, outline: outlineRes.text, article: humanized.text });
    console.log("[SCORE v4] overall: " + scoreV4.overallScore);

    var lastStructure = (lastScore.structureScore) || 0;
    if (scoreV4.overallScore >= lastScore.overallScore - 1 && scoreV4.structureScore >= lastStructure - 2) {
      articleFinal = humanized.text;
      console.log("[HUMANIZER] accepted (overall: " + lastScore.overallScore + " -> " + scoreV4.overallScore + ", readability: " + lastScore.readabilityScore + " -> " + scoreV4.readabilityScore + ")");
    } else {
      console.log("[HUMANIZER] rejected — rollback (overall: " + lastScore.overallScore + " -> " + scoreV4.overallScore + ")");
      scoreV4 = null;
    }
  }

  // FINALIZATION STEP
  console.log("[START] finalization");
  const finalization = await finalizationAgent({
    keyword:    keyword,
    article:    articleFinal,
    outline:    outlineRes.text,
    evaluation: { scoreV1: scoreV1, scoreV2: scoreV2, scoreV3: scoreV3 }
  });
  tracker.record({ step: "finalization", inputTokens: finalization.inputTokens, outputTokens: finalization.outputTokens, durationMs: finalization.durationMs, model: finalization.model });
  console.log("[END] finalization — slug: " + finalization.slugSuggestion);

  // STORAGE STEP
  const articleId = createArticleRecord({
    keyword:      keyword,
    article:      articleFinal,
    outline:      outlineRes.text,
    research:     researchRes.structured || researchRes.text,
    evaluation:   { scoreV1: scoreV1, scoreV2: scoreV2, scoreV3: scoreV3, decision: decision, improved: articleFinal !== articleRes.text },
    finalization: { metaTitle: finalization.metaTitle, metaDescription: finalization.metaDescription, slugSuggestion: finalization.slugSuggestion },
  });
  console.log("[STORAGE] article saved to storage/articles/" + articleId);

  return {
    keyword:  keyword,
    research: researchRes.structured || researchRes.text,
    outline:  outlineRes.text,
    article:  articleFinal,
    evaluation: {
      scoreV1:    scoreV1,
      scoreV2:    scoreV2 || null,
      scoreV3:    scoreV3 || null,
      critic:     critic,
      criticV2:   criticV2 || null,
      decision:   decision,
      scoreV4:    scoreV4 || null,
      improved:   articleFinal !== articleRes.text,
      finalization: finalization,
      articleId:  articleId || null
    },
    _meta: tracker.summary()
  };
}
