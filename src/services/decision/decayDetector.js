import { getGscSnapshots } from '../../repositories/gscSnapshotRepository.js';
import { sum, weightedAvgPosition, weightedCtr, deltaPct, filterWindow } from '../../utils/metrics.js';

const MIN_ROWS = 7;
const BASELINE_DAYS = 14;
const RECENT_DAYS   = 14;

const T = {
  clicks:      { watch: -15, decay: -30 },
  impressions: { watch: -20, decay: -35 },
  ctr:         { watch: -10, decay: -20 },
  ranking:     { watch: 1.5, decay: 3.0 },
};

function buildWindows(rows) {
  const sorted     = [...rows].sort((a, b) => a.date > b.date ? 1 : -1);
  const latestDate = sorted[sorted.length - 1].date;

  const latest = new Date(latestDate);

  const recentEnd   = latestDate;
  const recentStart = new Date(latest);
  recentStart.setDate(recentStart.getDate() - RECENT_DAYS + 1);

  const baselineEnd   = new Date(recentStart);
  baselineEnd.setDate(baselineEnd.getDate() - 1);

  const baselineStart = new Date(baselineEnd);
  baselineStart.setDate(baselineStart.getDate() - BASELINE_DAYS + 1);

  return {
    latestDate,
    recentWindow:   { start: recentStart.toISOString().slice(0,10),   end: recentEnd },
    baselineWindow: { start: baselineStart.toISOString().slice(0,10), end: baselineEnd.toISOString().slice(0,10) },
  };
}

function aggregateWindow(rows) {
  const clicks      = parseFloat(sum(rows, 'clicks').toFixed(2));
  const impressions = parseFloat(sum(rows, 'impressions').toFixed(2));
  const ctr         = parseFloat(weightedCtr(rows).toFixed(6));
  const position    = parseFloat(weightedAvgPosition(rows).toFixed(2));
  return { clicks, impressions, ctr, position };
}

export function detectDecay(articleId, rows, opts) {
  opts = opts || {};

  if (!rows || rows.length < MIN_ROWS) {
    return {
      articleId,
      status: 'watch',
      decayTypes: { ranking: false, ctr: false, clicks: false, impression: false, seasonal: false, insufficientData: true },
      evidence: { rowsAnalyzed: rows ? rows.length : 0, latestDate: null, baselineWindow: null, recentWindow: null, baseline: null, recent: null, deltas: null },
      confidence: parseFloat(Math.max(0, 0.5 - 0.20).toFixed(2)),
      summary: 'Not enough data to detect decay confidently.',
      recommendedActionHint: 'ignore',
    };
  }

  const { latestDate, recentWindow, baselineWindow } = buildWindows(rows);

  const baselineRows = filterWindow(rows, baselineWindow.start, baselineWindow.end);
  const recentRows   = filterWindow(rows, recentWindow.start,   recentWindow.end);

  if (!baselineRows.length || !recentRows.length) {
    return {
      articleId,
      status: 'watch',
      decayTypes: { ranking: false, ctr: false, clicks: false, impression: false, seasonal: false, insufficientData: true },
      evidence: { rowsAnalyzed: rows.length, latestDate, baselineWindow, recentWindow, baseline: null, recent: null, deltas: null },
      confidence: 0.30,
      summary: 'Not enough data in one of the comparison windows.',
      recommendedActionHint: 'ignore',
    };
  }

  const baseline = aggregateWindow(baselineRows);
  const recent   = aggregateWindow(recentRows);

  const deltas = {
    clicksDeltaPct:      deltaPct(baseline.clicks,      recent.clicks),
    impressionsDeltaPct: deltaPct(baseline.impressions, recent.impressions),
    ctrDeltaPct:         deltaPct(baseline.ctr,         recent.ctr),
    positionDelta:       parseFloat((recent.position - baseline.position).toFixed(2)),
  };

  const decayTypes = {
    ranking:          deltas.positionDelta      >= T.ranking.decay,
    ctr:              (deltas.ctrDeltaPct       || 0) <= T.ctr.decay,
    clicks:           (deltas.clicksDeltaPct    || 0) <= T.clicks.decay,
    impression:       (deltas.impressionsDeltaPct || 0) <= T.impressions.decay,
    seasonal:         false,
    insufficientData: false,
  };

  const watchFlags = {
    ranking:    deltas.positionDelta      >= T.ranking.watch,
    ctr:        (deltas.ctrDeltaPct       || 0) <= T.ctr.watch,
    clicks:     (deltas.clicksDeltaPct    || 0) <= T.clicks.watch,
    impression: (deltas.impressionsDeltaPct || 0) <= T.impressions.watch,
  };

  const decayCount = Object.values(decayTypes).filter(Boolean).length;

  let status;
  if (decayCount >= 2)       status = 'decaying';
  else if (decayCount === 1) status = 'watch';
  else if (Object.values(watchFlags).some(Boolean)) status = 'watch';
  else                       status = 'healthy';

  // confidence
  let confidence = 0.5;
  if (rows.length >= 14) confidence += 0.15;
  if (rows.length >= 28) confidence += 0.10;
  if (decayCount >= 2)   confidence += 0.10;
  if (baseline.impressions > 0 && recent.impressions > 0) confidence += 0.10;
  confidence = parseFloat(Math.min(confidence, 0.95).toFixed(2));

  // summary
  let summary;
  if (status === 'healthy') {
    summary = 'Article is healthy with stable clicks and position.';
  } else if (decayTypes.ranking && decayTypes.ctr) {
    summary = 'Ranking and CTR declined across the recent window.';
  } else if (decayTypes.clicks && decayTypes.impression) {
    summary = 'Clicks and impressions both dropped significantly.';
  } else if (decayTypes.ctr) {
    summary = 'CTR dropped while ranking stayed stable; monitor title/meta.';
  } else if (decayTypes.ranking) {
    summary = 'Ranking worsened significantly; off-page signals may need attention.';
  } else if (decayTypes.clicks) {
    summary = 'Click volume dropped; content refresh may be needed.';
  } else {
    summary = 'Performance is trending down — monitoring recommended.';
  }

  // hint
  let recommendedActionHint;
  if (status === 'healthy') {
    recommendedActionHint = 'ignore';
  } else if (decayTypes.ctr && !decayTypes.ranking) {
    recommendedActionHint = 'meta_candidate';
  } else if (decayTypes.ranking && !decayTypes.ctr) {
    recommendedActionHint = 'offpage_candidate';
  } else if (decayTypes.clicks && decayTypes.impression) {
    recommendedActionHint = 'refresh_candidate';
  } else {
    recommendedActionHint = 'monitor';
  }

  return {
    articleId,
    status,
    decayTypes,
    evidence: { rowsAnalyzed: rows.length, latestDate, baselineWindow, recentWindow, baseline, recent, deltas },
    confidence,
    summary,
    recommendedActionHint,
  };
}

export async function detectDecayForArticle(articleId, opts) {
  const rows = getGscSnapshots(articleId);
  return detectDecay(articleId, rows, opts);
}
