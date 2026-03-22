
import { getArticleById } from '../repositories/articleRepository.js';
import { runAutoOptimizationForArticle } from '../services/maintenance/autoOptimizationService.js';
import { ok, notFound, serverError } from '../services/api/responseBuilder.js';

export async function optimizeArticleController(req, res) {
  try {
    var articleId = req.params.articleId;
    var article   = getArticleById(articleId);
    if (!article) return notFound(res, 'Article not found: ' + articleId);
    var safeMode = req.body && req.body.safeMode !== false;
    var result   = await runAutoOptimizationForArticle(articleId, { safeMode: safeMode });
    return ok(res, {
      articleId:  articleId,
      keyword:    (article.meta || article).keyword || null,
      decay:      result.decay      || null,
      decision:   result.decision   || null,
      execution:  result.execution  || null,
      error:      result.error      || null,
    });
  } catch (err) {
    return serverError(res, err.message || 'optimization failed');
  }
}
