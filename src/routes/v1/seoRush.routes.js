import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { keywordOverview, keywordBulk } from '../../controllers/seoRush.controller.js';

const router = Router();
router.get('/keyword', requireAuth, keywordOverview);
router.post('/keyword/bulk', requireAuth, keywordBulk);

export default router;
