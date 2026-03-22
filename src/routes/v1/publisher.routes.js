
import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { getPublishEligibility, publishArticleNow } from '../../controllers/publisher.controller.js';
import { getPublishDecisionController, retryPublishArticleController, getPublishConfigCheckController } from '../../controllers/publisher.controller.js';

var router = Router();
router.get('/articles/:articleId/publish/eligibility', requireAuth, getPublishEligibility);
router.get('/articles/:articleId/publish/decision',    requireAuth, getPublishDecisionController);
router.post('/articles/:articleId/publish',            requireAuth, publishArticleNow);
router.post('/articles/:articleId/publish/retry',      requireAuth, retryPublishArticleController);
router.get('/publish/config-check',                    requireAuth, getPublishConfigCheckController);
export default router;
