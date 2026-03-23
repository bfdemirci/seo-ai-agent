import { resolvePublisher, isWordPressPublisher } from '../services/publisher/publisherResolver.js';

import { getArticleById } from '../repositories/articleRepository.js';
import { shouldPublishArticle } from '../services/publisher/publishDecisionService.js';
import { publishArticle } from '../services/publisher/publisherService.js';
import { ok, notFound, serverError } from '../services/api/responseBuilder.js';

export async function getPublishEligibility(req, res) {
  try {
    var articleId = req.params.articleId;
    var article = getArticleById(articleId);
    if (!article) return notFound(res, 'Article not found: ' + articleId);
    var meta = article.meta || {};
    var decision = shouldPublishArticle(article);
    return ok(res, {
      articleId:      articleId,
      shouldPublish:  decision.shouldPublish,
      reason:         decision.reason,
      currentVersion: meta.currentVersion || null,
      publishedUrl:   meta.publishedUrl   || null,
      articleStatus:  meta.status         || null,
      indexStatus:    meta.indexStatus    || null,
    });
  } catch (err) {
    return serverError(res, err.message || 'eligibility check failed');
  }
}

export async function publishArticleNow(req, res) {
  try {
    var articleId = req.params.articleId;
    var article = getArticleById(articleId);
    if (!article) return notFound(res, 'Article not found: ' + articleId);

    // Publisher type guard
    var siteId  = article.site || (req.body && req.body.siteId);
    if (siteId) {
      var { getSiteByIdRaw } = await import('../repositories/siteRepository.js');
      var site = getSiteByIdRaw(siteId);
      if (site && !isWordPressPublisher(site)) {
        var adapter = resolvePublisher(site);
        var adapterResult = await adapter({ article, site });
        return ok(res, adapterResult);
      }
    }

    var result = await publishArticle(articleId);
    return ok(res, {
      articleId:       articleId,
      ok:              result.ok,
      skipped:         result.skipped       || false,
      reason:          result.reason        || null,
      wordpressPostId: result.wordpressPostId || null,
      url:             result.url           || null,
      status:          result.status        || null,
      attempts:        result.attempts      || null,
      timedOut:        result.timedOut      || false,
      error:           result.error         || null,
    });
  } catch (err) {
    return serverError(res, err.message || 'publish failed');
  }
}

export async function retryPublishArticle(req, res) {
  try {
    var articleId = req.params.articleId;
    var article = getArticleById(articleId);
    if (!article) return notFound(res, 'Article not found: ' + articleId);
    var result = await publishArticle(articleId);
    return ok(res, {
      articleId:       articleId,
      retry:           true,
      ok:              result.ok,
      skipped:         result.skipped       || false,
      reason:          result.reason        || null,
      wordpressPostId: result.wordpressPostId || null,
      url:             result.url           || null,
      status:          result.status        || null,
      attempts:        result.attempts      || null,
      timedOut:        result.timedOut      || false,
      error:           result.error         || null,
    });
  } catch (err) {
    return serverError(res, err.message || 'retry publish failed');
  }
}

import { getArticlePublishStatus } from '../services/publisher/publishStatusService.js';

export async function getPublishDecisionController(req, res) {
  try {
    var articleId = req.params.articleId;
    var article = getArticleById(articleId);
    if (!article) return notFound(res, 'Article not found: ' + articleId);
    var meta     = (article.meta || article);
    var decision = shouldPublishArticle(article);
    var score    = (meta.latestEvaluation && meta.latestEvaluation.scoreV1 && meta.latestEvaluation.scoreV1.overallScore) || null;
    return ok(res, {
      articleId:      articleId,
      shouldPublish:  decision.shouldPublish,
      reason:         decision.reason,
      score:          score,
      publishedUrl:   meta.publishedUrl    || null,
      currentVersion: meta.currentVersion  || null,
      status:         meta.status          || null,
    });
  } catch (err) {
    return serverError(res, err.message || 'publish decision failed');
  }
}

export async function retryPublishArticleController(req, res) {
  try {
    var articleId = req.params.articleId;
    var article = getArticleById(articleId);
    if (!article) return notFound(res, 'Article not found: ' + articleId);
    var ps = getArticlePublishStatus(articleId);
    if (!ps.canRetry) {
      return res.status(400).json({ success: false, error: { code: 'NOT_RETRYABLE', message: 'Article is not retryable: ' + (ps.isPublished ? 'already published' : 'no failed publish events') }, meta: { requestId: 'r_' + Date.now(), version: 'v1' } });
    }
    var result = await publishArticle(articleId);
    return ok(res, { articleId: articleId, retry: true, ok: result.ok, skipped: result.skipped || false, reason: result.reason || null, wordpressPostId: result.wordpressPostId || null, url: result.url || null, error: result.error || null });
  } catch (err) {
    return serverError(res, err.message || 'retry publish failed');
  }
}

export async function getPublishConfigCheckController(req, res) {
  try {
    var hasBaseUrl     = !!(process.env.WORDPRESS_BASE_URL);
    var hasUsername    = !!(process.env.WORDPRESS_USERNAME);
    var hasAppPassword = !!(process.env.WORDPRESS_APP_PASSWORD);
    var configured     = hasBaseUrl && hasUsername && hasAppPassword;
    return ok(res, {
      ok:                configured,
      configured:        configured,
      hasBaseUrl:        hasBaseUrl,
      hasUsername:       hasUsername,
      hasAppPassword:    hasAppPassword,
      defaultPostStatus: 'draft',
    });
  } catch (err) {
    return serverError(res, err.message || 'config check failed');
  }
}
