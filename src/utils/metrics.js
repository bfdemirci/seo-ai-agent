export function sum(rows, field) {
  return rows.reduce((s, r) => s + (r[field] || 0), 0);
}
export function average(rows, field) {
  if (!rows.length) return 0;
  return sum(rows, field) / rows.length;
}
export function weightedAvgPosition(rows) {
  const totalImp = sum(rows, 'impressions');
  if (!totalImp) return average(rows, 'position');
  return rows.reduce((s, r) => s + (r.position || 0) * (r.impressions || 0), 0) / totalImp;
}
export function weightedCtr(rows) {
  const totalImp = sum(rows, 'impressions');
  if (!totalImp) return 0;
  return sum(rows, 'clicks') / totalImp;
}
export function deltaPct(baseline, recent) {
  if (!baseline || baseline === 0) return null;
  return parseFloat((((recent - baseline) / baseline) * 100).toFixed(2));
}
export function filterWindow(rows, start, end) {
  return rows.filter(r => r.date >= start && r.date <= end);
}
