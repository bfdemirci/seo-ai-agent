/**
 * strategyEngine.js
 * Site-level SEO planning — deterministic, no LLM, no DB.
 */

// ── Normalization helpers ────────────────────────────────────────────────────

var STOP = new Set(['nedir','nasil','yapilir','icin','ve','ile','mi','bir',
  'the','and','for','how','what','why','a','an','is','to','of','in','on']);

function norm(str) {
  return (str || '').toLowerCase()
    .replace(/[şŞ]/g,'s').replace(/[ğĞ]/g,'g').replace(/[üÜ]/g,'u')
    .replace(/[öÖ]/g,'o').replace(/[çÇ]/g,'c').replace(/[ıİ]/g,'i')
    .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

function rootWords(kw) {
  return norm(kw).split(' ').filter(function(w){return w.length>2&&!STOP.has(w);});
}

// ── Content type inference ───────────────────────────────────────────────────

var LOCAL_TOKENS = ['istanbul','ankara','izmir','bursa','antalya','city','local',
  'yakin','bolgem','ilce','sehir','district','clinic','klinigi','hastane'];
var TRANSACTION_TOKENS = ['fiyat','fiyatlari','satin','al','buy','price','cost',
  'ucret','teklif','quote','hizmet','service'];
var CATEGORY_TOKENS = ['en iyi','best','top','list','listesi','karsilastir',
  'compare','rehber','rehberi','guide','turler','cesitler','types'];

function inferContentType(item) {
  if (item.contentTypeHint) return item.contentTypeHint;
  var kn = norm(item.keyword);
  if (LOCAL_TOKENS.some(function(t){return kn.includes(t);})) return 'local_landing';
  var intent = (item.intent || '').toLowerCase();
  if (intent === 'transactional' || intent === 'commercial') return 'landing';
  if (TRANSACTION_TOKENS.some(function(t){return kn.includes(t);})) return 'landing';
  if (CATEGORY_TOKENS.some(function(t){return kn.includes(t);})) return 'category';
  return 'blog';
}

// ── Priority scoring ─────────────────────────────────────────────────────────

function calcPriorityScore(item) {
  var vol   = item.volume            || 0;
  var kd    = item.keywordDifficulty || 0;
  var bv    = item.businessValue     || 0;
  var cg    = item.competitorGapScore|| 0;
  var pos   = item.currentPosition;
  var decay = item.decayStatus;

  // Demand: volume up to 30 pts (normalized around 10k)
  var demandScore = Math.min(vol / 10000 * 30, 30);

  // KD inverse: 0 = hard, 1 = easy normalized; if KD is 0-1 scale use directly
  // KD may be 0-1 (semrush normalized) or 0-100 (raw)
  var kdNorm = kd > 1 ? kd / 100 : kd;
  var kdScore = (1 - kdNorm) * 20; // up to 20 pts

  // Business value: 0-1 → up to 20 pts
  var bvScore = bv * 20;

  // Competitor gap: 0-1 → up to 15 pts
  var cgScore = cg * 15;

  // Urgency / existing coverage
  var urgency = 0;
  if (!item.hasExistingArticle) {
    urgency = 10; // creation opportunity
  } else {
    if (decay === 'decaying')              urgency = 8;
    else if (decay === 'watch')            urgency = 4;
    else if (decay === 'healthy') {
      if (pos !== null && pos <= 3)        urgency = -5; // already doing well
      else                                 urgency = 0;
    }
    if (pos !== null && pos > 10)          urgency += 3; // poor ranking boost
  }

  var raw = demandScore + kdScore + bvScore + cgScore + urgency;
  return parseFloat(Math.min(Math.max(raw, 0), 100).toFixed(2));
}

function priorityBand(score) {
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

// ── Action detection ─────────────────────────────────────────────────────────

function detectAction(item, score) {
  if (!item.hasExistingArticle) return 'create';
  var decay = item.decayStatus;
  var pos   = item.currentPosition;
  if (decay === 'decaying')   return 'refresh';
  if (decay === 'watch') {
    // strong opportunity → refresh; otherwise monitor
    return score >= 55 ? 'refresh' : 'monitor';
  }
  if (decay === 'healthy' || !decay) {
    if (pos !== null && pos > 10) return 'refresh'; // poor rank despite existing content
    return 'monitor';
  }
  return 'monitor';
}

function buildReason(item, action, score) {
  if (!item.hasExistingArticle) {
    return (item.volume||0) > 2000
      ? 'high volume keyword with no existing content'
      : 'keyword not yet covered';
  }
  if (action === 'refresh' && item.decayStatus === 'decaying') return 'existing article is decaying';
  if (action === 'refresh' && item.decayStatus === 'watch')    return 'performance declining, refresh recommended';
  if (action === 'refresh' && item.currentPosition > 10)       return 'existing content ranking poorly (pos '+(item.currentPosition||'?')+')';
  if (action === 'monitor' && item.decayStatus === 'healthy')  return 'article is healthy and performing well';
  return 'monitoring for further signals';
}

// ── Clustering ───────────────────────────────────────────────────────────────

function slugify(s) {
  return s.replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,40);
}

function buildClusters(roadmapItems) {
  var clusterMap = {};

  roadmapItems.forEach(function(item) {
    var roots = rootWords(item.keyword);
    var placed = false;

    Object.keys(clusterMap).forEach(function(cid) {
      if (placed) return;
      var overlap = roots.some(function(r){return clusterMap[cid]._roots.includes(r);});
      if (overlap) {
        clusterMap[cid].items.push(item);
        roots.forEach(function(r){if(!clusterMap[cid]._roots.includes(r)) clusterMap[cid]._roots.push(r);});
        placed = true;
      }
    });

    if (!placed) {
      var root0 = roots[0] || norm(item.keyword).split(' ')[0];
      var cid   = 'cluster_'+slugify(root0);
      if (!clusterMap[cid]) clusterMap[cid] = { items:[], _roots:[] };
      clusterMap[cid].items.push(item);
      roots.forEach(function(r){if(!clusterMap[cid]._roots.includes(r)) clusterMap[cid]._roots.push(r);});
    }
  });

  return Object.keys(clusterMap).map(function(cid) {
    var items = clusterMap[cid].items;
    items.sort(function(a,b){return b.priorityScore - a.priorityScore;});
    var primary      = items[0].keyword;
    var intents      = items.map(function(i){return i.evidence&&i.evidence.intent||'informational';});
    var dominantIntent = intents.sort(function(a,b){
      return intents.filter(function(v){return v===b;}).length - intents.filter(function(v){return v===a;}).length;
    })[0] || 'informational';
    var label = (clusterMap[cid]._roots.slice(0,2).join(' ')).replace(/_/g,' ') || cid;
    return {
      clusterId:      cid,
      label:          label,
      primaryKeyword: primary,
      keywords:       items.map(function(i){return i.keyword;}),
      dominantIntent: dominantIntent,
    };
  }).sort(function(a,b){return b.keywords.length-a.keywords.length;});
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function buildStrategy({ site, items }) {
  site  = site  || '';
  items = items || [];

  if (!items.length) {
    return {
      site, generatedAt: new Date().toISOString(),
      summary: { totalItems:0, createNow:0, refreshNow:0, monitor:0 },
      clusters: [], roadmap: [],
    };
  }

  var roadmap = items.map(function(item) {
    var score  = calcPriorityScore(item);
    var action = detectAction(item, score);
    var reason = buildReason(item, action, score);
    var band   = priorityBand(score);
    var ctype  = inferContentType(item);
    var roots  = rootWords(item.keyword);
    var cid    = 'cluster_'+slugify(roots[0] || norm(item.keyword).split(' ')[0]);

    return {
      keyword:              item.keyword,
      action:               action,
      priorityScore:        score,
      priorityBand:         band,
      reason:               reason,
      suggestedContentType: ctype,
      clusterId:            cid,
      evidence: {
        volume:             item.volume            || 0,
        keywordDifficulty:  item.keywordDifficulty || 0,
        businessValue:      item.businessValue     || 0,
        currentPosition:    item.currentPosition   || null,
        hasExistingArticle: !!item.hasExistingArticle,
        decayStatus:        item.decayStatus       || null,
        competitorGapScore: item.competitorGapScore|| 0,
        intent:             item.intent            || null,
      },
    };
  }).sort(function(a,b){
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if ((b.evidence.volume||0) !== (a.evidence.volume||0)) return (b.evidence.volume||0)-(a.evidence.volume||0);
    return a.keyword < b.keyword ? -1 : 1;
  });

  var clusters = buildClusters(roadmap);

  // Patch clusterId from cluster assignment
  var kwToCluster = {};
  clusters.forEach(function(c) {
    c.keywords.forEach(function(kw){ kwToCluster[kw] = c.clusterId; });
  });
  roadmap.forEach(function(r){ r.clusterId = kwToCluster[r.keyword] || r.clusterId; });

  var summary = {
    totalItems: roadmap.length,
    createNow:  roadmap.filter(function(r){return r.action==='create';}).length,
    refreshNow: roadmap.filter(function(r){return r.action==='refresh';}).length,
    monitor:    roadmap.filter(function(r){return r.action==='monitor';}).length,
  };

  return {
    site,
    generatedAt: new Date().toISOString(),
    summary,
    clusters,
    roadmap,
  };
}
