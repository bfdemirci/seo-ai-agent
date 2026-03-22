import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { validateArticleId, validateVersion, validateCurrentVersion, validateMetadataPatch } from '../../validators/article.validator.js';
import { getArticles, getArticle, getVersions, getVersion, patchCurrentVersion, patchMetadata } from '../../controllers/articles.controller.js';
import { getGscSummary, listGscSnapshots, syncGsc } from '../../controllers/analytics.controller.js';
import { validateGscQuery } from '../../validators/analytics.validator.js';
import { getDecay, recomputeDecay } from '../../controllers/decision.controller.js';

var router = Router();
router.use(requireAuth);

router.get('/',                                                          getArticles);
router.get('/:articleId',       validate(validateArticleId),            getArticle);
router.get('/:articleId/versions', validate(validateArticleId),         getVersions);
router.get('/:articleId/versions/:version', validate(validateArticleId), validate(validateVersion), getVersion);
router.patch('/:articleId/current-version', validate(validateArticleId), validate(validateCurrentVersion), patchCurrentVersion);
router.patch('/:articleId/metadata',        validate(validateArticleId), validate(validateMetadataPatch),  patchMetadata);

// analytics
router.get('/:articleId/analytics/gsc',           validate(validateArticleId),                          getGscSummary);
router.get('/:articleId/analytics/gsc/snapshots', validate(validateArticleId), validate(validateGscQuery), listGscSnapshots);
router.post('/:articleId/analytics/gsc/sync',     validate(validateArticleId),                          syncGsc);

// decay
router.get('/:articleId/decay',              validate(validateArticleId), getDecay);
router.post('/:articleId/decay/recompute',   validate(validateArticleId), recomputeDecay);

export default router;
