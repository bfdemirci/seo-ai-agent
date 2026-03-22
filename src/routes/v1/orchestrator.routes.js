import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { runOrchestrator, getRuns, getRunDetail, runArticle } from '../../controllers/orchestrator.controller.js';

var router = Router();

router.post('/run', requireAuth, runOrchestrator);
router.get('/runs', requireAuth, getRuns);
router.get('/runs/:runId', requireAuth, getRunDetail);
router.post('/articles/:articleId/run', requireAuth, runArticle);

export default router;
