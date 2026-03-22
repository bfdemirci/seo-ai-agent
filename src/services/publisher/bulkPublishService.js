
import { listArticles } from '../../repositories/articleRepository.js';
import { publishArticle } from './publisherService.js';

var _queue   = [];
var _running = false;
var _results = [];

export function enqueueArticles(articleIds) {
  var added = 0;
  for (var i = 0; i < articleIds.length; i++) {
    var id = articleIds[i];
    if (_queue.indexOf(id) === -1) {
      _queue.push(id);
      added++;
    }
  }
  return { enqueued: added, total: _queue.length };
}

export function getQueueStatus() {
  return {
    pending:  _queue.length,
    running:  _running,
    results:  _results.slice(),
  };
}

export function clearQueue() {
  _queue   = [];
  _results = [];
  _running = false;
}

export async function runQueue(opts) {
  if (_running) return { ok: false, error: 'queue already running' };
  var concurrency = (opts && opts.concurrency) || 1;
  var dryRun      = (opts && opts.dryRun)      || false;

  _running = true;
  _results = [];

  var ids = _queue.slice();
  _queue  = [];

  for (var i = 0; i < ids.length; i++) {
    var articleId = ids[i];
    try {
      if (dryRun) {
        _results.push({ articleId: articleId, ok: false, skipped: true, reason: 'dry_run', error: null });
      } else {
        var result = await publishArticle(articleId);
        _results.push({
          articleId:       articleId,
          ok:              result.ok,
          skipped:         result.skipped || false,
          reason:          result.reason  || null,
          wordpressPostId: result.wordpressPostId || null,
          url:             result.url    || null,
          error:           result.error  || null,
        });
      }
    } catch (err) {
      _results.push({ articleId: articleId, ok: false, skipped: false, reason: null, error: err.message || 'unknown error' });
    }
  }

  _running = false;
  return {
    ok:      true,
    total:   _results.length,
    success: _results.filter(function(r) { return r.ok; }).length,
    skipped: _results.filter(function(r) { return r.skipped; }).length,
    failed:  _results.filter(function(r) { return !r.ok && !r.skipped; }).length,
    results: _results.slice(),
  };
}

export async function bulkPublishAll(opts) {
  var articles = listArticles();
  var ids = articles.map(function(a) { return a.id; });
  enqueueArticles(ids);
  return runQueue(opts);
}
