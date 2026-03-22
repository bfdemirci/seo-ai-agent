import {
  classifyCtr, classifyClicks, classifyPosition, classifyAge,
  contentAgeDays, signalCount, VALID_ACTIONS,
} from './decisionRules.js';

export function runLifecycleDecision({ articleId, articleMeta, decayReport }) {

  const decayTypes = decayReport.decayTypes || {};
  const evidence   = decayReport.evidence   || {};
  const deltas     = evidence.deltas         || {};
  const status     = decayReport.status      || 'healthy';

  // ── Classify thresholds ────────────────────────────────────────────────────
  const ctrBand      = classifyCtr(deltas.ctrDeltaPct);
  const clicksBand   = classifyClicks(deltas.clicksDeltaPct);
  const positionBand = classifyPosition(deltas.positionDelta);
  const ageDays      = contentAgeDays(articleMeta && (articleMeta.createdAt));
  const ageBand      = classifyAge(ageDays);

  const thresholdsTriggered = {
    ctr:        ctrBand,
    clicks:     clicksBand,
    position:   positionBand,
    contentAge: ageBand,
  };

  const evidenceSummary = {
    status,
    decayTypes,
    clicksDeltaPct:      deltas.clicksDeltaPct      || null,
    impressionsDeltaPct: deltas.impressionsDeltaPct || null,
    ctrDeltaPct:         deltas.ctrDeltaPct         || null,
    positionDelta:       deltas.positionDelta        || null,
    contentAgeDays:      ageDays,
  };

  const signals = signalCount(decayTypes);
  const insufficientData = !!decayTypes.insufficientData;

  // ── Decision matrix ────────────────────────────────────────────────────────
  let action, reason, priority, confidence;

  if (insufficientData || status === 'watch' && signals === 0 && decayReport.confidence < 0.35) {
    action     = 'monitor';
    reason     = 'Insufficient or inconclusive data — monitor and wait for more snapshots.';
    priority   = 'low';
    confidence = Math.min(decayReport.confidence || 0.3, 0.4);
  }
  else if (status === 'healthy') {
    action     = 'ignore';
    reason     = 'Article is performing well — no action needed.';
    priority   = 'low';
    confidence = Math.max(decayReport.confidence || 0.7, 0.6);
  }
  else if (decayTypes.ctr && !decayTypes.ranking && !decayTypes.clicks) {
    // CTR decay, ranking stable — meta/title issue
    action     = 'meta_only';
    reason     = 'CTR is declining while ranking and clicks are stable — update title/meta description.';
    priority   = ctrBand === 'high' ? 'high' : 'medium';
    confidence = decayReport.confidence || 0.7;
  }
  else if (decayTypes.ranking && !decayTypes.clicks && !decayTypes.impression && ageBand === 'fresh') {
    // Ranking slipping, content still new — off-page issue
    action     = 'offpage_review';
    reason     = 'Ranking dropped but content is fresh — review backlinks and off-page signals.';
    priority   = positionBand === 'high' ? 'high' : 'medium';
    confidence = decayReport.confidence || 0.65;
  }
  else if (decayTypes.ranking && !decayTypes.clicks && !decayTypes.impression && ageBand !== 'fresh') {
    // Ranking down, older content
    action     = 'refresh';
    reason     = 'Ranking declined and content is aging — a content refresh may restore relevance.';
    priority   = 'medium';
    confidence = decayReport.confidence || 0.65;
  }
  else if (decayTypes.clicks && decayTypes.impression && !decayTypes.ranking) {
    // Clicks + impressions down, position stable — content demand drop
    action     = 'refresh';
    reason     = 'Clicks and impressions fell together — content may have lost demand or relevance.';
    priority   = clicksBand === 'high' ? 'high' : 'medium';
    confidence = decayReport.confidence || 0.7;
  }
  else if (ageBand === 'old' && signals >= 2) {
    // Old content + multiple decay signals
    const isStrong = signals >= 3 || (positionBand === 'high' && clicksBand === 'high');
    action     = isStrong ? 'rewrite' : 'refresh';
    reason     = isStrong
      ? 'Multiple strong decay signals on old content — full rewrite recommended.'
      : 'Old content with multiple decay signals — refresh to restore performance.';
    priority   = 'high';
    confidence = Math.min((decayReport.confidence || 0.7) + 0.1, 0.95);
  }
  else if (ageBand === 'old' && signals <= 1) {
    action     = 'refresh';
    reason     = 'Content is old — proactive refresh recommended even without strong decay.';
    priority   = 'medium';
    confidence = 0.6;
  }
  else if (signals >= 3) {
    action     = 'rewrite';
    reason     = 'Severe multi-signal decay detected — full rewrite recommended.';
    priority   = 'high';
    confidence = Math.min((decayReport.confidence || 0.8) + 0.1, 0.95);
  }
  else if (status === 'decaying') {
    action     = 'refresh';
    reason     = 'Decay detected — content refresh is the recommended next step.';
    priority   = 'medium';
    confidence = decayReport.confidence || 0.65;
  }
  else {
    // watch level, moderate
    action     = 'monitor';
    reason     = 'Mild negative trends — continue monitoring before taking action.';
    priority   = 'low';
    confidence = Math.min(decayReport.confidence || 0.45, 0.55);
  }

  confidence = parseFloat(Math.min(Math.max(confidence, 0), 1).toFixed(2));

  return {
    articleId,
    action,
    reason,
    confidence,
    priority,
    evidenceSummary,
    thresholdsTriggered,
  };
}
