import { fetchKeywordOverview } from '../../providers/semrushProvider.js';

function num(v, fallback) {
  var n = parseFloat(v);
  return isNaN(n) ? (fallback || 0) : n;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export async function getKeywordIntel(keyword, _injected) {
  var raw;
  try {
    raw = await fetchKeywordOverview(keyword, _injected);
  } catch (err) {
    raw = { keyword: keyword, _mock: true, _error: err.message };
  }

  if (!raw) raw = {};

  // Normalize — handle both real API rows and mock shape
  var volume             = clamp(num(raw.volume             || raw.Nq, 0), 0, 10000000);
  var keywordDifficulty  = clamp(num(raw.keywordDifficulty  || raw.Kd, 0), 0, 100);
  var cpc                = clamp(num(raw.cpc               || raw.Cp, 0), 0, 1000);
  var competition        = clamp(num(raw.competition        || raw.Co, 0), 0, 1);

  var relatedKeywords = Array.isArray(raw.relatedKeywords) ? raw.relatedKeywords.map(function(r) {
    return { keyword: String(r.keyword || ''), volume: num(r.volume, 0), difficulty: clamp(num(r.difficulty, 0), 0, 100) };
  }) : [];

  var competitors = Array.isArray(raw.competitors) ? raw.competitors.map(function(c) {
    return { domain: String(c.domain || ''), trafficEstimate: num(c.trafficEstimate, 0) };
  }) : [];

  return { keyword, volume, keywordDifficulty, cpc, competition, relatedKeywords, competitors };
}
