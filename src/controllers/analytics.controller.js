import { ok, notFound, serverError } from '../services/api/responseBuilder.js';
import { getArticleById } from '../repositories/articleRepository.js';
import { getGscSnapshots, summarizeGscSnapshots } from '../repositories/gscSnapshotRepository.js';
import { syncArticleGscData } from '../services/analytics/gscAnalyticsService.js';
import { parsePagination } from '../services/api/pagination.js';

export function getGscSummary(req, res) {
  try {
    var id = req.params.articleId;
    if (!getArticleById(id)) return notFound(res, 'Article not found');
    var summary = summarizeGscSnapshots(id);
    return ok(res, { articleId: id, summary: summary });
  } catch (err) { return serverError(res, err.message); }
}

export function listGscSnapshots(req, res) {
  try {
    var id = req.params.articleId;
    if (!getArticleById(id)) return notFound(res, 'Article not found');
    var p = parsePagination(req.query);
    var q = req.query || {};
    var rows = getGscSnapshots(id);
    if (q.startDate) rows = rows.filter(function(r){ return r.date >= q.startDate; });
    if (q.endDate)   rows = rows.filter(function(r){ return r.date <= q.endDate;   });
    var total = rows.length;
    var items = rows.slice(p.offset, p.offset + p.limit);
    return ok(res, { articleId: id, items: items, total: total, limit: p.limit, offset: p.offset });
  } catch (err) { return serverError(res, err.message); }
}

export async function syncGsc(req, res) {
  try {
    var id = req.params.articleId;
    if (!getArticleById(id)) return notFound(res, 'Article not found');
    // MVP: inject a no-op fetcher — returns 0 rows (real OAuth not wired)
    var mockFetcher = function() { return Promise.resolve({ rows: [] }); };
    var today = new Date().toISOString().slice(0, 10);
    var monthAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0, 10);
    var result = await syncArticleGscData({
      articleId: id,
      siteUrl: 'https://example.com',
      page: '/',
      startDate: monthAgo,
      endDate: today,
      fetcher: mockFetcher,
    });
    return ok(res, { articleId: id, rowsFetched: result.rowsFetched, rowsAdded: result.rowsAdded, totalRows: result.total });
  } catch (err) { return serverError(res, err.message); }
}
