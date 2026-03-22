import { extractDomain, extractTitlePatterns, extractHeadingPatterns, extractEntities } from './serpParser.js';

function safeAvg(arr, fn) {
  if (!arr || !arr.length) return 0;
  var vals = arr.map(fn).filter(function(v){return typeof v==='number'&&!isNaN(v);});
  if (!vals.length) return 0;
  return Math.round(vals.reduce(function(s,v){return s+v;},0)/vals.length);
}

var SECTION_MAP = [
  { test: /nasil\s+yapilir|how\s+to|nasil/i,          gap: 'how to apply / implementation guide' },
  { test: /turleri|türleri|types|cesitleri/i,          gap: 'types and categories'                },
  { test: /araclar|tools|araçlar/i,                    gap: 'recommended tools'                   },
  { test: /ornek|example|örnek/i,                      gap: 'real-world examples'                 },
  { test: /fiyat|price|cost|ucret/i,                   gap: 'pricing / cost information'          },
  { test: /baslangic|beginner|yeni\s+basla/i,          gap: 'beginner introduction section'       },
  { test: /teknik|technical/i,                         gap: 'technical details section'           },
  { test: /ipuclari|tips|oneriler/i,                   gap: 'tips and best practices'             },
  { test: /faydalari|benefits|avantajlar/i,            gap: 'benefits / advantages section'       },
  { test: /nedir|what\s+is/i,                          gap: 'clear definition section'            },
];

function detectContentGaps(texts) {
  var gaps = [], seen = {};
  texts.forEach(function(t) {
    if (!t) return;
    SECTION_MAP.forEach(function(rule) {
      if (!seen[rule.gap] && rule.test.test(t)) {
        gaps.push('missing or thin section: ' + rule.gap);
        seen[rule.gap] = true;
      }
    });
  });
  return gaps.slice(0,6);
}

function quickWins(serpAnalysis, keywordGaps, contentGaps, competitors) {
  var wins = [];
  if (serpAnalysis.avgTitleLength < 50)
    wins.push('Expand title — competitors average ' + serpAnalysis.avgTitleLength + ' chars, aim for 55-65');
  if (!serpAnalysis.commonTitlePatterns.includes('what-is'))
    wins.push('Add clear "what is" definition — common in top-ranking titles');
  if (!serpAnalysis.commonTitlePatterns.includes('year-mention'))
    wins.push('Include current year in title for freshness signal');
  if (!serpAnalysis.headingPatterns.includes('how-to'))
    wins.push('Add a how-to / step-by-step section — missing from top results');
  if (!serpAnalysis.headingPatterns.includes('types'))
    wins.push('Add a types/categories section — detected in competitor content');
  if (keywordGaps.length >= 3)
    wins.push('Cover ' + keywordGaps.length + ' related keyword variations to capture long-tail traffic');
  if (contentGaps.length >= 2)
    wins.push('Fill identified content gaps: ' + contentGaps.slice(0,2).map(function(g){return g.replace('missing or thin section: ','');}).join(', '));
  if (!serpAnalysis.headingPatterns.includes('examples'))
    wins.push('Add examples section — boosts E-E-A-T and user engagement');
  return wins.slice(0,6);
}

export async function buildCompetitorIntel({ keyword, research }) {
  research = research || {};
  var serp    = Array.isArray(research.serp) ? research.serp : [];
  var semrush = research.semrush || {};
  var related = Array.isArray(semrush.relatedKeywords) ? semrush.relatedKeywords : [];

  var topCompetitors = serp.slice(0,5).map(function(r,i) {
    return { url: r.url||r.link||'', domain: extractDomain(r.url||r.link||''), title: r.title||'', position: r.position||(i+1) };
  });

  var titles   = serp.map(function(r){return r.title||'';}).filter(Boolean);
  var snippets = serp.map(function(r){return r.snippet||r.description||'';}).filter(Boolean);
  var allTexts = titles.concat(snippets);

  var serpAnalysis = {
    avgTitleLength:           safeAvg(titles, function(t){return t.length;}),
    commonTitlePatterns:      extractTitlePatterns(titles),
    avgContentLengthEstimate: safeAvg(snippets, function(s){return s.length*8;}),
    headingPatterns:          extractHeadingPatterns(allTexts),
  };

  var keywordGaps = related.filter(function(r){
    return r && r.keyword && r.keyword.toLowerCase()!==keyword.toLowerCase();
  }).slice(0,5).map(function(r){return {keyword:r.keyword,volume:r.volume||0};});

  var gapTexts    = related.map(function(r){return r.keyword||'';}).concat(titles);
  var contentGaps = detectContentGaps(gapTexts);
  var entityGaps  = extractEntities(allTexts);
  var wins        = quickWins(serpAnalysis, keywordGaps, contentGaps, topCompetitors);

  return { keyword, topCompetitors, serpAnalysis, keywordGaps, contentGaps, entityGaps, quickWins: wins };
}
