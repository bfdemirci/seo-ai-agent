import { noopResult, prepareOnlyResult, rollbackResult } from './actionHandlers.js';
import { saveArticleVersion, updateArticleMetadata, appendArticleEvent, getArticleById } from '../../repositories/articleRepository.js';

// ── Rollback guard ────────────────────────────────────────────────────────────
function scoreAcceptable(newScore, baseline) {
  if (!newScore || !baseline) return true;
  const overallOk   = (newScore.overallScore   || 0) >= (baseline.overallScore   || 0) - 1;
  const structureOk = (newScore.structureScore || 0) >= (baseline.structureScore || 0) - 3;
  return overallOk && structureOk;
}

// ── Event helpers ─────────────────────────────────────────────────────────────
function logEvent(articleId, type, payload) {
  try { appendArticleEvent(articleId, { type, ...payload }); } catch (_) {}
}

// ── Main executor ─────────────────────────────────────────────────────────────
export async function executeAction({ articleId, decision, articleRecord, _injected }) {
  const action     = decision.action;
  const confidence = decision.confidence;
  const priority   = decision.priority;
  const keyword    = articleRecord.meta.keyword;
  const article    = articleRecord.currentArticle;
  const outline    = articleRecord.versionData && articleRecord.versionData.outline || null;
  const research   = articleRecord.versionData && articleRecord.versionData.research || null;

  // Baseline evaluation for rollback guard
  const baseEval = articleRecord.meta.latestEvaluation || {};
  const baseline = baseEval.scoreV3 || baseEval.scoreV2 || baseEval.scoreV1 || null;

  // Injectable agents for testing (default: real imports)
  const inj = _injected || {};

  let out;

  // ── ignore ────────────────────────────────────────────────────────────────
  if (action === 'ignore') {
    out = { articleId, action, ...noopResult(['No action taken — article is healthy.']) };
    logEvent(articleId, 'lifecycle_action_executed', { action, executionMode: 'noop', confidence, priority });
    return out;
  }

  // ── monitor ───────────────────────────────────────────────────────────────
  if (action === 'monitor') {
    out = { articleId, action, ...noopResult(['Monitoring only — no content changed.']) };
    logEvent(articleId, 'lifecycle_action_executed', { action, executionMode: 'noop', confidence, priority });
    return out;
  }

  // ── offpage_review ────────────────────────────────────────────────────────
  if (action === 'offpage_review') {
    out = { articleId, action, ...prepareOnlyResult(['Off-page review recommended — no content changed.']) };
    logEvent(articleId, 'lifecycle_action_executed', { action, executionMode: 'prepare_only', confidence, priority });
    return out;
  }

  // ── internal_link_boost ───────────────────────────────────────────────────
  if (action === 'internal_link_boost') {
    out = { articleId, action, ...prepareOnlyResult(['Internal link boost not implemented in MVP.']) };
    logEvent(articleId, 'lifecycle_action_executed', { action, executionMode: 'prepare_only', confidence, priority });
    return out;
  }

  // ── rewrite ───────────────────────────────────────────────────────────────
  if (action === 'rewrite') {
    out = { articleId, action, ...prepareOnlyResult(['Rewrite recommended but not auto-executed in MVP.']) };
    logEvent(articleId, 'lifecycle_action_executed', { action, executionMode: 'prepare_only', confidence, priority });
    return out;
  }

  // ── meta_only ─────────────────────────────────────────────────────────────
  if (action === 'meta_only') {
    try {
      const finalizationAgent = inj.finalizationAgent || (await import('../../agents/finalization/finalizationAgent.js')).finalizationAgent;
      const newFin = await finalizationAgent({ keyword, article, outline });

      const oldFin = articleRecord.meta.finalization || {};
      const changed = newFin.metaTitle !== oldFin.metaTitle || newFin.metaDescription !== oldFin.metaDescription || newFin.slugSuggestion !== oldFin.slugSuggestion;

      const notes = changed
        ? ['Finalization refreshed — meta title/description updated.']
        : ['Finalization re-run — no change detected.'];

      if (changed) {
        updateArticleMetadata(articleId, {
          finalization: { metaTitle: newFin.metaTitle, metaDescription: newFin.metaDescription, slugSuggestion: newFin.slugSuggestion },
        });
      }

      out = {
        articleId, action,
        executed: true,
        executionMode: 'metadata_update',
        result: { articleChanged: false, metadataChanged: changed, newVersion: null, notes },
        rollback: { applied: false, reason: null },
      };
    } catch (err) {
      out = {
        articleId, action,
        executed: false,
        executionMode: 'metadata_update',
        result: { articleChanged: false, metadataChanged: false, newVersion: null, notes: ['finalizationAgent failed: ' + err.message] },
        rollback: { applied: false, reason: null },
      };
    }
    logEvent(articleId, 'lifecycle_action_executed', { action, executionMode: out.executionMode, confidence, priority });
    return out;
  }

  // ── refresh ───────────────────────────────────────────────────────────────
  if (action === 'refresh') {
    const notes    = [];
    let workArticle = article;
    let anyChange   = false;

    try {
      // factRepairAgent
      const factRepairAgent = inj.factRepairAgent || (await import('../../agents/optimization/factRepairAgent.js')).factRepairAgent;
      const critic = { factualRiskFlags: decision.evidenceSummary && decision.evidenceSummary.decayTypes && decision.evidenceSummary.decayTypes.ctr ? ['CTR dropped significantly'] : [] };
      const repaired = await factRepairAgent({ article: workArticle, keyword, critic });
      const repairedText = repaired.text || repaired;
      if (repairedText && repairedText !== workArticle) {
        workArticle = repairedText;
        anyChange   = true;
        notes.push('factRepairAgent applied patches.');
      } else {
        notes.push('factRepairAgent: no patches applied.');
      }
    } catch (err) {
      notes.push('factRepairAgent skipped: ' + err.message);
    }

    try {
      // humanizerAgent
      const humanizerAgent = inj.humanizerAgent || (await import('../../agents/optimization/humanizerAgent.js')).humanizerAgent;
      const scoreData = baseline || { overallScore: 80 };
      const critic2   = { weaknesses: [] };
      const humanized = await humanizerAgent({ article: workArticle, keyword, score: scoreData, critic: critic2 });
      const humanizedText = humanized.text || humanized;
      const patchCount = humanized.patches ? humanized.patches.length : 0;
      if (humanizedText && humanizedText !== workArticle && patchCount > 0) {
        workArticle = humanizedText;
        anyChange   = true;
        notes.push('humanizerAgent applied ' + patchCount + ' patches.');
      } else {
        notes.push('humanizerAgent: 0 patches applied.');
      }
    } catch (err) {
      notes.push('humanizerAgent skipped: ' + err.message);
    }

    if (!anyChange) {
      out = {
        articleId, action,
        executed: true,
        executionMode: 'content_update',
        result: { articleChanged: false, metadataChanged: false, newVersion: null, notes },
        rollback: { applied: false, reason: null },
      };
      logEvent(articleId, 'lifecycle_action_executed', { action, executionMode: 'content_update', confidence, priority });
      return out;
    }

    // Score the refreshed article
    try {
      const scoreAgent = inj.scoreAgent || (await import('../../agents/optimization/scoreAgent.js')).scoreAgent;
      const newScore = await scoreAgent({ keyword, research, outline, article: workArticle });

      if (!scoreAcceptable(newScore, baseline)) {
        notes.push('Rollback: new score degraded (new=' + newScore.overallScore + ', baseline=' + (baseline && baseline.overallScore) + ').');
        out = { articleId, action, ...rollbackResult('score degraded', notes) };
        logEvent(articleId, 'lifecycle_action_executed',  { action, executionMode: 'content_update', confidence, priority });
        logEvent(articleId, 'lifecycle_action_rollback',  { action, reason: 'score degraded' });
        return out;
      }

      // Save new version
      const newVer = saveArticleVersion(articleId, { article: workArticle, outline, research, label: 'lifecycle_refresh' });
      notes.push('New version saved: ' + newVer + '.');

      // Refresh finalization
      try {
        const finalizationAgent = inj.finalizationAgent || (await import('../../agents/finalization/finalizationAgent.js')).finalizationAgent;
        const newFin = await finalizationAgent({ keyword, article: workArticle, outline });
        updateArticleMetadata(articleId, {
          finalization: { metaTitle: newFin.metaTitle, metaDescription: newFin.metaDescription, slugSuggestion: newFin.slugSuggestion },
          latestEvaluation: Object.assign({}, baseEval, { scoreV3: newScore }),
        });
        notes.push('Finalization refreshed.');
      } catch (_) { notes.push('Finalization refresh skipped.'); }

      out = {
        articleId, action,
        executed: true,
        executionMode: 'content_update',
        result: { articleChanged: true, metadataChanged: true, newVersion: newVer, notes },
        rollback: { applied: false, reason: null },
      };
    } catch (err) {
      notes.push('scoreAgent failed: ' + err.message + ' — skipping version save.');
      out = {
        articleId, action,
        executed: true,
        executionMode: 'content_update',
        result: { articleChanged: false, metadataChanged: false, newVersion: null, notes },
        rollback: { applied: false, reason: null },
      };
    }

    logEvent(articleId, 'lifecycle_action_executed', { action, executionMode: 'content_update', confidence, priority });
    return out;
  }

  // fallback
  out = { articleId, action, ...noopResult(['Unknown action: ' + action]) };
  return out;
}
