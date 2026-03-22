
import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { publishArticleHandler } from '../../controllers/publish.controller.js';
import { verifyWordpressConnection } from '../../services/publisher/wordpressStagingVerifyService.js';
import { verifyPublishedPost } from '../../services/publisher/wordpressPublishVerifyService.js';
import { ok as apiOk, badRequest, serverError } from '../../services/api/responseBuilder.js';

var router = Router();

router.post('/articles/:articleId/publish', requireAuth, publishArticleHandler);

router.get('/publish/verify-connection', requireAuth, async function(req, res) {
  try {
    var result = await verifyWordpressConnection();
    return apiOk(res, result);
  } catch (err) {
    return serverError(res, err.message || 'verify connection failed');
  }
});

router.post('/publish/verify-post', requireAuth, async function(req, res) {
  try {
    var body = req.body || {};
    if (!body.postId) return badRequest(res, 'postId required');
    var result = await verifyPublishedPost({
      postId:         body.postId,
      expectedSlug:   body.expectedSlug   || null,
      expectedStatus: body.expectedStatus || null,
    });
    return apiOk(res, result);
  } catch (err) {
    return serverError(res, err.message || 'verify post failed');
  }
});

import { updateArticleTracking } from '../../services/tracking/articleTrackingService.js';
import { getArticleById } from '../../repositories/articleRepository.js';
import { notFound } from '../../services/api/responseBuilder.js';

router.post('/articles/:articleId/tracking/update', requireAuth, async function(req, res) {
  try {
    var articleId = req.params.articleId;
    if (!getArticleById(articleId)) return notFound(res, 'Article not found: ' + articleId);
    var result = await updateArticleTracking(articleId);
    return apiOk(res, result);
  } catch (err) {
    return serverError(res, err.message || 'tracking update failed');
  }
});

export default router;
