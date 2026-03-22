import * as runner  from '../lib/testRunner.js';
import * as log     from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';

runner.run('Semrush Integration Test', async ({keyword}) => {

  const { getKeywordIntel } = await runner.importAgent('services/seo/semrush.service.js');
  const { fetchKeywordOverview } = await runner.importAgent('providers/semrushProvider.js');

  // ── 1. Mock mode (no API key) ──────────────────────────────────────────────
  log.section('1. Mock mode — no API key');
  var saved = process.env.SEMRUSH_API_KEY;
  delete process.env.SEMRUSH_API_KEY;
  var r1 = await getKeywordIntel(keyword);
  if (saved) process.env.SEMRUSH_API_KEY = saved;

  runner.assert('returns object',           typeof r1 === 'object');
  runner.assert('keyword matches',          r1.keyword === keyword);
  runner.assert('volume number',            typeof r1.volume === 'number');
  runner.assert('keywordDifficulty number', typeof r1.keywordDifficulty === 'number');
  runner.assert('cpc number',               typeof r1.cpc === 'number');
  runner.assert('competition number',       typeof r1.competition === 'number');
  runner.assert('relatedKeywords array',    Array.isArray(r1.relatedKeywords));
  runner.assert('competitors array',        Array.isArray(r1.competitors));
  log.info('volume',            r1.volume);
  log.info('keywordDifficulty', r1.keywordDifficulty);
  log.info('cpc',               r1.cpc);
  log.info('relatedKeywords',   r1.relatedKeywords.length);
  log.info('competitors',       r1.competitors.length);

  // ── 2. Shape validation ────────────────────────────────────────────────────
  log.section('2. Shape validation');
  runner.assert('volume >= 0',                    r1.volume >= 0);
  runner.assert('keywordDifficulty 0-100',        r1.keywordDifficulty >= 0 && r1.keywordDifficulty <= 100);
  runner.assert('competition 0-1',                r1.competition >= 0 && r1.competition <= 1);
  runner.assert('relatedKeywords[0] has keyword', !r1.relatedKeywords.length || typeof r1.relatedKeywords[0].keyword === 'string');
  runner.assert('competitors[0] has domain',      !r1.competitors.length || typeof r1.competitors[0].domain === 'string');
  log.info('shape OK', 'all fields valid');

  // ── 3. Custom mock injected fetcher ────────────────────────────────────────
  log.section('3. Custom injected fetcher');
  var mockFetcher = async function(kw) {
    return {
      keyword: kw, volume: 9999, keywordDifficulty: 75, cpc: 1.20, competition: 0.85,
      relatedKeywords: [{ keyword: 'test keyword', volume: 1000, difficulty: 50 }],
      competitors: [{ domain: 'test.com', trafficEstimate: 5000 }],
    };
  };
  var r3 = await getKeywordIntel(keyword, { fetcher: mockFetcher });
  runner.assert('injected volume',      r3.volume === 9999,  'got: ' + r3.volume);
  runner.assert('injected difficulty',  r3.keywordDifficulty === 75);
  runner.assert('injected related[0]',  r3.relatedKeywords[0].keyword === 'test keyword');
  log.info('injected volume', r3.volume);

  // ── 4. Failure safety ─────────────────────────────────────────────────────
  log.section('4. Failure safety — provider throws');
  var errorFetcher = async function() { throw new Error('API unavailable'); };
  var r4 = await getKeywordIntel(keyword, { fetcher: errorFetcher });
  runner.assert('returns object on error',  typeof r4 === 'object');
  runner.assert('has volume on error',      typeof r4.volume === 'number');
  runner.assert('has arrays on error',      Array.isArray(r4.relatedKeywords));
  log.info('safe fallback volume', r4.volume);

  // ── 5. Research pipeline integration ──────────────────────────────────────
  log.section('5. Research pipeline — semrush in research output');
  if (!fixture.exists(keyword, 'research')) {
    log.warn('no research fixture', 'skipping pipeline integration test');
    runner.assert('research fixture skip', true, 'skipped');
  } else {
    var research = fixture.load(keyword, 'research');
    var researchData = research.structured || research;
    runner.assert('research.semrush exists', typeof researchData.semrush === 'object' || researchData.semrush !== undefined, 'semrush: ' + typeof researchData.semrush);
    if (researchData.semrush) {
      runner.assert('semrush.volume present', typeof researchData.semrush.volume === 'number', 'vol: ' + researchData.semrush.volume);
      log.info('semrush.volume',            researchData.semrush.volume);
      log.info('semrush.keywordDifficulty', researchData.semrush.keywordDifficulty);
    }
  }
});
