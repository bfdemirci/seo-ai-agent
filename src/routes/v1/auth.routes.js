import { Router } from 'express';
import { login } from '../../controllers/auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { validateLogin } from '../../validators/auth.validator.js';
var router = Router();
router.post('/login', validate(validateLogin), login);
export default router;
