import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { runCampaign } from '../../controllers/programmatic.controller.js';

var router = Router();

router.post('/programmatic/run', requireAuth, runCampaign);

export default router;
