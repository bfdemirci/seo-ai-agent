import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE   = path.resolve(__dirname, '..', '..', 'storage', 'articles');

function snapshotPath(articleId) {
  return path.join(STORAGE, articleId, 'gsc_snapshots.json');
}

function ensureDir(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); }

function readSnapshots(articleId) {
  const fp = snapshotPath(articleId);
  if (!fs.existsSync(fp)) return [];
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return []; }
}

function writeSnapshots(articleId, rows) {
  const fp = snapshotPath(articleId);
  ensureDir(fp);
  fs.writeFileSync(fp, JSON.stringify(rows, null, 2) + '\n', 'utf8');
}

function dedupeKey(s) {
  return `${s.date}__${s.page ?? ''}__${s.query ?? ''}`;
}

function sortByDate(rows) {
  return [...rows].sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function saveGscSnapshots(articleId, snapshots) {
  writeSnapshots(articleId, sortByDate(snapshots));
}

export function getGscSnapshots(articleId) {
  return readSnapshots(articleId);
}

export function appendGscSnapshots(articleId, snapshots) {
  const existing = readSnapshots(articleId);
  const seen     = new Set(existing.map(dedupeKey));
  const incoming = snapshots.filter(s => !seen.has(dedupeKey(s)));
  const merged   = sortByDate([...existing, ...incoming]);
  writeSnapshots(articleId, merged);
  return { added: incoming.length, total: merged.length };
}

export function getLatestGscSnapshot(articleId) {
  const rows = readSnapshots(articleId);
  return rows.length ? rows[rows.length - 1] : null;
}

export function summarizeGscSnapshots(articleId) {
  const rows = readSnapshots(articleId);
  if (!rows.length) return { totalRows: 0, totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0, latestDate: null };

  const totalClicks      = rows.reduce((s, r) => s + (r.clicks      ?? 0), 0);
  const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const avgCtr           = totalImpressions > 0 ? parseFloat((totalClicks / totalImpressions).toFixed(6)) : 0;
  const avgPosition      = parseFloat((rows.reduce((s, r) => s + (r.position ?? 0), 0) / rows.length).toFixed(2));
  const latestDate       = rows[rows.length - 1]?.date ?? null;

  return { totalRows: rows.length, totalClicks, totalImpressions, avgCtr, avgPosition, latestDate };
}
