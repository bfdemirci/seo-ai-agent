import { Router } from 'express';
import { generate } from '../../controllers/generate.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { validateGenerate } from '../../validators/generate.validator.js';
var router = Router();
router.post('/', requireAuth, validate(validateGenerate), generate);
export default router;
