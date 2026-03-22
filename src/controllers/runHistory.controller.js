import { ok, notFound } from '../services/api/responseBuilder.js';
import { parsePagination, buildPagination } from '../services/api/pagination.js';
import { listRunHistory, getRunHistoryById } from '../repositories/runHistoryRepository.js';

export function listRunHistoryController(req, res) {
  try {
    const { limit, offset } = parsePagination(req.query);
    const { items, total }  = listRunHistory({ limit, offset });
    return ok(res, { items, pagination: buildPagination(total, limit, offset) });
  } catch (err) {
    return ok(res, { items: [], pagination: { total: 0, limit: 20, offset: 0 } });
  }
}

export function getRunHistoryController(req, res) {
  try {
    const run = getRunHistoryById(req.params.runId);
    if (!run) return notFound(res, 'Run not found');
    return ok(res, run);
  } catch (err) {
    return notFound(res, 'Run not found');
  }
}
