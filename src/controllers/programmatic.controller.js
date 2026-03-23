import { ok, notFound, serverError, badRequest } from '../services/api/responseBuilder.js';
import {
  createCampaign, listCampaigns, getCampaign, updateCampaignStatus,
  addKeywords, getQueue, getQueueStats, getHistory, processQueue
} from '../services/programmatic/programmaticEngine.js';

export function listCampaignsController(req, res) {
  try {
    return ok(res, { items: listCampaigns() });
  } catch(e) { return serverError(res, e.message); }
}

export function createCampaignController(req, res) {
  try {
    var body = req.body || {};
    if (!body.name)   return badRequest(res, 'name is required');
    if (!body.siteId) return badRequest(res, 'siteId is required');
    var camp = createCampaign(body);
    return ok(res, camp);
  } catch(e) { return serverError(res, e.message); }
}

export function updateCampaignController(req, res) {
  try {
    var camp = getCampaign(req.params.campaignId);
    if (!camp) return notFound(res, 'Campaign not found');
    var updated = updateCampaignStatus(req.params.campaignId, req.body.status || camp.status);
    return ok(res, updated);
  } catch(e) { return serverError(res, e.message); }
}

export function addKeywordsController(req, res) {
  try {
    var campaignId = req.params.campaignId || req.body.campaignId;
    if (!campaignId) return badRequest(res, 'campaignId is required');
    var keywords = req.body.keywords;
    if (!Array.isArray(keywords) || !keywords.length) return badRequest(res, 'keywords array is required');
    var result = addKeywords(campaignId, keywords);
    return ok(res, result);
  } catch(e) { return serverError(res, e.message); }
}

export function getQueueController(req, res) {
  try {
    var filter = {};
    if (req.query.status)     filter.status     = req.query.status;
    if (req.query.campaignId) filter.campaignId = req.query.campaignId;
    var items = getQueue(filter);
    var stats = getQueueStats();
    return ok(res, { items, stats, total: items.length });
  } catch(e) { return serverError(res, e.message); }
}

export function getHistoryController(req, res) {
  try {
    var limit = parseInt(req.query.limit) || 100;
    var items = getHistory(limit);
    return ok(res, { items, total: items.length });
  } catch(e) { return serverError(res, e.message); }
}

export async function runNowController(req, res) {
  try {
    var result = await processQueue();
    return ok(res, result);
  } catch(e) { return serverError(res, e.message); }
}
