import { fetchArticleGSCData } from './gscService.js';
import { getGscSnapshots, appendGscSnapshots } from '../../repositories/gscSnapshotRepository.js';
import { listArticles } from '../../repositories/articleRepository.js';

const MAX_SNAPSHOTS = 30;

export async function syncArticleGscMemory(article) {
  try {
    if (!article) return { ok: false, articleId: null, skipped: true, reason: 'no article', snapshot: null };

    const meta       = (article && article.meta) || article || {};
    const articleId  = meta.id || article.id || null;
    const pubUrl     = meta.publishedUrl || meta.published_url || null;

    if (!articleId) return { ok: false, articleId: null, skipped: true, reason: 'no articleId', snapshot: null };
    if (!pubUrl)    return { ok: false, articleId, skipped: true, reason: 'no publishedUrl', snapshot: null };

    const gsc = await fetchArticleGSCData(article);
    if (!gsc || !gsc.ok) {
      return { ok: false, articleId, skipped: true, reason: gsc?.error ?? 'GSC fetch failed', snapshot: null };
    }

    const rows = Array.isArray(gsc.rows) ? gsc.rows : [];
    if (!rows.length) return { ok: false, articleId, skipped: true, reason: 'no rows returned', snapshot: null };

    const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
    const totalClicks      = rows.reduce((s, r) => s + (r.clicks      ?? 0), 0);
    const avgCtr           = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition      = rows.reduce((s, r) => s + (r.position ?? 0), 0) / rows.length;

    const today = new Date().toISOString().slice(0, 10);
    const snapshot = {
      date:        today,
      clicks:      totalClicks,
      impressions: totalImpressions,
      ctr:         parseFloat(avgCtr.toFixed(6)),
      position:    parseFloat(avgPosition.toFixed(2)),
    };

    // dedupe by date — skip if today already exists
    const existing = getGscSnapshots(articleId);
    if (existing.some(s => s.date === today)) {
      return { ok: true, articleId, skipped: true, reason: 'already synced today', snapshot: null };
    }

    // enforce max 30
    let merged = [...existing, snapshot];
    if (merged.length > MAX_SNAPSHOTS) {
      merged = merged.slice(merged.length - MAX_SNAPSHOTS);
      const { saveGscSnapshots } = await import('../../repositories/gscSnapshotRepository.js');
      saveGscSnapshots(articleId, merged);
    } else {
      appendGscSnapshots(articleId, [snapshot]);
    }

    return { ok: true, articleId, skipped: false, reason: null, snapshot };
  } catch (err) {
    const articleId = article?.id || article?.meta?.id || null;
    return { ok: false, articleId, skipped: false, reason: err?.message ?? String(err), snapshot: null };
  }
}

export async function syncAllArticlesGscMemory() {
  const result = { ok: true, total: 0, success: 0, skipped: 0, failed: 0, items: [] };
  try {
    const articles = listArticles({ limit: 999999 });
    result.total = articles.length;
    for (const art of articles) {
      try {
        const r = await syncArticleGscMemory(art);
        result.items.push(r);
        if (r.skipped)     result.skipped++;
        else if (r.ok)     result.success++;
        else               result.failed++;
      } catch (_) {
        result.failed++;
      }
    }
  } catch (err) {
    console.error('[GSC_MEMORY] syncAllArticlesGscMemory error:', err?.message);
    result.ok = false;
  }
  return result;
}
