import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const STORAGE    = path.resolve(__dirname, '..', '..', 'storage', 'articles');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dir(id)          { return path.join(STORAGE, id); }
function metaPath(id)     { return path.join(dir(id), 'article.json'); }
function versionsDir(id)  { return path.join(dir(id), 'versions'); }
function versionPath(id, v) { return path.join(versionsDir(id), `${v}.json`); }

function ensureDir(p)     { fs.mkdirSync(p, { recursive: true }); }

function readJSON(fp) {
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch (e) { throw new Error(`Failed to parse ${fp}: ${e.message}`); }
}

function writeJSON(fp, data) {
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function generateId() {
  const ts   = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  return `art_${ts}_${rand}`;
}

function now() { return new Date().toISOString(); }

function nextVersion(articleId) {
  const vDir = versionsDir(articleId);
  if (!fs.existsSync(vDir)) return 'v1';
  const nums = fs.readdirSync(vDir)
    .filter(f => /^v\d+\.json$/.test(f))
    .map(f => parseInt(f.slice(1), 10))
    .sort((a, b) => b - a);
  return nums.length ? `v${nums[0] + 1}` : 'v1';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * createArticleRecord
 * Creates a new article record with v1 version.
 * Returns the generated articleId.
 */
export function createArticleRecord({ keyword, article, outline, research, evaluation, finalization, siteId }) {
  const id  = generateId();
  const ts  = now();
  const ver = 'v1';

  ensureDir(versionsDir(id));

  const meta = {
    id,
    keyword,
    site:             null,
    status:           'finalized',
    createdAt:        ts,
    updatedAt:        ts,
    currentVersion:   ver,
    publishedUrl:     null,
    initialPosition:  null,
    gscSnapshots:     [],
    publishHistory:   [],
    events:           [],
    finalization:     finalization ?? null,
    latestEvaluation: {
      scoreV1:  evaluation?.scoreV1  ?? null,
      scoreV2:  evaluation?.scoreV2  ?? null,
      scoreV3:  evaluation?.scoreV3  ?? null,
      decision: evaluation?.decision ?? null,
    },
  };

  const v1 = {
    version:      ver,
    createdAt:    ts,
    article,
    outline:      outline   ?? null,
    research:     research  ?? null,
    evaluation:   evaluation ?? null,
    finalization: finalization ?? null,
  };

  writeJSON(metaPath(id),          meta);
  writeJSON(versionPath(id, ver),  v1);

  return id;
}

/**
 * saveArticleVersion
 * Appends a new version file and updates currentVersion.
 * Returns the new version string (e.g. "v2").
 */
export function saveArticleVersion(articleId, { article, outline, research, evaluation, finalization, label }) {
  const meta = readJSON(metaPath(articleId));
  if (!meta) throw new Error(`Article not found: ${articleId}`);

  const ver = nextVersion(articleId);
  const ts  = now();

  writeJSON(versionPath(articleId, ver), {
    version:      ver,
    label:        label ?? null,
    createdAt:    ts,
    article,
    outline:      outline      ?? null,
    research:     research     ?? null,
    evaluation:   evaluation   ?? null,
    finalization: finalization ?? null,
  });

  meta.currentVersion   = ver;
  meta.updatedAt        = ts;
  if (evaluation)   meta.latestEvaluation = { scoreV1: evaluation.scoreV1 ?? null, scoreV2: evaluation.scoreV2 ?? null, scoreV3: evaluation.scoreV3 ?? null, decision: evaluation.decision ?? null };
  if (finalization) meta.finalization = finalization;

  writeJSON(metaPath(articleId), meta);
  return ver;
}

/**
 * getArticleById
 * Returns { meta, currentArticle, versionData } or null.
 */
export function getArticleById(articleId) {
  const meta = readJSON(metaPath(articleId));
  if (!meta) return null;

  const vData       = readJSON(versionPath(articleId, meta.currentVersion));
  const currentArticle = vData?.article ?? null;

  const vCount = fs.existsSync(versionsDir(articleId))
    ? fs.readdirSync(versionsDir(articleId)).filter(f => /^v\d+\.json$/.test(f)).length
    : 1;
  return { meta, currentArticle, versionData: vData, versionCount: vCount };
}

/**
 * getArticleByKeyword
 * Returns the most recently updated article matching keyword (case-insensitive).
 */
export function getArticleByKeyword(keyword) {
  if (!fs.existsSync(STORAGE)) return null;
  const kw = keyword.toLowerCase().trim();

  const match = fs.readdirSync(STORAGE)
    .map(id => readJSON(metaPath(id)))
    .filter(m => m && m.keyword.toLowerCase().trim() === kw)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];

  return match ? getArticleById(match.id) : null;
}

/**
 * listArticles
 * Returns array of meta objects sorted by updatedAt desc.
 */
export function listArticles({ limit = 50, siteId = null } = {}) {
  if (!fs.existsSync(STORAGE)) return [];
  return fs.readdirSync(STORAGE)
    .map(id => readJSON(metaPath(id)))
    .filter(Boolean)
    .map(m => {
      const vDir = path.join(STORAGE, m.id, 'versions');
      const vCount = fs.existsSync(vDir)
        ? fs.readdirSync(vDir).filter(f => /^v\d+\.json$/.test(f)).length
        : 1;
      return { ...m, versionCount: vCount };
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, limit);
}

/**
 * updateCurrentVersion
 * Points currentVersion to an existing version without creating a new file.
 */
export function updateCurrentVersion(articleId, version) {
  const meta = readJSON(metaPath(articleId));
  if (!meta) throw new Error(`Article not found: ${articleId}`);
  if (!fs.existsSync(versionPath(articleId, version)))
    throw new Error(`Version ${version} does not exist for article ${articleId}`);
  meta.currentVersion = version;
  meta.updatedAt      = now();
  writeJSON(metaPath(articleId), meta);
}

/**
 * updateArticleMetadata
 * Shallow-merges partial fields into article.json.
 * Use for updating status, publishedUrl, site, etc.
 */
export function updateArticleMetadata(articleId, partial) {
  const meta = readJSON(metaPath(articleId));
  if (!meta) throw new Error(`Article not found: ${articleId}`);
  Object.assign(meta, partial, { updatedAt: now() });
  writeJSON(metaPath(articleId), meta);
}

/**
 * appendArticleEvent
 * Appends a timestamped event to the events array.
 * Useful for tracking publish, reindex, status change, etc.
 */
export function appendArticleEvent(articleId, event) {
  const meta = readJSON(metaPath(articleId));
  if (!meta) throw new Error(`Article not found: ${articleId}`);
  meta.events.push({ ...event, timestamp: now() });
  meta.updatedAt = now();
  writeJSON(metaPath(articleId), meta);
}
