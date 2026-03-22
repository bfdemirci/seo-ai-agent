import { runAutoGrowthCycle } from '../services/orchestrator/runAutoGrowthCycle.js';
import { saveRun, getRunById, listRuns } from '../repositories/orchestratorRunRepository.js';
import { getArticleById } from '../repositories/articleRepository.js';
import { ok, notFound, serverError, badRequest } from '../services/api/responseBuilder.js';

var VALID_MODES = ['dry_run', 'execute'];

export async function runOrchestrator(req, res) {
  try {
    var mode = (req.body && req.body.mode) || 'dry_run';
    var keyword = (req.body && req.body.keyword) || null;
    var limit = (req.body && req.body.limit) || 50;
    if (!VALID_MODES.includes(mode)) return badRequest(res, 'Invalid mode. Use dry_run or execute.');
    var limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) return badRequest(res, 'limit must be between 1 and 100.');
    var run = await runAutoGrowthCycle({ mode: mode, keyword: keyword, limit: limitNum });
    if (mode === 'execute') saveRun(run);
    return ok(res, run);
  } catch (err) {
    return serverError(res, err.message || 'Orchestrator run failed.');
  }
}

export async function getRuns(req, res) {
  try {
    var limit = parseInt((req.query && req.query.limit) || '50', 10);
    var offset = parseInt((req.query && req.query.offset) || '0', 10);
    if (isNaN(limit) || limit < 1) limit = 50;
    if (isNaN(offset) || offset < 0) offset = 0;
    var result = listRuns({ limit: limit, offset: offset });
    return ok(res, { items: result.items, total: result.total });
  } catch (err) {
    return serverError(res, err.message || 'Failed to list runs.');
  }
}

export async function getRunDetail(req, res) {
  try {
    var run = getRunById(req.params.runId);
    if (!run) return notFound(res, 'Run not found.');
    return ok(res, run);
  } catch (err) {
    return serverError(res, err.message || 'Failed to get run.');
  }
}

export async function runArticle(req, res) {
  try {
    var articleId = req.params.articleId;
    var mode = (req.body && req.body.mode) || 'dry_run';
    if (!VALID_MODES.includes(mode)) return badRequest(res, 'Invalid mode. Use dry_run or execute.');
    var article = getArticleById(articleId);
    if (!article) return notFound(res, 'Article not found.');
    var run = await runAutoGrowthCycle({ mode: mode, articleId: articleId });
    if (mode === 'execute') saveRun(run);
    return ok(res, run);
  } catch (err) {
    return serverError(res, err.message || 'Article run failed.');
  }
}
