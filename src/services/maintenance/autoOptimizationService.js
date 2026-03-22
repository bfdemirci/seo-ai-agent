
/**
 * autoOptimizationService.js
 * Maintenance loop: decay → decision → action → event log.
 * safe-first: safeMode=true by default (no writes).
 */

import { getArticleById, appendArticleEvent } from '../../repositories/articleRepository.js';
import { getGscSnapshots, summarizeGscSnapshots } from '../../repositories/gscSnapshotRepository.js';
import { detectDecay } from '../decision/decayDetector.js';
import { runLifecycleDecision } from '../decision/lifecycleDecisionEngine.js';
import { executeAction } from '../decision/actionExecutor.js';

function safeReturn(articleId, error) {
  return {
    articleId:  articleId,
    keyword:    null,
    error:      error,
    decay:      null,
    decision:   null,
    execution:  null,
  };
}

/**
 * runAutoOptimizationForArticle(articleId, opts)
 * opts: { safeMode: boolean (default true), dryRun: boolean }
 */
export async function runAutoOptimizationForArticle(articleId, opts) {
  opts = opts || {};
  var safeMode = opts.safeMode !== false; // default true

  // A) get article
  var article = getArticleById(articleId);
  if (!article || !article.meta) {
    return safeReturn(articleId, 'Article not found: ' + articleId);
  }
  var meta    = article.meta;
  var keyword = meta.keyword || '';

  // B) GSC data
  var snapshots  = [];
  var gscSummary = null;
  try { snapshots  = getGscSnapshots(articleId) || []; }  catch(e) { snapshots = []; }
  try { gscSummary = summarizeGscSnapshots(articleId);  }  catch(e) { gscSummary = null; }

  // C) decay detection
  var decay = null;
  try { decay = detectDecay(articleId, snapshots); } catch(e) {
    return safeReturn(articleId, 'decayDetector failed: ' + e.message);
  }

  var decayStatus           = (decay && decay.status)                 || 'unknown';
  var decayTypes            = (decay && decay.decayTypes)             || [];
  var recommendedActionHint = (decay && decay.recommendedActionHint)  || 'ignore';

  // D) lifecycle decision
  var decision = null;
  try {
    decision = runLifecycleDecision({
      articleId:   articleId,
      articleMeta: meta,
      decayReport: decay,
    });
  } catch(e) {
    return safeReturn(articleId, 'lifecycleDecisionEngine failed: ' + e.message);
  }

  var action     = (decision && decision.action)     || 'ignore';
  var priority   = (decision && decision.priority)   || 'low';
  var confidence = (decision && decision.confidence) || 0;
  var reason     = (decision && decision.reason)     || '';

  // E) action execution
  // MVP rules:
  //   healthy  → ignore (no write)
  //   watch    → decision only, no execute
  //   decaying → execute (unless safeMode)
  var execution = null;
  var shouldExecute = (decayStatus === 'decaying') && !safeMode;

  try {
    var execDecision = shouldExecute ? decision : Object.assign({}, decision, { action: 'ignore' });
    execution = await executeAction({
      articleId:     articleId,
      decision:      execDecision,
      articleRecord: article,
      _injected:     { safeMode: safeMode },
    });
  } catch(e) {
    execution = {
      executed:      false,
      executionMode: 'error',
      result:        { articleChanged: false, metadataChanged: false, newVersion: null, notes: [] },
      rollback:      { applied: false, reason: null },
      error:         e.message,
    };
  }

  // F) event log
  try {
    appendArticleEvent(articleId, {
      type:            'auto_optimization_run',
      decayStatus:     decayStatus,
      action:          action,
      executed:        (execution && execution.executed) || false,
      safeMode:        safeMode,
      rollbackApplied: (execution && execution.rollback && execution.rollback.applied) || false,
    });
  } catch(e) {}

  return {
    articleId: articleId,
    keyword:   keyword,
    error:     null,
    decay: {
      status:               decayStatus,
      decayTypes:           decayTypes,
      recommendedActionHint: recommendedActionHint,
    },
    decision: {
      action:     action,
      priority:   priority,
      confidence: confidence,
      reason:     reason,
    },
    execution: execution,
  };
}
