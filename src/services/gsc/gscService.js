
import { getSearchAnalytics } from '../../integrations/gsc/gscClient.js';

function deriveSiteUrl(publishedUrl) {
  if (!publishedUrl) return null;
  try {
    var u = new URL(publishedUrl);
    return u.protocol + '//' + u.host + '/';
  } catch(e) {
    return null;
  }
}

function dateStr(daysAgo) {
  var d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export async function fetchArticleGSCData(article) {
  var meta       = (article && article.meta) || article || {};
  var publishedUrl = meta.publishedUrl || null;
  var keyword      = meta.keyword      || null;

  if (!publishedUrl) {
    return { ok: false, error: 'article has no publishedUrl', rows: [], summary: null };
  }

  var siteUrl = deriveSiteUrl(publishedUrl);
  if (!siteUrl) {
    return { ok: false, error: 'could not derive siteUrl from ' + publishedUrl, rows: [], summary: null };
  }

  var endDate   = dateStr(1);
  var startDate = dateStr(7);

  var result = await getSearchAnalytics({
    siteUrl:    siteUrl,
    startDate:  startDate,
    endDate:    endDate,
    dimensions: ['query', 'page'],
    rowLimit:   100,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, rows: [], summary: null };
  }

  var pageNorm = publishedUrl.replace(/\/+$/, '').toLowerCase();
  var rows = (result.rows || []).filter(function(r) {
    var rPage = (r.page || '').replace(/\/+$/, '').toLowerCase();
    return rPage === pageNorm;
  });

  var totalClicks      = 0;
  var totalImpressions = 0;
  var posSum           = 0;
  var posCount         = 0;

  rows.forEach(function(r) {
    totalClicks      += r.clicks      || 0;
    totalImpressions += r.impressions || 0;
    if (r.position) { posSum += r.position; posCount++; }
  });

  var summary = {
    clicks:      totalClicks,
    impressions: totalImpressions,
    avgPosition: posCount > 0 ? parseFloat((posSum / posCount).toFixed(2)) : null,
  };

  return { ok: true, rows: rows, summary: summary };
}

export async function fetchSiteGSCData({ siteUrl, startDate, endDate, dimensions, rowLimit }) {
  return getSearchAnalytics({ siteUrl: siteUrl, startDate: startDate, endDate: endDate, dimensions: dimensions, rowLimit: rowLimit });
}
