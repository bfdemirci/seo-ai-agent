
var RETRY_STATUSES = [429, 500, 502, 503, 504];
var NO_RETRY_STATUSES = [400, 401, 403, 404, 405, 409, 422];

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

export async function wordpressRequest(opts) {
  var fetcher     = opts.fetcher || fetch;
  var url         = opts.url;
  var method      = opts.method  || 'GET';
  var headers     = opts.headers || {};
  var body        = opts.body    || undefined;
  var timeoutMs   = opts.timeoutMs   || 15000;
  var retries     = opts.retries     || 3;
  var retryDelayMs= opts.retryDelayMs|| 500;

  var attempts = 0;
  var lastError = null;

  for (var i = 0; i <= retries; i++) {
    attempts++;
    var timedOut = false;
    var controller = new AbortController();
    var timer = setTimeout(function() {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      var fetchOpts = { method: method, headers: headers, signal: controller.signal };
      if (body !== undefined) fetchOpts.body = body;

      var res = await fetcher(url, fetchOpts);
      clearTimeout(timer);

      var raw = null;
      try { raw = await res.json(); } catch(e) { raw = null; }

      if (res.ok) {
        return { ok: true, status: res.status, data: raw, raw: raw, error: null, attempts: attempts, timedOut: false };
      }

      // non-ok response
      var shouldRetry = RETRY_STATUSES.indexOf(res.status) >= 0;
      lastError = 'HTTP ' + res.status;

      if (!shouldRetry || i === retries) {
        return { ok: false, status: res.status, data: raw, raw: raw, error: lastError, attempts: attempts, timedOut: false };
      }

      // exponential backoff
      var delay = retryDelayMs * Math.pow(2, i);
      await sleep(delay);

    } catch (err) {
      clearTimeout(timer);

      if (timedOut || (err && err.name === 'AbortError')) {
        lastError = 'Request timeout after ' + timeoutMs + 'ms';
        if (i < retries) {
          await sleep(retryDelayMs * Math.pow(2, i));
          continue;
        }
        return { ok: false, status: null, data: null, raw: null, error: lastError, attempts: attempts, timedOut: true };
      }

      lastError = (err && err.message) || 'Network error';
      if (i < retries) {
        await sleep(retryDelayMs * Math.pow(2, i));
        continue;
      }
      return { ok: false, status: null, data: null, raw: null, error: lastError, attempts: attempts, timedOut: false };
    }
  }

  return { ok: false, status: null, data: null, raw: null, error: lastError || 'max retries exceeded', attempts: attempts, timedOut: false };
}
