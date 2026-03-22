import { ok, badRequest } from '../services/api/responseBuilder.js';
import { parsePagination, buildPagination } from '../services/api/pagination.js';
import { saveRevenueEvent, listRevenueEvents, summarizeRevenue } from '../repositories/revenueRepository.js';

var VALID_TYPES = ['lead', 'sale', 'conversion', 'manual_value'];

export function createRevenueEventController(req, res) {
  try {
    var body = req.body || {};
    if (!body.type || !VALID_TYPES.includes(body.type)) {
      return badRequest(res, 'type must be one of: ' + VALID_TYPES.join(', '));
    }
    var value = parseFloat(body.value);
    if (isNaN(value) || value < 0) return badRequest(res, 'value must be a non-negative number');

    var event = {
      eventId:   'rev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
      siteId:    body.siteId    || null,
      articleId: body.articleId || null,
      keyword:   body.keyword   || null,
      type:      body.type,
      value:     value,
      currency:  body.currency  || 'USD',
      source:    body.source    || null,
      notes:     body.notes     || null,
    };

    var saved = saveRevenueEvent(event);
    return ok(res, saved);
  } catch (err) {
    return ok(res, { error: err && err.message });
  }
}

export function listRevenueEventsController(req, res) {
  try {
    var { limit, offset } = parsePagination(req.query);
    var { items, total }  = listRevenueEvents({ limit, offset });
    return ok(res, { items, pagination: buildPagination(total, limit, offset) });
  } catch (err) {
    return ok(res, { items: [], pagination: { total: 0, limit: 20, offset: 0 } });
  }
}

export function summarizeRevenueController(req, res) {
  try {
    var siteId    = req.query.siteId    || null;
    var articleId = req.query.articleId || null;
    var keyword   = req.query.keyword   || null;
    var summary   = summarizeRevenue({ siteId, articleId, keyword });
    return ok(res, summary);
  } catch (err) {
    return ok(res, { totalValue: 0, totalEvents: 0, leads: 0, sales: 0, conversions: 0, latestEventAt: null });
  }
}
