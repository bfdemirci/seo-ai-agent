
import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { optimizeArticleController } from '../../controllers/optimization.controller.js';

var router = Router();
router.post('/articles/:articleId/optimize', requireAuth, optimizeArticleController);
export default router;
