
import { listArticles, getArticleById } from '../../repositories/articleRepository.js';

function safeEvents(article) {
  var meta = (article && article.meta) || article || {};
  return Array.isArray(meta.events) ? meta.events : [];
}

function safeMeta(article) {
  return (article && article.meta) || article || {};
}

export function getArticlePublishStatus(articleId) {
  var article = getArticleById(articleId);
  if (!article) {
    return { articleId: articleId, exists: false, isPublished: false, publishedUrl: null, publishedAt: null,
             wordpressPostId: null, lastPublishEvent: null, publishEventCount: 0, lastPublishError: null,
             canRetry: false, currentVersion: null, status: null, keyword: null };
  }
  var meta    = safeMeta(article);
  var events  = safeEvents(article);

  var publishEvents = events.filter(function(e) {
    return e && (e.type === 'published_to_wordpress' || e.type === 'publish_attempt' || e.type === 'publish_failed');
  });

  var lastSuccess = null;
  var lastFail    = null;
  var lastError   = null;

  for (var i = publishEvents.length - 1; i >= 0; i--) {
    var ev = publishEvents[i];
    if (!lastSuccess && (ev.type === 'published_to_wordpress' || ev.ok === true)) lastSuccess = ev;
    if (!lastFail    && (ev.type === 'publish_failed'          || ev.ok === false)) { lastFail = ev; lastError = ev.error || null; }
    if (lastSuccess && lastFail) break;
  }

  var isPublished      = !!(meta.publishedUrl);
  var wordpressPostId  = meta.wordpressPostId || (lastSuccess && lastSuccess.wordpressPostId) || null;
  var canRetry         = !isPublished && publishEvents.length > 0 && !!lastFail;

  return {
    articleId:        articleId,
    exists:           true,
    isPublished:      isPublished,
    publishedUrl:     meta.publishedUrl  || null,
    publishedAt:      meta.publishedAt   || null,
    wordpressPostId:  wordpressPostId,
    lastPublishEvent: publishEvents.length > 0 ? publishEvents[publishEvents.length - 1] : null,
    publishEventCount:publishEvents.length,
    lastPublishError: lastError,
    canRetry:         canRetry,
    currentVersion:   meta.currentVersion || null,
    status:           meta.status         || null,
    keyword:          meta.keyword        || null,
  };
}

export function listPublishedArticles(opts) {
  var onlyPublished  = (opts && opts.onlyPublished)  || false;
  var onlyFailed     = (opts && opts.onlyFailed)     || false;
  var onlyRetryable  = (opts && opts.onlyRetryable)  || false;
  var limit          = (opts && opts.limit)  || 50;
  var offset         = (opts && opts.offset) || 0;

  var articles = listArticles();
  var items = [];

  for (var i = 0; i < articles.length; i++) {
    var a      = articles[i];
    var id     = a.id || (a.meta && a.meta.id) || null;
    if (!id) continue;
    var status = getArticlePublishStatus(id);

    if (onlyPublished  && !status.isPublished)   continue;
    if (onlyFailed     && status.isPublished)     continue;
    if (onlyFailed     && !status.lastPublishError && status.publishEventCount === 0) continue;
    if (onlyRetryable  && !status.canRetry)       continue;

    items.push({
      articleId:       status.articleId,
      keyword:         status.keyword,
      isPublished:     status.isPublished,
      publishedUrl:    status.publishedUrl,
      publishedAt:     status.publishedAt,
      wordpressPostId: status.wordpressPostId,
      canRetry:        status.canRetry,
      status:          status.status,
    });
  }

  var total   = items.length;
  var paged   = items.slice(offset, offset + limit);
  return { total: total, items: paged };
}

export function findPublishIntegrityIssues(opts) {
  var articles = listArticles();
  var issues   = [];

  for (var i = 0; i < articles.length; i++) {
    var a  = articles[i];
    var id = a.id || (a.meta && a.meta.id) || null;
    if (!id) continue;
    var status = getArticlePublishStatus(id);
    var kw     = status.keyword || id;

    // issue: URL var ama wordpressPostId yok
    if (status.publishedUrl && !status.wordpressPostId) {
      issues.push({ articleId: id, keyword: kw, issueType: 'missing_post_id', severity: 'warning', note: 'publishedUrl set but wordpressPostId missing' });
    }

    // issue: publish event var ama metadata yok
    if (status.publishEventCount > 0 && !status.isPublished && !status.canRetry) {
      issues.push({ articleId: id, keyword: kw, issueType: 'orphan_publish_event', severity: 'info', note: 'publish events exist but no publishedUrl and not retryable' });
    }

    // issue: retryable ama cok fazla fail
    if (status.canRetry && status.publishEventCount > 3) {
      issues.push({ articleId: id, keyword: kw, issueType: 'repeated_failures', severity: 'warning', note: 'multiple publish attempts failed — may need manual review' });
    }
  }

  return { totalIssues: issues.length, items: issues };
}
