import { fetchArticleGSCData }  from './gscService.js';
import { appendGscSnapshots, getGscSnapshots } from '../../repositories/gscSnapshotRepository.js';
import { listArticles } from '../../repositories/articleRepository.js';

const MAX_SNAPSHOTS = 30;

export async function syncArticleGSC(article) {
  try {
    const meta        = (article && article.meta) || article || {};
    const articleId   = meta.id || article.id;
    const publishedUrl = meta.publishedUrl || null;

    if (!articleId)    return { ok: false, error: 'no articleId', snapshot: null };
    if (!publishedUrl) return { ok: false, error: 'no publishedUrl', snapshot: null };

    const gscResult = await fetchArticleGSCData(article);
    if (!gscResult || !gscResult.ok) {
      return { ok: false, error: gscResult?.error ?? 'GSC fetch failed', snapshot: null };
    }

    const rows = Array.isArray(gscResult.rows) ? gscResult.rows : [];
    if (!rows.length) return { ok: false, error: 'no GSC rows returned', snapshot: null };

    // aggregate rows into single snapshot
    const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
    const totalClicks      = rows.reduce((s, r) => s + (r.clicks      ?? 0), 0);
    const avgCtr           = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition      = rows.reduce((s, r) => s + (r.position ?? 0), 0) / rows.length;

    const snapshot = {
      date:        new Date().toISOString().slice(0, 10),
      timestamp:   new Date().toISOString(),
      impressions: totalImpressions,
      clicks:      totalClicks,
      ctr:         parseFloat(avgCtr.toFixed(6)),
      position:    parseFloat(avgPosition.toFixed(2)),
    };

    // read existing, enforce max 30
    const existing = getGscSnapshots(articleId);
    let merged = [...existing, snapshot];
    if (merged.length > MAX_SNAPSHOTS) merged = merged.slice(merged.length - MAX_SNAPSHOTS);

    appendGscSnapshots(articleId, [snapshot]);

    return { ok: true, snapshot };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err), snapshot: null };
  }
}

export async function syncAllArticlesGSC() {
  const results = { ok: true, total: 0, success: 0, failed: 0 };
  try {
    const articles = listArticles({ limit: 999999 });
    results.total = articles.length;
    for (const art of articles) {
      try {
        const r = await syncArticleGSC(art);
        if (r.ok) results.success++;
        else      results.failed++;
      } catch (_) {
        results.failed++;
      }
    }
  } catch (err) {
    console.error('[GSC_SYNC] syncAllArticlesGSC error:', err?.message);
    results.ok = false;
  }
  return results;
}
