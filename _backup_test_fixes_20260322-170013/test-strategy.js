import * as runner from '../lib/testRunner.js';
import * as log    from '../lib/logger.js';

runner.run('Strategy Engine Test', async ({keyword}) => {

  const { buildStrategy } = await runner.importAgent('services/strategy/strategyEngine.js');

  function item(kw, overrides) {
    overrides = overrides || {};
    return Object.assign({
      keyword:            kw,
      intent:             'informational',
      volume:             3000,
      keywordDifficulty:  0.5,
      businessValue:      0.5,
      currentPosition:    null,
      hasExistingArticle: false,
      decayStatus:        null,
      competitorGapScore: 0.5,
      contentTypeHint:    null,
    }, overrides);
  }

  var mockItems = [
    item('seo nedir',           { volume:8100, keywordDifficulty:0.24, businessValue:0.8, competitorGapScore:0.7 }),
    item('seo nasil yapilir',   { volume:5400, keywordDifficulty:0.42, businessValue:0.7, competitorGapScore:0.6 }),
    item('teknik seo',          { volume:3200, keywordDifficulty:0.55, businessValue:0.6, hasExistingArticle:true, decayStatus:'decaying', currentPosition:12 }),
    item('seo araclari',        { volume:2800, keywordDifficulty:0.38, businessValue:0.5, hasExistingArticle:true, decayStatus:'healthy', currentPosition:4 }),
    item('backlink nedir',      { volume:4100, keywordDifficulty:0.45, businessValue:0.6, competitorGapScore:0.5 }),
    item('backlink kazanma',    { volume:2200, keywordDifficulty:0.60, businessValue:0.5, hasExistingArticle:true, decayStatus:'watch', currentPosition:8 }),
    item('istanbul dis klinigi',{ volume:1800, keywordDifficulty:0.30, businessValue:0.9, competitorGapScore:0.8 }),
  ];

  // ── 1. create candidate ────────────────────────────────────────────────────
  log.section('1. Create candidate');
  var r1 = await buildStrategy({ site:'example.com', items:[item('new keyword', {volume:5000, keywordDifficulty:0.3, businessValue:0.8})] });
  runner.assert('action create',          r1.roadmap[0].action === 'create', r1.roadmap[0].action);
  runner.assert('summary createNow 1',    r1.summary.createNow === 1);
  runner.assert('has evidence',           typeof r1.roadmap[0].evidence === 'object');
  runner.assert('evidence.hasExisting',   r1.roadmap[0].evidence.hasExistingArticle === false);
  log.info('action', r1.roadmap[0].action);
  log.info('priorityScore', r1.roadmap[0].priorityScore);

  // ── 2. refresh candidate (decaying) ───────────────────────────────────────
  log.section('2. Refresh candidate — decaying');
  var r2 = await buildStrategy({ site:'example.com', items:[
    item('decaying article', { hasExistingArticle:true, decayStatus:'decaying', currentPosition:15, volume:4000, businessValue:0.7 })
  ]});
  runner.assert('action refresh',         r2.roadmap[0].action === 'refresh', r2.roadmap[0].action);
  runner.assert('summary refreshNow 1',   r2.summary.refreshNow === 1);
  log.info('action', r2.roadmap[0].action);
  log.info('reason', r2.roadmap[0].reason);

  // ── 3. healthy → monitor ──────────────────────────────────────────────────
  log.section('3. Healthy article → monitor');
  var r3 = await buildStrategy({ site:'example.com', items:[
    item('healthy article', { hasExistingArticle:true, decayStatus:'healthy', currentPosition:2, volume:3000, businessValue:0.5 })
  ]});
  runner.assert('action monitor',         r3.roadmap[0].action === 'monitor', r3.roadmap[0].action);
  runner.assert('summary monitor 1',      r3.summary.monitor === 1);
  log.info('action', r3.roadmap[0].action);

  // ── 4. Priority scoring ────────────────────────────────────────────────────
  log.section('4. Priority scoring');
  var rFull = await buildStrategy({ site:'example.com', items: mockItems });
  var high  = item('high value', { volume:9000, keywordDifficulty:0.1, businessValue:1.0, competitorGapScore:1.0 });
  var low   = item('low value',  { volume:500,  keywordDifficulty:0.9, businessValue:0.1, competitorGapScore:0.1 });
  var rComp = await buildStrategy({ site:'example.com', items:[high, low] });
  runner.assert('high value ranks first', rComp.roadmap[0].keyword === 'high value', rComp.roadmap[0].keyword);
  runner.assert('priorityScore is number', typeof rComp.roadmap[0].priorityScore === 'number');
  runner.assert('score 0-100', rComp.roadmap[0].priorityScore >= 0 && rComp.roadmap[0].priorityScore <= 100);
  log.info('high score', rComp.roadmap[0].priorityScore);
  log.info('low score',  rComp.roadmap[1].priorityScore);

  // ── 5. Clustering ─────────────────────────────────────────────────────────
  log.section('5. Clustering');
  runner.assert('clusters present',       rFull.clusters.length > 0);
  runner.assert('seo cluster exists',     rFull.clusters.some(function(c){return c.clusterId.includes('seo');}), rFull.clusters.map(function(c){return c.clusterId;}).join(', '));
  runner.assert('cluster has keywords',   rFull.clusters[0].keywords.length > 0);
  runner.assert('cluster has label',      typeof rFull.clusters[0].label === 'string');
  runner.assert('cluster has primaryKw',  typeof rFull.clusters[0].primaryKeyword === 'string');
  runner.assert('cluster has intent',     typeof rFull.clusters[0].dominantIntent === 'string');
  rFull.clusters.forEach(function(c){ log.info('cluster: '+c.clusterId, c.keywords.length+' kw'); });

  // ── 6. Local landing inference ─────────────────────────────────────────────
  log.section('6. Local landing inference');
  var localItem = rFull.roadmap.find(function(r){return r.keyword==='istanbul dis klinigi';});
  runner.assert('local_landing inferred', localItem && localItem.suggestedContentType === 'local_landing', localItem && localItem.suggestedContentType);
  log.info('contentType', localItem && localItem.suggestedContentType);

  // ── 7. Output shape validation ─────────────────────────────────────────────
  log.section('7. Output shape validation');
  runner.assert('has site',          typeof rFull.site === 'string');
  runner.assert('has generatedAt',   typeof rFull.generatedAt === 'string');
  runner.assert('has summary',       typeof rFull.summary === 'object');
  runner.assert('summary.totalItems', typeof rFull.summary.totalItems === 'number');
  runner.assert('summary.createNow', typeof rFull.summary.createNow === 'number');
  runner.assert('summary.refreshNow',typeof rFull.summary.refreshNow === 'number');
  runner.assert('summary.monitor',   typeof rFull.summary.monitor === 'number');
  runner.assert('roadmap array',     Array.isArray(rFull.roadmap));
  runner.assert('roadmap action valid', rFull.roadmap.every(function(r){return ['create','refresh','monitor'].includes(r.action);}));
  runner.assert('roadmap band valid',   rFull.roadmap.every(function(r){return ['high','medium','low'].includes(r.priorityBand);}));
  runner.assert('roadmap reason string',rFull.roadmap.every(function(r){return typeof r.reason === 'string' && r.reason.length>0;}));
  runner.assert('roadmap evidence',     rFull.roadmap.every(function(r){return typeof r.evidence === 'object';}));
  runner.assert('roadmap clusterId',    rFull.roadmap.every(function(r){return typeof r.clusterId === 'string';}));
  runner.assert('roadmap contentType',  rFull.roadmap.every(function(r){return ['blog','landing','category','local_landing'].includes(r.suggestedContentType);}));
  log.info('totalItems',   rFull.summary.totalItems);
  log.info('createNow',    rFull.summary.createNow);
  log.info('refreshNow',   rFull.summary.refreshNow);
  log.info('monitor',      rFull.summary.monitor);

  // ── 8. Empty input ─────────────────────────────────────────────────────────
  log.section('8. Empty input');
  var empty = await buildStrategy({ site:'example.com', items:[] });
  runner.assert('empty clusters',      Array.isArray(empty.clusters) && empty.clusters.length===0);
  runner.assert('empty roadmap',       Array.isArray(empty.roadmap) && empty.roadmap.length===0);
  runner.assert('empty summary zeros', empty.summary.totalItems===0);
  log.info('empty safe', 'OK');

  // ── 9. Roadmap sorted DESC ────────────────────────────────────────────────
  log.section('9. Roadmap sorted by priorityScore DESC');
  var sc = rFull.roadmap.map(function(r){return r.priorityScore;});
  var ok = true;
  for (var i=1;i<sc.length;i++) if (sc[i]>sc[i-1]) ok=false;
  runner.assert('roadmap sorted desc', ok, sc.join(', '));
  rFull.roadmap.slice(0,5).forEach(function(r){ log.info('  '+r.keyword, r.action+' band:'+r.priorityBand+' score:'+r.priorityScore); });
});

process.exit(0);
