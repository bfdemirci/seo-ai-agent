/**
 * gscClient.js
 * Abstraction over the Google Search Console API.
 * Returns normalized plain JS objects — callers never see raw API responses.
 *
 * Inject a custom `fetcher` for tests so no real credentials are needed.
 */

import { GSC_CONFIG } from '../../config/gsc.js';

// ── Normalizer ────────────────────────────────────────────────────────────────

function normalizeRow(row, page, query) {
  return {
    date:        (row.keys && row.keys[0]) || null,
    page:        page || (row.keys && row.keys[1]) || null,
    query:       query || (row.keys && row.keys[2]) || null,
    clicks:      row.clicks      || 0,
    impressions: row.impressions || 0,
    ctr:         parseFloat((row.ctr      || 0).toFixed(6)),
    position:    parseFloat((row.position || 0).toFixed(2)),
    source:      'gsc',
  };
}

// ── Default real fetcher (requires valid accessToken) ────────────────────────

async function defaultFetcher({ siteUrl, requestBody, accessToken }) {
  const url = `${GSC_CONFIG.apiBase}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GSC API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * fetchSitePageQueryMetrics
 * Returns rows for a specific page across all queries.
 */
export async function fetchSitePageQueryMetrics({
  siteUrl,
  page,
  startDate,
  endDate,
  rowLimit = GSC_CONFIG.defaultRowLimit,
  accessToken = null,
  fetcher     = defaultFetcher,
}) {
  const requestBody = {
    startDate,
    endDate,
    dimensions:      ['date', 'page', 'query'],
    dimensionFilterGroups: [{
      filters: [{ dimension: 'page', expression: page, operator: 'equals' }],
    }],
    rowLimit,
  };

  const data = await fetcher({ siteUrl, requestBody, accessToken });
  return (data.rows || []).map(row => normalizeRow(row, page, null));
}

/**
 * fetchSiteWideQueryMetrics
 * Returns top-level site queries without page filter.
 */
export async function fetchSiteWideQueryMetrics({
  siteUrl,
  startDate,
  endDate,
  rowLimit = GSC_CONFIG.defaultRowLimit * 2,
  accessToken = null,
  fetcher     = defaultFetcher,
}) {
  const requestBody = {
    startDate,
    endDate,
    dimensions: ['date', 'query'],
    rowLimit,
  };

  const data = await fetcher({ siteUrl, requestBody, accessToken });
  return (data.rows || []).map(row => normalizeRow(row, null, null));
}

import { getAccessToken } from './gscAuth.js';

export async function getSearchAnalytics({
  siteUrl,
  startDate,
  endDate,
  dimensions,
  rowLimit,
}) {
  dimensions = dimensions || ['query', 'page'];
  rowLimit   = rowLimit   || 50;

  var auth = await getAccessToken();
  if (!auth.ok) return { ok: false, error: auth.error, rows: [] };

  var encoded = encodeURIComponent(siteUrl);
  var url     = 'https://searchconsole.googleapis.com/webmasters/v3/sites/' + encoded + '/searchAnalytics/query';

  try {
    var res  = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': 'Bearer ' + auth.token,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ startDate: startDate, endDate: endDate, dimensions: dimensions, rowLimit: rowLimit }),
    });
    var data = await res.json();

    if (!res.ok) {
      var msg = ((data.error || {}).message) || ('GSC API error ' + res.status);
      return { ok: false, error: msg, rows: [] };
    }

    var raw  = (data.rows || []);
    var rows = raw.map(function(row) {
      var keys = row.keys || [];
      var qIdx = dimensions.indexOf('query');
      var pIdx = dimensions.indexOf('page');
      var dIdx = dimensions.indexOf('date');
      return {
        date:        (dIdx > -1 ? keys[dIdx] : null) || null,
        page:        (pIdx > -1 ? keys[pIdx] : null) || null,
        query:       (qIdx > -1 ? keys[qIdx] : null) || null,
        clicks:      row.clicks      || 0,
        impressions: row.impressions || 0,
        ctr:         parseFloat((row.ctr      || 0).toFixed(6)),
        position:    parseFloat((row.position || 0).toFixed(2)),
      };
    });

    return { ok: true, rows: rows };
  } catch (err) {
    return { ok: false, error: err.message || 'getSearchAnalytics failed', rows: [] };
  }
}
