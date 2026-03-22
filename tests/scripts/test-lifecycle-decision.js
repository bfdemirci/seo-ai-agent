import * as runner  from '../lib/testRunner.js';
import * as log     from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';

const VALID_ACTIONS   = ['rewrite','refresh','meta_only','monitor','ignore','internal_link_boost','offpage_review'];
const VALID_PRIORITY  = ['low','medium','high'];
const VALID_BANDS     = ['none','low','medium','high'];
const VALID_AGE_BANDS = ['fresh','aging','old'];

runner.run('Lifecycle Decision Engine Test', async ({keyword}) => {

  const { runLifecycleDecision } = await runner.importAgent('services/decision/lifecycleDecisionEngine.js');

  function meta(opts) {
    opts = opts || {};
    var daysAgo = opts.daysAgo !== undefined ? opts.daysAgo : 30;
    var created = new Date(Date.now() - daysAgo * 86400000).toISOString();
    return {
      id: 'art_test', keyword: keyword,
      createdAt: created, updatedAt: created,
      currentVersion: 'v1', publishedUrl: 'https://example.com/seo-nedir',
      initialPosition: 5.0, finalization: null, latestEvaluation: null,
    };
  }

  function decay(opts) {
    opts = opts || {};
    var s = opts.status || 'healthy';
    var dt = opts.decayTypes || { ranking: false, ctr: false, clicks: false, impression: false, seasonal: false, insufficientData: false };
    var deltas = opts.deltas || { clicksDeltaPct: 0, impressionsDeltaPct: 0, ctrDeltaPct: 0, positionDelta: 0 };
    return {
      articleId: 'art_test', status: s, decayTypes: dt,
      evidence: { rowsAnalyzed: opts.rows || 28, latestDate: '2026-03-21', deltas: deltas,
                  baselineWindow: null, recentWindow: null, baseline: null, recent: null },
      confidence: opts.confidence || 0.75,
      summary: opts.summary || 'test',
      recommendedActionHint: opts.hint || 'monitor',
    };
  }

  function assertShape(r, label) {
    runner.assert(label + ' action valid',    VALID_ACTIONS.includes(r.action),  r.action);
    runner.assert(label + ' priority valid',  VALID_PRIORITY.includes(r.priority), r.priority);
    runner.assert(label + ' confidence 0-1',  r.confidence >= 0 && r.confidence <= 1, String(r.confidence));
    runner.assert(label + ' reason nonempty', r.reason && r.reason.length > 0);
    runner.assert(label + ' evidenceSummary', typeof r.evidenceSummary === 'object');
    runner.assert(label + ' thresholds',      typeof r.thresholdsTriggered === 'object');
    runner.assert(label + ' thresholds.ctr band',   VALID_BANDS.includes(r.thresholdsTriggered.ctr));
    runner.assert(label + ' thresholds.age band',   VALID_AGE_BANDS.includes(r.thresholdsTriggered.contentAge));
  }

  // ── 1. Healthy ─────────────────────────────────────────────────────────────
  log.section('1. Healthy article');
  var r1 = runLifecycleDecision({ articleId: 'art_test', articleMeta: meta({ daysAgo: 30 }), decayReport: decay({ status: 'healthy' }) });
  assertShape(r1, 'healthy');
  runner.assert('action ignore',  r1.action === 'ignore',   r1.action);
  runner.assert('priority low',   r1.priority === 'low',    r1.priority);
  log.info('action', r1.action); log.info('priority', r1.priority); log.info('confidence', r1.confidence);

  // ── 2. Insufficient data ───────────────────────────────────────────────────
  log.section('2. Insufficient data');
  var r2 = runLifecycleDecision({ articleId: 'art_test', articleMeta: meta({ daysAgo: 10 }),
    decayReport: decay({ status: 'watch', confidence: 0.3, rows: 4, decayTypes: { insufficientData: true, ranking: false, ctr: false, clicks: false, impression: false, seasonal: false } }) });
  assertShape(r2, 'insufficient');
  runner.assert('action monitor or ignore', r2.action === 'monitor' || r2.action === 'ignore', r2.action);
  runner.assert('confidence low',           r2.confidence <= 0.45);
  log.info('action', r2.action); log.info('confidence', r2.confidence);

  // ── 3. CTR decay only ─────────────────────────────────────────────────────
  log.section('3. CTR decay only → meta_only');
  var r3 = runLifecycleDecision({ articleId: 'art_test', articleMeta: meta({ daysAgo: 60 }),
    decayReport: decay({ status: 'decaying', confidence: 0.8,
      decayTypes: { ranking: false, ctr: true, clicks: false, impression: false, seasonal: false, insufficientData: false },
      deltas: { clicksDeltaPct: -5, impressionsDeltaPct: -3, ctrDeltaPct: -35, positionDelta: 0.2 } }) });
  assertShape(r3, 'ctr_only');
  runner.assert('action meta_only',  r3.action === 'meta_only',  r3.action);
  log.info('action', r3.action); log.info('priority', r3.priority); log.info('ctrBand', r3.thresholdsTriggered.ctr);

  // ── 4. Ranking decay, fresh content ───────────────────────────────────────
  log.section('4. Ranking decay, fresh → offpage_review');
  var r4 = runLifecycleDecision({ articleId: 'art_test', articleMeta: meta({ daysAgo: 30 }),
    decayReport: decay({ status: 'watch', confidence: 0.7,
      decayTypes: { ranking: true, ctr: false, clicks: false, impression: false, seasonal: false, insufficientData: false },
      deltas: { clicksDeltaPct: -5, impressionsDeltaPct: -3, ctrDeltaPct: -2, positionDelta: 4.5 } }) });
  assertShape(r4, 'ranking_fresh');
  runner.assert('action offpage_review', r4.action === 'offpage_review', r4.action);
  log.info('action', r4.action); log.info('positionBand', r4.thresholdsTriggered.position); log.info('ageBand', r4.thresholdsTriggered.contentAge);

  // ── 5. Old content, ranking stable ────────────────────────────────────────
  log.section('5. Old content, ranking stable → refresh');
  var r5 = runLifecycleDecision({ articleId: 'art_test', articleMeta: meta({ daysAgo: 200 }),
    decayReport: decay({ status: 'healthy', confidence: 0.8 }) });
  assertShape(r5, 'old_stable');
  runner.assert('action refresh or ignore', ['refresh','ignore'].includes(r5.action), r5.action);
  runner.assert('age band old',  r5.thresholdsTriggered.contentAge === 'old');
  log.info('action', r5.action); log.info('ageBand', r5.thresholdsTriggered.contentAge);

  // ── 6. Old content + ranking down ─────────────────────────────────────────
  log.section('6. Old content + ranking down → refresh/rewrite');
  var r6 = runLifecycleDecision({ articleId: 'art_test', articleMeta: meta({ daysAgo: 210 }),
    decayReport: decay({ status: 'decaying', confidence: 0.85,
      decayTypes: { ranking: true, ctr: true, clicks: false, impression: false, seasonal: false, insufficientData: false },
      deltas: { clicksDeltaPct: -12, impressionsDeltaPct: -10, ctrDeltaPct: -25, positionDelta: 5.0 } }) });
  assertShape(r6, 'old_ranking');
  runner.assert('action refresh or rewrite', ['refresh','rewrite'].includes(r6.action), r6.action);
  runner.assert('priority medium or high',   ['medium','high'].includes(r6.priority), r6.priority);
  log.info('action', r6.action); log.info('priority', r6.priority);

  // ── 7. Strong clicks + impressions decay ──────────────────────────────────
  log.section('7. Clicks + impressions decay → refresh');
  var r7 = runLifecycleDecision({ articleId: 'art_test', articleMeta: meta({ daysAgo: 90 }),
    decayReport: decay({ status: 'decaying', confidence: 0.88,
      decayTypes: { ranking: false, ctr: false, clicks: true, impression: true, seasonal: false, insufficientData: false },
      deltas: { clicksDeltaPct: -40, impressionsDeltaPct: -38, ctrDeltaPct: -5, positionDelta: 0.3 } }) });
  assertShape(r7, 'clicks_imp');
  runner.assert('action refresh', r7.action === 'refresh', r7.action);
  log.info('action', r7.action); log.info('clicksBand', r7.thresholdsTriggered.clicks);

  // ── 8. Multi-signal severe decay ──────────────────────────────────────────
  log.section('8. Multi-signal severe decay → rewrite/refresh high');
  var r8 = runLifecycleDecision({ articleId: 'art_test', articleMeta: meta({ daysAgo: 50 }),
    decayReport: decay({ status: 'decaying', confidence: 0.92,
      decayTypes: { ranking: true, ctr: true, clicks: true, impression: true, seasonal: false, insufficientData: false },
      deltas: { clicksDeltaPct: -55, impressionsDeltaPct: -50, ctrDeltaPct: -40, positionDelta: 6.0 } }) });
  assertShape(r8, 'multisignal');
  runner.assert('action rewrite or refresh', ['rewrite','refresh'].includes(r8.action), r8.action);
  runner.assert('priority high',             r8.priority === 'high', r8.priority);
  log.info('action', r8.action); log.info('priority', r8.priority); log.info('confidence', r8.confidence);

  // ── 9. Output shape full validation ───────────────────────────────────────
  log.section('9. Full output shape validation');
  var r9 = runLifecycleDecision({ articleId: 'art_test', articleMeta: meta(), decayReport: decay() });
  runner.assert('has articleId',            r9.articleId === 'art_test');
  runner.assert('has action',               typeof r9.action === 'string');
  runner.assert('has reason',               typeof r9.reason === 'string');
  runner.assert('has confidence',           typeof r9.confidence === 'number');
  runner.assert('has priority',             typeof r9.priority === 'string');
  runner.assert('has evidenceSummary',      typeof r9.evidenceSummary === 'object');
  runner.assert('evidenceSummary.status',   typeof r9.evidenceSummary.status === 'string');
  runner.assert('evidenceSummary.ageDays',  typeof r9.evidenceSummary.contentAgeDays === 'number');
  runner.assert('has thresholdsTriggered',  typeof r9.thresholdsTriggered === 'object');
  runner.assert('thresholds.ctr',           VALID_BANDS.includes(r9.thresholdsTriggered.ctr));
  runner.assert('thresholds.clicks',        VALID_BANDS.includes(r9.thresholdsTriggered.clicks));
  runner.assert('thresholds.position',      VALID_BANDS.includes(r9.thresholdsTriggered.position));
  runner.assert('thresholds.contentAge',    VALID_AGE_BANDS.includes(r9.thresholdsTriggered.contentAge));
  log.info('all fields present', 'OK');
});
