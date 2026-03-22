
import { getArticleById } from '../repositories/articleRepository.js';
import { getArticlePublishStatus, listPublishedArticles, findPublishIntegrityIssues } from '../services/publisher/publishStatusService.js';
import { ok, notFound, serverError } from '../services/api/responseBuilder.js';

export async function getArticlePublishStatusController(req, res) {
  try {
    var articleId = req.params.articleId;
    var article = getArticleById(articleId);
    if (!article) return notFound(res, 'Article not found: ' + articleId);
    var status = getArticlePublishStatus(articleId);
    return ok(res, status);
  } catch (err) {
    return serverError(res, err.message || 'publish status failed');
  }
}

export async function listPublishedArticlesController(req, res) {
  try {
    var q = req.query || {};
    var result = listPublishedArticles({
      onlyPublished:  q.onlyPublished  === 'true',
      onlyFailed:     q.onlyFailed     === 'true',
      onlyRetryable:  q.onlyRetryable  === 'true',
      limit:          parseInt(q.limit  || '50', 10),
      offset:         parseInt(q.offset || '0',  10),
    });
    return ok(res, result);
  } catch (err) {
    return serverError(res, err.message || 'list published articles failed');
  }
}

export async function getPublishIssuesController(req, res) {
  try {
    var result = findPublishIntegrityIssues({});
    return ok(res, result);
  } catch (err) {
    return serverError(res, err.message || 'publish issues check failed');
  }
}
