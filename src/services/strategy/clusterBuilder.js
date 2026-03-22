var STOP = new Set(['nedir','nasil','yapilir','icin','ve','ile','mi','mi','mu','mu',
  'the','and','for','how','what','why','a','an','is','to','of','se']);

function normalize(kw) {
  return kw.toLowerCase()
    .replace(/[şŞ]/g,'s').replace(/[ğĞ]/g,'g').replace(/[üÜ]/g,'u')
    .replace(/[öÖ]/g,'o').replace(/[çÇ]/g,'c').replace(/[ıİ]/g,'i')
    .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

function rootWords(kw) {
  return normalize(kw).split(' ').filter(function(w){return w.length>2&&!STOP.has(w);});
}

export function buildClusters(keywords) {
  if (!keywords || !keywords.length) return [];
  var clusterMap = {};

  keywords.forEach(function(item) {
    var kw    = item.keyword || '';
    var roots = rootWords(kw);
    var placed = false;

    Object.keys(clusterMap).forEach(function(cname) {
      if (placed) return;
      var cRoots = clusterMap[cname]._roots;
      var overlap = roots.some(function(r){ return cRoots.includes(r); });
      if (overlap) {
        clusterMap[cname].items.push(item);
        roots.forEach(function(r){ if (!cRoots.includes(r)) cRoots.push(r); });
        placed = true;
      }
    });

    if (!placed) {
      var cname = roots[0] || normalize(kw).split(' ')[0] || kw;
      clusterMap[cname] = { items: [item], _roots: roots.slice() };
    }
  });

  return Object.keys(clusterMap).map(function(cname) {
    var items = clusterMap[cname].items;
    items.sort(function(a,b){ return (b.volume||0)-(a.volume||0); });
    var totalVolume   = items.reduce(function(s,k){return s+(k.volume||0);},0);
    var avgDifficulty = items.length
      ? Math.round(items.reduce(function(s,k){return s+(k.keywordDifficulty||k.difficulty||0);},0)/items.length)
      : 0;
    return {
      mainTopic:    cname,
      keywords:     items.map(function(k){return {keyword:k.keyword,volume:k.volume||0,keywordDifficulty:k.keywordDifficulty||k.difficulty||0};}),
      totalVolume,
      avgDifficulty,
    };
  }).sort(function(a,b){return b.totalVolume-a.totalVolume;});
}
