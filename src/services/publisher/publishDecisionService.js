
/**
 * publishDecisionService.js
 * Decides whether an article is eligible for WordPress publish.
 */

export function shouldPublishArticle(article) {
  if (!article || !article.meta) {
    return { shouldPublish: false, reason: 'article not found or invalid' };
  }

  var meta = article.meta;

  if (meta.status !== 'ready') {
    return { shouldPublish: false, reason: 'status is not ready (got: ' + (meta.status || 'none') + ')' };
  }

  if (!meta.currentVersion) {
    return { shouldPublish: false, reason: 'no currentVersion set' };
  }

  if (meta.publishedUrl) {
    return { shouldPublish: false, reason: 'already published at ' + meta.publishedUrl };
  }

  // indexed check — if article was published but not indexed, skip re-publish
  if (meta.indexStatus && meta.indexStatus === 'not_indexed' && meta.publishedAt) {
    return { shouldPublish: false, reason: 'published but not yet indexed — awaiting GSC indexing' };
  }

  // score check
  var eval_ = meta.latestEvaluation || {};
  var score = null;
  if (typeof eval_.overall === 'number') {
    score = eval_.overall;
  } else if (eval_.scoreV1 && typeof eval_.scoreV1.overallScore === 'number') {
    score = eval_.scoreV1.overallScore;
  }

  if (score === null) {
    return { shouldPublish: false, reason: 'no evaluation score found' };
  }

  if (score < 60) {
    return { shouldPublish: false, reason: 'score too low (' + score + ' < 60)' };
  }

  return { shouldPublish: true, reason: 'ready, unpublished, score ' + score };
}
