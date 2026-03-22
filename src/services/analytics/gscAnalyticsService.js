import { fetchSitePageQueryMetrics } from '../../integrations/gsc/gscClient.js';
import { saveGscSnapshots, appendGscSnapshots, summarizeGscSnapshots } from '../../repositories/gscSnapshotRepository.js';
import { getArticleById, updateArticleMetadata, appendArticleEvent } from '../../repositories/articleRepository.js';

// ── URL helpers ───────────────────────────────────────────────────────────────

export function extractPagePath(url) {
  if (!url) return '/';
  try {
    const u = new URL(url);
    return u.pathname || '/';
  } catch {
    // already a path
    const stripped = url.replace(/^https?:\/\/[^/]+/, '');
    return stripped || '/';
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * syncArticleGscData
 * Fetches GSC metrics for a known page path and stores them.
 */
export async function syncArticleGscData({
  articleId,
  siteUrl,
  page,
  startDate,
  endDate,
  accessToken = null,
  fetcher     = undefined,
}) {
  const record = getArticleById(articleId);
  if (!record) throw new Error(`Article not found: ${articleId}`);

  const fetchOpts = { siteUrl, page, startDate, endDate, accessToken };
  if (fetcher) fetchOpts.fetcher = fetcher;

  const rows = await fetchSitePageQueryMetrics(fetchOpts);

  const { added, total } = appendGscSnapshots(articleId, rows);

  // metadata updates
  const partial = {
    lastGscSyncAt: new Date().toISOString(),
    snapshotCount: total,
  };

  // set initialPosition only once, from first snapshot with a valid position
  if (!record.meta.initialPosition && rows.length > 0) {
    const firstWithPos = rows.find(r => r.position > 0);
    if (firstWithPos) partial.initialPosition = firstWithPos.position;
  }

  updateArticleMetadata(articleId, partial);

  appendArticleEvent(articleId, {
    type:       'gsc_sync',
    page,
    startDate,
    endDate,
    rowsFetched: rows.length,
    rowsAdded:   added,
  });

  return { rowsFetched: rows.length, rowsAdded: added, total };
}

/**
 * syncArticleGscDataByUrl
 * Convenience wrapper that derives the page path from a full URL.
 */
export async function syncArticleGscDataByUrl({
  articleId,
  siteUrl,
  publishedUrl,
  startDate,
  endDate,
  accessToken = null,
  fetcher     = undefined,
}) {
  const page = extractPagePath(publishedUrl);
  return syncArticleGscData({ articleId, siteUrl, page, startDate, endDate, accessToken, fetcher });
}

/**
 * getArticleGscSummary
 */
export function getArticleGscSummary(articleId) {
  return summarizeGscSnapshots(articleId);
}

/**
 * resolveIndexStatus
 * Determines index status based on available GSC snapshots.
 */
export function resolveIndexStatus(snapshots) {
  if (!snapshots || snapshots.length === 0) return 'not_indexed';
  return 'indexed';
}
