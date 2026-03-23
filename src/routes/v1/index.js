import { Router } from 'express';
import healthRoutes       from './health.routes.js';
import authRoutes         from './auth.routes.js';
import generateRoutes     from './generate.routes.js';
import articlesRoutes     from './articles.routes.js';
import publishRoutes      from './publish.routes.js';
import publisherRoutes    from './publisher.routes.js';
import publishStatusRoutes from './publishStatus.routes.js';
import optimizationRoutes from './optimization.routes.js';
import programmaticRoutes from './programmatic.routes.js';
import orchestratorRoutes from './orchestrator.routes.js';
import runHistoryRoutes   from './runHistory.routes.js';
import revenueRoutes      from './revenue.routes.js';
import sitesRoutes        from './sites.routes.js';

var router = Router();

router.use('/health',       healthRoutes);
router.use('/auth',         authRoutes);
router.use('/generate',     generateRoutes);
router.use('/articles',     articlesRoutes);
router.use('/orchestrator', orchestratorRoutes);
router.use('/run-history',  runHistoryRoutes);
router.use('/revenue',      revenueRoutes);
router.use('/sites',        sitesRoutes);
router.use('/programmatic', programmaticRoutes);
router.use('', publishRoutes);
router.use('', publisherRoutes);
router.use('', publishStatusRoutes);
router.use('', optimizationRoutes);

export default router;
