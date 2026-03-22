import * as runner  from '../lib/testRunner.js';
import * as log     from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';

const VALID_ACTIONS = ['monitor','refresh_candidate','rewrite_candidate','meta_candidate','offpage_candidate','ignore','generate','skip'];
const VALID_STATUS  = ['healthy','watch','decaying','unknown'];

runner.run('Auto Growth Orchestrator Test', async ({keyword}) => {

  const { runAutoGrowth } = await runner.importAgent('services/orchestrator/autoGrowthOrchestrator.js');
  const { createArticleRecord } = await runner.importAgent('repositories/articleRepository.js');

  // Bootstrap: create a test article in storage
  var article = fixture.load(keyword, 'article');
  var outline  = fixture.load(keyword, 'outline');
  var artId    = createArticleRecord({ keyword, article, outline });
  runner.assertNonEmpty('test articleId', artId);
  log.info('test article', artId);

  // ── 1. opportunity_scan — dedupe ──────────────────────────────────────────
  log.section('1. opportunity_scan — dedupe');
  var r1 = await runAutoGrowth({
    mode:     'opportunity_scan',
    keywords: ['seo nedir', 'SEO Nedir', 'teknik seo', 'teknik seo', 'local seo'],
    site:     'example.com',
  });
  runner.assert('mode is opportunity_scan', r1.mode === 'opportunity_scan');
  runner.assert('startedAt present',        typeof r1.startedAt === 'string');
  runner.assert('finishedAt present',       typeof r1.finishedAt === 'string');
  runner.assert('durationMs number',        typeof r1.durationMs === 'number');
  // 5 raw → 3 unique after dedupe: "seo nedir", "teknik seo", "local seo"
  runner.assert('totalKeywordsInput 3',     r1.summary.totalKeywordsInput === 3, 'got: '+r1.summary.totalKeywordsInput);
  runner.assert('candidates array',         Array.isArray(r1.candidates));
  log.info('totalKeywordsInput', r1.summary.totalKeywordsInput);
  log.info('candidates', r1.candidates.length);

  // ── 2. existing keyword → skip ────────────────────────────────────────────
  log.section('2. existing keyword → skip');
  var existingCand = r1.candidates.find(function(c){return c.keyword==='seo nedir';});
  runner.assert('seo nedir candidate exists',   !!existingCand);
  runner.assert('seo nedir existsAlready true', existingCand && existingCand.existsAlready === true, existingCand && String(existingCand.existsAlready));
  runner.assert('seo nedir action skip',        existingCand && existingCand.recommendedAction === 'skip', existingCand && existingCand.recommendedAction);
  log.info('seo nedir action', existingCand && existingCand.recommendedAction);

  // ── 3. new keyword → generate ─────────────────────────────────────────────
  log.section('3. new keyword → generate');
  var newCand = r1.candidates.find(function(c){return c.keyword==='teknik seo';});
  runner.assert('teknik seo candidate exists',      !!newCand);
  runner.assert('teknik seo existsAlready false',   newCand && newCand.existsAlready === false, String(newCand && newCand.existsAlready));
  runner.assert('teknik seo action generate',       newCand && newCand.recommendedAction === 'generate', newCand && newCand.recommendedAction);
  runner.assert('teknik seo source input',          newCand && newCand.source === 'input');
  runner.assert('totalCandidates >= 1',             r1.summary.totalCandidates >= 1, 'got: '+r1.summary.totalCandidates);
  log.info('teknik seo action', newCand && newCand.recommendedAction);
  log.info('totalCandidates', r1.summary.totalCandidates);

  // ── 4. article_maintenance loads stored articles ───────────────────────────
  log.section('4. article_maintenance');
  var r4 = await runAutoGrowth({ mode: 'article_maintenance' });
  runner.assert('mode article_maintenance',         r4.mode === 'article_maintenance');
  runner.assert('maintenance array',                Array.isArray(r4.maintenance));
  runner.assert('totalExistingArticles > 0',        r4.summary.totalExistingArticles > 0, 'got: '+r4.summary.totalExistingArticles);
  runner.assert('totalArticlesChecked > 0',         r4.summary.totalArticlesChecked > 0, 'got: '+r4.summary.totalArticlesChecked);
  log.info('totalExistingArticles', r4.summary.totalExistingArticles);
  log.info('totalArticlesChecked',  r4.summary.totalArticlesChecked);
  log.info('maintenance items',     r4.maintenance.length);

  // ── 5. maintenance classifies status ──────────────────────────────────────
  log.section('5. maintenance classifies healthy/watch/decaying');
  runner.assert('maintenance has items',    r4.maintenance.length > 0);
  r4.maintenance.forEach(function(m) {
    runner.assert('status valid: '+m.keyword, VALID_STATUS.includes(m.status), m.status);
    runner.assert('action valid: '+m.keyword, VALID_ACTIONS.includes(m.recommendedAction), m.recommendedAction);
    runner.assert('has articleId',  typeof m.articleId === 'string');
    runner.assert('has keyword',    typeof m.keyword === 'string');
  });
  var totalClass = r4.summary.totalDecaying + r4.summary.totalWatch + r4.summary.totalHealthy;
  runner.assert('counts sum to checked', totalClass === r4.summary.totalArticlesChecked, totalClass+' vs '+r4.summary.totalArticlesChecked);
  log.info('healthy',  r4.summary.totalHealthy);
  log.info('watch',    r4.summary.totalWatch);
  log.info('decaying', r4.summary.totalDecaying);

  // ── 6. full_cycle merges both ─────────────────────────────────────────────
  log.section('6. full_cycle merges both');
  var r6 = await runAutoGrowth({
    mode:     'full_cycle',
    keywords: ['content marketing', 'email marketing'],
    site:     'example.com',
  });
  runner.assert('mode full_cycle',           r6.mode === 'full_cycle');
  runner.assert('has candidates',            Array.isArray(r6.candidates) && r6.candidates.length > 0);
  runner.assert('has maintenance',           Array.isArray(r6.maintenance) && r6.maintenance.length > 0);
  runner.assert('totalKeywordsInput 2',      r6.summary.totalKeywordsInput === 2, 'got: '+r6.summary.totalKeywordsInput);
  runner.assert('totalExistingArticles > 0', r6.summary.totalExistingArticles > 0);
  log.info('candidates', r6.candidates.length);
  log.info('maintenance', r6.maintenance.length);

  // ── 7. summary counts ─────────────────────────────────────────────────────
  log.section('7. summary shape validation');
  runner.assert('summary.totalKeywordsInput number',    typeof r6.summary.totalKeywordsInput === 'number');
  runner.assert('summary.totalCandidates number',       typeof r6.summary.totalCandidates === 'number');
  runner.assert('summary.totalExistingArticles number', typeof r6.summary.totalExistingArticles === 'number');
  runner.assert('summary.totalArticlesChecked number',  typeof r6.summary.totalArticlesChecked === 'number');
  runner.assert('summary.totalDecaying number',         typeof r6.summary.totalDecaying === 'number');
  runner.assert('summary.totalHealthy number',          typeof r6.summary.totalHealthy === 'number');
  runner.assert('summary.totalWatch number',            typeof r6.summary.totalWatch === 'number');
  runner.assert('summary.totalRecommendations number',  typeof r6.summary.totalRecommendations === 'number');
  log.info('summary OK', JSON.stringify(r6.summary));

  // ── 8. safeMode defaults true ─────────────────────────────────────────────
  log.section('8. safeMode defaults true');
  runner.assert('meta.safeMode true',         r6.meta.safeMode === true);
  runner.assert('meta.executedWrites array',  Array.isArray(r6.meta.executedWrites));
  runner.assert('meta.skippedWrites array',   Array.isArray(r6.meta.skippedWrites));
  runner.assert('no content writes',          r6.meta.executedWrites.length === 0, 'writes: '+r6.meta.executedWrites.length);
  log.info('safeMode', r6.meta.safeMode);

  // ── 9. no content mutation ────────────────────────────────────────────────
  log.section('9. no content mutation in candidates');
  r6.candidates.forEach(function(c) {
    runner.assert('candidate no article field', !('article' in c));
    runner.assert('candidate no content field', !('content' in c));
  });
  log.info('no mutation confirmed', 'OK');

  // ── 10. output shape stable ───────────────────────────────────────────────
  log.section('10. output shape stability');
  runner.assert('has mode',        typeof r6.mode === 'string');
  runner.assert('has startedAt',   typeof r6.startedAt === 'string');
  runner.assert('has finishedAt',  typeof r6.finishedAt === 'string');
  runner.assert('has durationMs',  typeof r6.durationMs === 'number' && r6.durationMs >= 0);
  runner.assert('has summary',     typeof r6.summary === 'object');
  runner.assert('has candidates',  Array.isArray(r6.candidates));
  runner.assert('has maintenance', Array.isArray(r6.maintenance));
  runner.assert('has errors',      Array.isArray(r6.errors));
  runner.assert('has meta',        typeof r6.meta === 'object');
  log.info('shape OK', 'all fields present');
  log.info('durationMs', r6.durationMs);
});

process.exit(0);
