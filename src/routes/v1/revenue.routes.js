import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { createRevenueEventController, listRevenueEventsController, summarizeRevenueController } from '../../controllers/revenue.controller.js';

const router = Router();
router.post('/events',  requireAuth, createRevenueEventController);
router.get('/events',   requireAuth, listRevenueEventsController);
router.get('/summary',  requireAuth, summarizeRevenueController);
export default router;
