import { ok, notFound, badRequest } from '../services/api/responseBuilder.js';
import { listSites, getSiteById, saveSite, updateSite } from '../repositories/siteRepository.js';

export function listSitesController(req, res) {
  try {
    var sites = listSites({ includeDisabled: true });
    return ok(res, { items: sites, total: sites.length });
  } catch (err) { return ok(res, { items: [], total: 0 }); }
}

export function getSiteController(req, res) {
  try {
    var site = getSiteById(req.params.siteId);
    if (!site) return notFound(res, 'Site not found');
    return ok(res, site);
  } catch (err) { return notFound(res, 'Site not found'); }
}

export function createSiteController(req, res) {
  try {
    var body = req.body || {};
    if (!body.siteId) return badRequest(res, 'siteId is required');
    if (!body.name)   return badRequest(res, 'name is required');
    var existing = getSiteById(body.siteId);
    if (existing) return badRequest(res, 'siteId already exists');
    var saved = saveSite(body);
    if (!saved) return badRequest(res, 'failed to save site');
    return ok(res, saved);
  } catch (err) { return badRequest(res, err && err.message); }
}

export function updateSiteController(req, res) {
  try {
    var existing = getSiteById(req.params.siteId);
    if (!existing) return notFound(res, 'Site not found');
    var updated = updateSite(req.params.siteId, req.body || {});
    return ok(res, updated);
  } catch (err) { return badRequest(res, err && err.message); }
}
