export function extractDomain(url) {
  if (!url) return '';
  try { var u = new URL(url); return u.hostname.replace(/^www\./, ''); }
  catch (_) { var m = url.match(/^https?:\/\/(?:www\.)?([^/]+)/); return m ? m[1] : url; }
}

var TITLE_PATTERNS = [
  { test: /what\s+is|nedir|ne\s+demek/i,   label: 'what-is'        },
  { test: /complete\s+guide|tam\s+rehber/i, label: 'complete-guide' },
  { test: /beginner|başlangıç/i,            label: 'beginner'       },
  { test: /\b202[3-9]\b|\b20[3-9]\d\b/,    label: 'year-mention'   },
  { test: /how\s+to|nasıl/i,               label: 'how-to'         },
  { test: /guide|rehber|kılavuz/i,         label: 'guide'          },
  { test: /types|türleri|çeşitleri/i,      label: 'types'          },
  { test: /tips|ipuçları/i,               label: 'tips'            },
  { test: /best|en\s+iyi/i,               label: 'best'            },
];

export function extractTitlePatterns(titles) {
  if (!titles || !titles.length) return [];
  var counts = {};
  titles.forEach(function(t) {
    TITLE_PATTERNS.forEach(function(p) {
      if (p.test.test(t)) counts[p.label] = (counts[p.label] || 0) + 1;
    });
  });
  return Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; });
}

var HEADING_PATTERNS = [
  { test: /what\s+is|nedir/i,   label: 'what-is'  },
  { test: /how\s+to|nasıl/i,   label: 'how-to'   },
  { test: /types|türler/i,     label: 'types'     },
  { test: /example|örnek/i,    label: 'examples'  },
  { test: /benefit|fayda/i,    label: 'benefits'  },
  { test: /tool|araç/i,        label: 'tools'     },
  { test: /why|neden/i,        label: 'why'       },
  { test: /checklist/i,        label: 'checklist' },
];

export function extractHeadingPatterns(texts) {
  if (!texts || !texts.length) return [];
  var found = {};
  texts.forEach(function(t) {
    HEADING_PATTERNS.forEach(function(p) { if (p.test.test(t)) found[p.label] = true; });
  });
  return Object.keys(found);
}

var STOP = new Set(['ve','ile','bu','bir','de','da','icin','gibi',
  'the','and','for','that','are','was','with','this','from','it',
  'as','is','in','to','of','a','an','be','at','or','its','by',
  'on','not','have','we','they','our','what','how','why','when',
  'which','who','can','do','does']);

export function extractEntities(texts) {
  if (!texts || !texts.length) return [];
  var freq = {};
  texts.forEach(function(text) {
    if (!text) return;
    text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).forEach(function(w) {
      w = w.trim();
      if (w.length < 4 || STOP.has(w)) return;
      freq[w] = (freq[w] || 0) + 1;
    });
  });
  return Object.keys(freq).filter(function(w){return freq[w]>=2;})
    .sort(function(a,b){return freq[b]-freq[a];}).slice(0,15);
}
