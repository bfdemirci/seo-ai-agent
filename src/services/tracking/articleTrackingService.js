import { fetchArticleGSCData } from '../gsc/gscService.js';

/**
 * articleTrackingService.js
 * Post-publish tracking: GSC snapshot check + index status update.
 */

import { getArticleById, updateArticleMetadata } from '../../repositories/articleRepository.js';
import { getGscSnapshots } from '../../repositories/gscSnapshotRepository.js';
import { resolveIndexStatus } from '../analytics/gscAnalyticsService.js';

/**
 * updateArticleTracking(articleId)
 * returns: { ok, indexStatus, snapshotCount, error? }
 */
export async function updateArticleTracking(articleId) {
  var article = getArticleById(articleId);
  if (!article) {
    return { ok: false, indexStatus: 'unknown', snapshotCount: 0, error: 'Article not found: ' + articleId };
  }

  var snapshots = [];
  try {
    snapshots = getGscSnapshots(articleId) || [];
  } catch (e) {
    snapshots = [];
  }

  var indexStatus = resolveIndexStatus(snapshots);
  var now = new Date().toISOString();

  try {
    updateArticleMetadata(articleId, {
      lastCheckedAt: now,
      lastGscSyncAt: now,
      indexStatus:   indexStatus,
    });
  } catch (e) {
    return { ok: false, indexStatus: indexStatus, snapshotCount: snapshots.length, error: 'metadata update failed: ' + e.message };
  }

  return { ok: true, indexStatus: indexStatus, snapshotCount: snapshots.length };
}

export async function updateTrackingWithGSC(articleId) {
  try {
    var { getArticleById } = await import('../../../src/repositories/articleRepository.js').catch(function() {
      return import('../../repositories/articleRepository.js');
    });
    var record = getArticleById(articleId);
    if (!record) return { ok: false, error: 'article not found' };
    var article = record.meta || record;
    var gscResult = await fetchArticleGSCData(article);
    return gscResult;
  } catch(err) {
    return { ok: false, error: err.message || 'updateTrackingWithGSC failed' };
  }
}
