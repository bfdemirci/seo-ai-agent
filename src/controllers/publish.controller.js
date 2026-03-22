
import { publishArticle } from '../services/publisher/publisherService.js';
import { getArticleById } from '../repositories/articleRepository.js';
import { ok, notFound, serverError } from '../services/api/responseBuilder.js';

export async function publishArticleHandler(req, res) {
  try {
    var articleId = req.params.articleId;
    var article = getArticleById(articleId);
    if (!article) return notFound(res, 'Article not found: ' + articleId);

    var result = await publishArticle(articleId);
    return ok(res, {
      ok:              result.ok,
      skipped:         result.skipped || false,
      reason:          result.reason  || null,
      wordpressPostId: result.wordpressPostId || null,
      url:             result.url   || null,
      error:           result.error || null,
    });
  } catch (err) {
    return serverError(res, err.message || 'Publish failed.');
  }
}
