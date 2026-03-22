import * as runner  from '../lib/testRunner.js';
import * as log     from '../lib/logger.js';

runner.run('Competitor Intel Test', async ({keyword}) => {

  const { buildCompetitorIntel } = await runner.importAgent('services/seo/competitorIntel.service.js');
  const { extractDomain, extractTitlePatterns, extractEntities } = await runner.importAgent('services/seo/serpParser.js');

  var mockResearch = {
    serp: [
      { title: 'SEO Nedir? Arama Motoru Optimizasyonu Rehberi 2024', url: 'https://example.com/seo-nedir',     snippet: 'SEO nedir sorusunu yanıtlıyoruz. Google ranking factors, backlinks ve on-page optimizasyon.', position: 1 },
      { title: 'SEO Nasil Yapilir? Beginners Complete Guide',         url: 'https://semrush.com/seo-guide',    snippet: 'Keyword research, content optimization, backlinks nedir. SEO types ve teknik seo rehberi.', position: 2 },
      { title: 'SEO Nedir Turleri ve Onemi',                          url: 'https://hubspot.com/seo',          snippet: 'On-page SEO, off-page SEO ve teknik SEO turleri. Google ranking factors ve backlinks.', position: 3 },
      { title: 'SEO Ipuclari 2024 — What Is SEO',                    url: 'https://moz.com/seo-tips',         snippet: 'Arama motoru optimizasyonu baslangic rehberi. Keyword research ve content strategy.', position: 4 },
      { title: 'Teknik SEO Rehberi — Complete SEO Guide',            url: 'https://ahrefs.com/technical-seo', snippet: 'Technical SEO checklist. Site speed, crawling, indexing. Backlinks ve keyword research.', position: 5 },
    ],
    semrush: {
      volume: 5400, keywordDifficulty: 62, cpc: 0.45, competition: 0.7,
      relatedKeywords: [
        { keyword: 'seo nasil yapilir', volume: 3600, difficulty: 68 },
        { keyword: 'seo ne demek',      volume: 2400, difficulty: 55 },
        { keyword: 'seo turleri',       volume: 1800, difficulty: 50 },
        { keyword: 'teknik seo',        volume: 1200, difficulty: 72 },
        { keyword: 'on page seo',       volume: 900,  difficulty: 60 },
      ],
      competitors: [{ domain: 'example.com', trafficEstimate: 12000 }],
    },
  };

  log.section('1. Basic output shape');
  var r1 = await buildCompetitorIntel({ keyword, research: mockResearch });
  runner.assert('has keyword',                        r1.keyword === keyword);
  runner.assert('has topCompetitors',                 Array.isArray(r1.topCompetitors));
  runner.assert('has serpAnalysis',                   typeof r1.serpAnalysis === 'object');
  runner.assert('has keywordGaps',                    Array.isArray(r1.keywordGaps));
  runner.assert('has contentGaps',                    Array.isArray(r1.contentGaps));
  runner.assert('has entityGaps',                     Array.isArray(r1.entityGaps));
  runner.assert('has quickWins',                      Array.isArray(r1.quickWins));
  runner.assert('avgTitleLength number',              typeof r1.serpAnalysis.avgTitleLength === 'number');
  runner.assert('commonTitlePatterns array',          Array.isArray(r1.serpAnalysis.commonTitlePatterns));
  runner.assert('headingPatterns array',              Array.isArray(r1.serpAnalysis.headingPatterns));
  log.info('avgTitleLength',      r1.serpAnalysis.avgTitleLength);
  log.info('titlePatterns',       r1.serpAnalysis.commonTitlePatterns.join(', '));
  log.info('headingPatterns',     r1.serpAnalysis.headingPatterns.join(', '));

  log.section('2. Top competitors');
  runner.assert('topCompetitors > 0',    r1.topCompetitors.length > 0);
  runner.assert('topCompetitors <= 5',   r1.topCompetitors.length <= 5);
  runner.assert('competitor has url',    !!r1.topCompetitors[0].url);
  runner.assert('competitor has domain', !!r1.topCompetitors[0].domain);
  runner.assert('competitor has title',  !!r1.topCompetitors[0].title);
  runner.assert('competitor position',   typeof r1.topCompetitors[0].position === 'number');
  log.info('top competitor', r1.topCompetitors[0].domain);

  log.section('3. Keyword gaps');
  runner.assert('keywordGaps present',   r1.keywordGaps.length > 0, 'len: '+r1.keywordGaps.length);
  runner.assert('keywordGaps <= 5',      r1.keywordGaps.length <= 5);
  runner.assert('gap has keyword',       typeof r1.keywordGaps[0].keyword === 'string');
  runner.assert('gap has volume',        typeof r1.keywordGaps[0].volume === 'number');
  log.info('first gap', r1.keywordGaps[0].keyword);

  log.section('4. Content gaps');
  runner.assert('contentGaps present',   r1.contentGaps.length > 0, 'len: '+r1.contentGaps.length);
  runner.assert('contentGap is string',  typeof r1.contentGaps[0] === 'string');
  r1.contentGaps.slice(0,3).forEach(function(g){ log.info('gap', g); });

  log.section('5. Quick wins');
  runner.assert('quickWins present',    r1.quickWins.length > 0, 'len: '+r1.quickWins.length);
  runner.assert('quickWin is string',   typeof r1.quickWins[0] === 'string');
  r1.quickWins.forEach(function(w){ log.info('win', w); });

  log.section('6. Works without semrush');
  var r6 = await buildCompetitorIntel({ keyword, research: { serp: mockResearch.serp } });
  runner.assert('no crash without semrush',  typeof r6 === 'object');
  runner.assert('topCompetitors present',    r6.topCompetitors.length > 0);
  runner.assert('keywordGaps empty array',   Array.isArray(r6.keywordGaps) && r6.keywordGaps.length === 0);
  log.info('topCompetitors without semrush', r6.topCompetitors.length);

  log.section('7. Works without serp');
  var r7 = await buildCompetitorIntel({ keyword, research: { semrush: mockResearch.semrush } });
  runner.assert('no crash without serp',    typeof r7 === 'object');
  runner.assert('topCompetitors empty',     r7.topCompetitors.length === 0);
  runner.assert('keywordGaps still works',  r7.keywordGaps.length > 0);
  log.info('keywordGaps without serp', r7.keywordGaps.length);

  log.section('8. serpParser helpers');
  runner.assert('extractDomain works',        extractDomain('https://www.example.com/path') === 'example.com');
  runner.assert('extractDomain no www',       extractDomain('https://moz.com/seo') === 'moz.com');
  runner.assert('extractDomain empty safe',   extractDomain('') === '');
  runner.assert('extractTitlePatterns works', extractTitlePatterns(['SEO Nedir Guide 2024']).length > 0);
  runner.assert('extractEntities works',      extractEntities(['backlinks keyword research','keyword research seo backlinks']).includes('backlinks'));
  log.info('extractDomain', extractDomain('https://www.example.com/path'));
  log.info('patterns',      extractTitlePatterns(['SEO Nedir Guide 2024']).join(', '));

  log.section('9. Entity gaps');
  runner.assert('entityGaps is array',   Array.isArray(r1.entityGaps));
  runner.assert('entityGaps nonempty',   r1.entityGaps.length > 0, 'len: '+r1.entityGaps.length);
  runner.assert('entityGap is string',   typeof r1.entityGaps[0] === 'string');
  log.info('entities', r1.entityGaps.slice(0,5).join(', '));

  log.section('10. Full shape with empty input');
  var r10 = await buildCompetitorIntel({ keyword, research: {} });
  runner.assert('no crash on empty',   typeof r10 === 'object');
  runner.assert('has all keys',        'topCompetitors' in r10 && 'serpAnalysis' in r10 && 'quickWins' in r10);
  runner.assert('topCompetitors arr',  Array.isArray(r10.topCompetitors));
  runner.assert('quickWins arr',       Array.isArray(r10.quickWins));
  log.info('empty input safe', 'OK');
});
