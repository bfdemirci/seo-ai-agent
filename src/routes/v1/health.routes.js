import { Router } from 'express';
import { getHealth, getHealthDetails, getHealthRuntime } from '../../controllers/health.controller.js';
var router = Router();
router.get('/',       getHealth);
router.get('/details', getHealthDetails);
router.get('/runtime', getHealthRuntime);
export default router;
