import { ok, serverError, badRequest } from '../services/api/responseBuilder.js';
import { getKeywordIntel } from '../services/seo/semrush.service.js';

export async function keywordOverview(req, res) {
  try {
    var keyword = (req.query.keyword || req.body.keyword || '').trim();
    if (!keyword) return badRequest(res, 'keyword is required');
    var data = await getKeywordIntel(keyword);
    return ok(res, data);
  } catch(e) { return serverError(res, e.message); }
}

export async function keywordBulk(req, res) {
  try {
    var keywords = req.body.keywords;
    if (!Array.isArray(keywords) || !keywords.length) return badRequest(res, 'keywords array required');
    var results = await Promise.all(keywords.slice(0,10).map(function(kw) {
      return getKeywordIntel(kw.trim()).catch(function(e) {
        return { keyword: kw, error: e.message };
      });
    }));
    return ok(res, { items: results, total: results.length });
  } catch(e) { return serverError(res, e.message); }
}
