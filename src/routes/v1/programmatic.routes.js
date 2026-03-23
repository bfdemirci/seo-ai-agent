import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import {
  listCampaignsController, createCampaignController, updateCampaignController,
  addKeywordsController, getQueueController, getHistoryController, runNowController
} from '../../controllers/programmatic.controller.js';

const router = Router();

router.get( '/campaigns',                    requireAuth, listCampaignsController);
router.post('/campaigns',                    requireAuth, createCampaignController);
router.patch('/campaigns/:campaignId',       requireAuth, updateCampaignController);
router.post('/campaigns/:campaignId/keywords', requireAuth, addKeywordsController);
router.get( '/queue',                        requireAuth, getQueueController);
router.get( '/history',                      requireAuth, getHistoryController);
router.post('/run',                          requireAuth, runNowController);

export default router;
