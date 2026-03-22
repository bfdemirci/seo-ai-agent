import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { listRunHistoryController, getRunHistoryController } from '../../controllers/runHistory.controller.js';

const router = Router();
router.get('/runs',        requireAuth, listRunHistoryController);
router.get('/runs/:runId', requireAuth, getRunHistoryController);
export default router;
