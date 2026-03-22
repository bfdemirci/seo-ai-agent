
import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { getArticlePublishStatusController, listPublishedArticlesController, getPublishIssuesController } from '../../controllers/publishStatus.controller.js';

var router = Router();
router.get('/articles/:articleId/publish/status', requireAuth, getArticlePublishStatusController);
router.get('/publish/articles',                   requireAuth, listPublishedArticlesController);
router.get('/publish/issues',                     requireAuth, getPublishIssuesController);
export default router;
