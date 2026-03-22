// Pure threshold classification helpers — no side effects

export const VALID_ACTIONS = ['rewrite','refresh','meta_only','monitor','ignore','internal_link_boost','offpage_review'];

export function classifyCtr(pct) {
  if (pct === null || pct === undefined || pct > -10) return 'none';
  if (pct <= -30) return 'high';
  if (pct <= -20) return 'medium';
  return 'low';
}

export function classifyClicks(pct) {
  if (pct === null || pct === undefined || pct > -15) return 'none';
  if (pct <= -50) return 'high';
  if (pct <= -30) return 'medium';
  return 'low';
}

export function classifyPosition(delta) {
  if (delta === null || delta === undefined || delta < 1) return 'none';
  if (delta >= 4) return 'high';
  if (delta >= 3) return 'medium';
  return 'low';
}

export function classifyAge(days) {
  if (days < 90)  return 'fresh';
  if (days < 180) return 'aging';
  return 'old';
}

export function contentAgeDays(createdAt) {
  if (!createdAt) return 0;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

export function signalCount(decayTypes) {
  if (!decayTypes) return 0;
  return ['ranking','ctr','clicks','impression'].filter(k => decayTypes[k]).length;
}
