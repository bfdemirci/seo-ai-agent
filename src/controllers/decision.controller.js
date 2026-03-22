import { ok, notFound, serverError } from '../services/api/responseBuilder.js';
import { getArticleById } from '../repositories/articleRepository.js';
import { getGscSnapshots } from '../repositories/gscSnapshotRepository.js';
import { detectDecay } from '../services/decision/decayDetector.js';

function runDecay(articleId) {
  var snapshots = [];
  try { snapshots = getGscSnapshots(articleId); } catch(_) {}
  return detectDecay(articleId, snapshots);
}

export function getDecay(req, res) {
  try {
    var { articleId } = req.params;
    if (!getArticleById(articleId)) return notFound(res, 'Article not found');
    return ok(res, runDecay(articleId));
  } catch (err) { return serverError(res, err.message); }
}

export function recomputeDecay(req, res) {
  try {
    var { articleId } = req.params;
    if (!getArticleById(articleId)) return notFound(res, 'Article not found');
    return ok(res, runDecay(articleId));
  } catch (err) { return serverError(res, err.message); }
}
