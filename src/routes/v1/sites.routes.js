import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { listSitesController, getSiteController, createSiteController, updateSiteController } from '../../controllers/sites.controller.js';

const router = Router();
router.get('/',           requireAuth, listSitesController);
router.get('/:siteId',    requireAuth, getSiteController);
router.post('/',          requireAuth, createSiteController);
router.patch('/:siteId',  requireAuth, updateSiteController);
export default router;
