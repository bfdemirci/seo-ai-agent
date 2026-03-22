import * as runner  from '../lib/testRunner.js';
import * as log     from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';

const VALID_HINTS = ['monitor','refresh_candidate','meta_candidate','offpage_candidate','ignore'];

runner.run('Decay Detector Test', async ({keyword}) => {

  const { createArticleRecord } = await runner.importAgent('repositories/articleRepository.js');
  const { detectDecay }        = await runner.importAgent('services/decision/decayDetector.js');

  const article   = fixture.load(keyword, 'article');
  const outline   = fixture.load(keyword, 'outline');
  const articleId = createArticleRecord({ keyword, article, outline });
  runner.assertNonEmpty('articleId created', articleId);

  function makeRows(n, overrides) {
    overrides = overrides || {};
    return Array.from({ length: n }, function(_, i) {
      const d = new Date('2026-01-01');
      d.setDate(d.getDate() + i);
      return {
        date:        d.toISOString().slice(0,10),
        page:        '/seo-nedir',
        query:       'seo nedir',
        clicks:      overrides.clicks      !== undefined ? overrides.clicks      : 100,
        impressions: overrides.impressions !== undefined ? overrides.impressions : 3000,
        ctr:         overrides.ctr         !== undefined ? overrides.ctr         : 0.033,
        position:    overrides.position    !== undefined ? overrides.position    : 5.0,
        source: 'gsc',
      };
    });
  }

  function makeDecayRows(baseVal, recentVal) {
    // 14 baseline + 14 recent = 28 rows
    var base   = Array.from({ length: 14 }, function(_, i) {
      var d = new Date('2026-01-01'); d.setDate(d.getDate() + i);
      return Object.assign({ date: d.toISOString().slice(0,10), page: '/seo-nedir', query: 'seo nedir', source: 'gsc' }, baseVal);
    });
    var recent = Array.from({ length: 14 }, function(_, i) {
      var d = new Date('2026-01-15'); d.setDate(d.getDate() + i);
      return Object.assign({ date: d.toISOString().slice(0,10), page: '/seo-nedir', query: 'seo nedir', source: 'gsc' }, recentVal);
    });
    return base.concat(recent);
  }

  function assertShape(r, label) {
    runner.assert(label + ' has status',     typeof r.status === 'string');
    runner.assert(label + ' has decayTypes', typeof r.decayTypes === 'object');
    runner.assert(label + ' has evidence',   typeof r.evidence === 'object');
    runner.assert(label + ' confidence 0-1', r.confidence >= 0 && r.confidence <= 1, String(r.confidence));
    runner.assert(label + ' summary nonempty', r.summary && r.summary.length > 0);
    runner.assert(label + ' hint valid',     VALID_HINTS.includes(r.recommendedActionHint), r.recommendedActionHint);
  }

  // ── 1. Insufficient data ─────────────────────────────────────────────────
  log.section('1. Insufficient data');
  var r1 = detectDecay(articleId, makeRows(4));
  assertShape(r1, 'insufficient');
  runner.assert('status is watch',         r1.status === 'watch');
  runner.assert('insufficientData true',   r1.decayTypes.insufficientData === true);
  runner.assert('hint is ignore',          r1.recommendedActionHint === 'ignore');
  log.info('status', r1.status);
  log.info('hint',   r1.recommendedActionHint);

  // ── 2. Healthy ───────────────────────────────────────────────────────────
  log.section('2. Healthy — stable metrics 28 rows');
  var r2 = detectDecay(articleId, makeRows(28));
  assertShape(r2, 'healthy');
  runner.assert('status healthy', r2.status === 'healthy');
  runner.assert('no decay flags', !r2.decayTypes.clicks && !r2.decayTypes.ranking && !r2.decayTypes.ctr);
  runner.assert('hint ignore',    r2.recommendedActionHint === 'ignore');
  log.info('status',     r2.status);
  log.info('confidence', r2.confidence);
  log.info('deltas clicksDeltaPct', r2.evidence.deltas.clicksDeltaPct);

  // ── 3. CTR decay → meta_candidate ────────────────────────────────────────
  log.section('3. CTR decay → meta_candidate');
  var r3 = detectDecay(articleId, makeDecayRows(
    { clicks: 150, impressions: 3000, ctr: 0.05, position: 5.0 },
    { clicks: 90,  impressions: 3100, ctr: 0.029, position: 5.1 }
  ));
  assertShape(r3, 'ctr_decay');
  runner.assert('ctr decay true',        r3.decayTypes.ctr === true, 'ctrDeltaPct: ' + (r3.evidence.deltas && r3.evidence.deltas.ctrDeltaPct));
  runner.assert('ranking not decaying',  r3.decayTypes.ranking === false);
  runner.assert('hint meta_candidate',   r3.recommendedActionHint === 'meta_candidate', r3.recommendedActionHint);
  log.info('status',       r3.status);
  log.info('ctrDeltaPct',  r3.evidence.deltas.ctrDeltaPct);
  log.info('hint',         r3.recommendedActionHint);

  // ── 4. Ranking decay → offpage_candidate ─────────────────────────────────
  log.section('4. Ranking decay → offpage_candidate');
  var r4 = detectDecay(articleId, makeDecayRows(
    { clicks: 100, impressions: 3000, ctr: 0.033, position: 4.0 },
    { clicks: 95,  impressions: 2900, ctr: 0.033, position: 9.5 }
  ));
  assertShape(r4, 'ranking_decay');
  runner.assert('ranking decay true',      r4.decayTypes.ranking === true, 'positionDelta: ' + (r4.evidence.deltas && r4.evidence.deltas.positionDelta));
  runner.assert('hint offpage_candidate',  r4.recommendedActionHint === 'offpage_candidate', r4.recommendedActionHint);
  log.info('status',        r4.status);
  log.info('positionDelta', r4.evidence.deltas.positionDelta);
  log.info('hint',          r4.recommendedActionHint);

  // ── 5. Clicks + impressions decay → refresh_candidate ────────────────────
  log.section('5. Clicks + impressions decay → refresh_candidate');
  var r5 = detectDecay(articleId, makeDecayRows(
    { clicks: 300, impressions: 6000, ctr: 0.05, position: 4.0 },
    { clicks: 180, impressions: 3500, ctr: 0.051, position: 4.2 }
  ));
  assertShape(r5, 'refresh');
  runner.assert('clicks decay true',      r5.decayTypes.clicks === true,     'clicksDeltaPct: ' + (r5.evidence.deltas && r5.evidence.deltas.clicksDeltaPct));
  runner.assert('impression decay true',  r5.decayTypes.impression === true,  'impressionsDeltaPct: ' + (r5.evidence.deltas && r5.evidence.deltas.impressionsDeltaPct));
  runner.assert('hint refresh_candidate', r5.recommendedActionHint === 'refresh_candidate', r5.recommendedActionHint);
  log.info('status',              r5.status);
  log.info('clicksDeltaPct',      r5.evidence.deltas.clicksDeltaPct);
  log.info('impressionsDeltaPct', r5.evidence.deltas.impressionsDeltaPct);
  log.info('hint',                r5.recommendedActionHint);

  // ── 6. deltas are numbers ─────────────────────────────────────────────────
  log.section('6. Evidence shape validation');
  var r6 = detectDecay(articleId, makeRows(28));
  runner.assert('deltas object',           r6.evidence.deltas !== null && typeof r6.evidence.deltas === 'object');
  runner.assert('clicksDeltaPct number',   typeof r6.evidence.deltas.clicksDeltaPct === 'number' || r6.evidence.deltas.clicksDeltaPct === null);
  runner.assert('positionDelta number',    typeof r6.evidence.deltas.positionDelta === 'number');
  runner.assert('baseline.clicks number',  typeof r6.evidence.baseline.clicks === 'number');
  runner.assert('recent.position number',  typeof r6.evidence.recent.position === 'number');
  runner.assert('rowsAnalyzed number',     typeof r6.evidence.rowsAnalyzed === 'number');
  runner.assert('latestDate string',       typeof r6.evidence.latestDate === 'string');
  log.info('rowsAnalyzed',    r6.evidence.rowsAnalyzed);
  log.info('latestDate',      r6.evidence.latestDate);
  log.info('baseline.clicks', r6.evidence.baseline.clicks);
  log.info('recent.position', r6.evidence.recent.position);
});

process.exit(0);
