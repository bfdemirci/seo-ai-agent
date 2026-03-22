import * as runner from '../lib/testRunner.js';
import * as log    from '../lib/logger.js';

runner.run('Strategy Engine Test', async ({keyword}) => {

  const { buildStrategy }      = await runner.importAgent('services/strategy/strategyEngine.js');
  const { buildClusters }      = await runner.importAgent('services/strategy/clusterBuilder.js');
  const { scoreKeyword, detectOpportunity } = await runner.importAgent('services/strategy/priorityScorer.js');

  var mockKeywords = [
    { keyword: 'seo nedir',           volume: 5400, keywordDifficulty: 62 },
    { keyword: 'seo nasil yapilir',   volume: 3600, keywordDifficulty: 68 },
    { keyword: 'seo araclari',        volume: 2800, keywordDifficulty: 55 },
    { keyword: 'teknik seo',          volume: 2200, keywordDifficulty: 72 },
    { keyword: 'on page seo',         volume: 1800, keywordDifficulty: 60 },
    { keyword: 'seo uyumu',           volume: 1200, keywordDifficulty: 45 },
    { keyword: 'backlink nedir',      volume: 3100, keywordDifficulty: 58 },
    { keyword: 'backlink kazanma',    volume: 1600, keywordDifficulty: 65 },
    { keyword: 'icerik pazarlama',    volume: 2400, keywordDifficulty: 52 },
    { keyword: 'blog yazarligi',      volume: 1100, keywordDifficulty: 38 },
  ];

  var mockExisting = [
    { keyword: 'seo nedir',       url: '/seo-nedir',     position: 5.5, clicks: 300 },
    { keyword: 'backlink nedir',  url: '/backlink',       position: 12.0, clicks: 80 },
  ];

  // ── 1. Cluster grouping ────────────────────────────────────────────────────
  log.section('1. Cluster grouping');
  var clusters = buildClusters(mockKeywords);
  runner.assert('clusters is array',    Array.isArray(clusters));
  runner.assert('clusters > 0',         clusters.length > 0, 'len: '+clusters.length);
  runner.assert('seo cluster exists',   clusters.some(function(c){ return c.mainTopic === 'seo'; }), clusters.map(function(c){return c.mainTopic;}).join(', '));
  runner.assert('cluster has keywords', clusters[0].keywords.length > 0);
  runner.assert('cluster has volume',   typeof clusters[0].totalVolume === 'number');
  runner.assert('cluster has difficulty', typeof clusters[0].avgDifficulty === 'number');
  clusters.forEach(function(c){ log.info('cluster: '+c.mainTopic, c.keywords.length+' kw, vol '+c.totalVolume); });

  // ── 2. Priority scoring ────────────────────────────────────────────────────
  log.section('2. Priority scoring');
  var s1 = scoreKeyword({ keyword: 'seo nedir', volume: 5400, difficulty: 62, existing: null });
  var s2 = scoreKeyword({ keyword: 'blog yazarligi', volume: 500, difficulty: 30, existing: null });
  runner.assert('higher volume → higher score', s1 > s2, s1+' > '+s2);
  runner.assert('score is number', typeof s1 === 'number');
  runner.assert('score 0-100', s1 >= 0 && s1 <= 100, 'got: '+s1);
  runner.assert('existing boosts score', scoreKeyword({keyword:'x',volume:2000,difficulty:30,existing:{position:8}}) > scoreKeyword({keyword:'x',volume:2000,difficulty:30,existing:null}));
  log.info('high volume score',  s1);
  log.info('low volume score',   s2);

  // ── 3. New vs existing detection ──────────────────────────────────────────
  log.section('3. Opportunity detection');
  var oNew = detectOpportunity({ keyword: 'new keyword', volume: 2000, difficulty: 50, existing: null });
  runner.assert('new type', oNew.type === 'new', oNew.type);
  runner.assert('new action create', oNew.recommendedAction === 'create', oNew.recommendedAction);

  var oRefresh = detectOpportunity({ keyword: 'old', volume: 1000, difficulty: 40, existing: { position: 15, clicks: 20 } });
  runner.assert('refresh type existing', oRefresh.type === 'existing', oRefresh.type);
  runner.assert('refresh action refresh', oRefresh.recommendedAction === 'refresh', oRefresh.recommendedAction);

  var oExpand = detectOpportunity({ keyword: 'mid', volume: 1000, difficulty: 40, existing: { position: 7, clicks: 100 } });
  runner.assert('expand action', oExpand.recommendedAction === 'expand', oExpand.recommendedAction);

  var oMonitor = detectOpportunity({ keyword: 'top', volume: 1000, difficulty: 40, existing: { position: 3, clicks: 400 } });
  runner.assert('top5 action monitor', oMonitor.recommendedAction === 'monitor', oMonitor.recommendedAction);

  log.info('new opp',     oNew.recommendedAction+' ('+oNew.priorityScore+')');
  log.info('refresh opp', oRefresh.recommendedAction+' ('+oRefresh.priorityScore+')');
  log.info('expand opp',  oExpand.recommendedAction+' ('+oExpand.priorityScore+')');

  // ── 4. Full strategy output ────────────────────────────────────────────────
  log.section('4. Full strategy output shape');
  var result = await buildStrategy({ keywords: mockKeywords, existingArticles: mockExisting });
  runner.assert('has clusters',     Array.isArray(result.clusters));
  runner.assert('has opportunities', Array.isArray(result.opportunities));
  runner.assert('has roadmap',      Array.isArray(result.roadmap));
  runner.assert('clusters > 0',     result.clusters.length > 0);
  runner.assert('opportunities > 0', result.opportunities.length > 0);
  runner.assert('roadmap > 0',      result.roadmap.length > 0);
  runner.assert('roadmap <= 10',    result.roadmap.length <= 10);
  log.info('clusters',      result.clusters.length);
  log.info('opportunities', result.opportunities.length);
  log.info('roadmap steps', result.roadmap.length);

  // ── 5. Roadmap sorted correctly ───────────────────────────────────────────
  log.section('5. Roadmap sorted by priorityScore DESC');
  var scores = result.roadmap.map(function(r){return r.priorityScore;});
  var sorted = true;
  for (var i=1;i<scores.length;i++) if (scores[i]>scores[i-1]) sorted=false;
  runner.assert('roadmap sorted desc', sorted, scores.join(', '));
  runner.assert('roadmap step numbers', result.roadmap[0].step === 1);
  runner.assert('roadmap has keyword',  typeof result.roadmap[0].keyword === 'string');
  runner.assert('roadmap has action',   typeof result.roadmap[0].action === 'string');
  result.roadmap.slice(0,5).forEach(function(r){
    log.info('step '+r.step, r.keyword+' → '+r.action+' ('+r.priorityScore+')');
  });

  // ── 6. Empty input ────────────────────────────────────────────────────────
  log.section('6. Empty inputs');
  var empty = await buildStrategy({ keywords: [], existingArticles: [] });
  runner.assert('empty clusters',      Array.isArray(empty.clusters) && empty.clusters.length===0);
  runner.assert('empty opportunities', Array.isArray(empty.opportunities) && empty.opportunities.length===0);
  runner.assert('empty roadmap',       Array.isArray(empty.roadmap) && empty.roadmap.length===0);
  log.info('empty safe', 'OK');

  // ── 7. Existing articles correctly recognized ──────────────────────────────
  log.section('7. Existing articles in opportunities');
  var seoOpp = result.opportunities.find(function(o){return o.keyword==='seo nedir';});
  var newOpp  = result.opportunities.find(function(o){return o.keyword==='icerik pazarlama';});
  runner.assert('seo nedir is existing type', seoOpp && seoOpp.type === 'existing', seoOpp && seoOpp.type);
  runner.assert('icerik pazarlama is new',    newOpp  && newOpp.type  === 'new',      newOpp  && newOpp.type);
  log.info('seo nedir', seoOpp && seoOpp.recommendedAction + ' pos '+(seoOpp && seoOpp.reason));
  log.info('icerik pazarlama', newOpp && newOpp.recommendedAction);
});
