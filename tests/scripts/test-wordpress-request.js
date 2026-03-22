
import 'dotenv/config';
import { wordpressRequest } from '../../src/integrations/wordpress/wordpressRequest.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  WordPress Request Helper Test');
console.log('\u2500'.repeat(60));

// 1. export
console.log('\n\u25b6 1. Export');
check('is function',   typeof wordpressRequest === 'function');
check('is async',      wordpressRequest.constructor.name === 'AsyncFunction');

// 2. success — no retry needed
console.log('\n\u25b6 2. Success response');
var r1 = await wordpressRequest({
  fetcher: async function() { return { ok: true, status: 200, json: async function() { return { id: 1 }; } }; },
  url: 'https://example.com', method: 'GET', retries: 2, retryDelayMs: 1,
});
check('ok true',        r1.ok === true);
check('status 200',     r1.status === 200);
check('attempts 1',     r1.attempts === 1);
check('timedOut false', r1.timedOut === false);
check('error null',     r1.error === null);
check('raw has id',     (r1.raw || {}).id === 1);

// 3. 500 → retry → success
console.log('\n\u25b6 3. 500 retry → success');
var calls3 = 0;
var r2 = await wordpressRequest({
  fetcher: async function() {
    calls3++;
    if (calls3 < 3) return { ok: false, status: 500, json: async function() { return {}; } };
    return { ok: true, status: 200, json: async function() { return { ok: true }; } };
  },
  url: 'https://example.com', retries: 3, retryDelayMs: 1,
});
check('ok true after retry', r2.ok === true);
check('attempts 3',           r2.attempts === 3);
check('timedOut false',       r2.timedOut === false);

// 4. 429 → retry → success
console.log('\n\u25b6 4. 429 retry');
var calls4 = 0;
var r3 = await wordpressRequest({
  fetcher: async function() {
    calls4++;
    if (calls4 === 1) return { ok: false, status: 429, json: async function() { return {}; } };
    return { ok: true, status: 200, json: async function() { return {}; } };
  },
  url: 'https://example.com', retries: 2, retryDelayMs: 1,
});
check('429 retried ok',  r3.ok === true);
check('attempts 2',      r3.attempts === 2);

// 5. 400 → no retry
console.log('\n\u25b6 5. 400 no retry');
var calls5 = 0;
var r4 = await wordpressRequest({
  fetcher: async function() { calls5++; return { ok: false, status: 400, json: async function() { return {}; } }; },
  url: 'https://example.com', retries: 3, retryDelayMs: 1,
});
check('ok false',        r4.ok === false);
check('no retry on 400', r4.attempts === 1);
check('status 400',      r4.status === 400);

// 6. 401 → no retry
console.log('\n\u25b6 6. 401 no retry');
var calls6 = 0;
var r5 = await wordpressRequest({
  fetcher: async function() { calls6++; return { ok: false, status: 401, json: async function() { return {}; } }; },
  url: 'https://example.com', retries: 3, retryDelayMs: 1,
});
check('ok false',        r5.ok === false);
check('no retry on 401', r5.attempts === 1);

// 7. network error → retry → success
console.log('\n\u25b6 7. Network error retry');
var calls7 = 0;
var r6 = await wordpressRequest({
  fetcher: async function() {
    calls7++;
    if (calls7 < 2) throw new Error('Connection reset');
    return { ok: true, status: 201, json: async function() { return { id: 5 }; } };
  },
  url: 'https://example.com', retries: 2, retryDelayMs: 1,
});
check('ok true',          r6.ok === true);
check('attempts 2',       r6.attempts === 2);

// 8. all retries exhausted
console.log('\n\u25b6 8. All retries exhausted');
var r7 = await wordpressRequest({
  fetcher: async function() { return { ok: false, status: 503, json: async function() { return {}; } }; },
  url: 'https://example.com', retries: 2, retryDelayMs: 1,
});
check('ok false',         r7.ok === false);
check('attempts 3',       r7.attempts === 3);
check('error present',    typeof r7.error === 'string');

// 9. timeout
console.log('\n\u25b6 9. Timeout');
var r8 = await wordpressRequest({
  fetcher: async function(url, opts) {
    return new Promise(function(resolve, reject) {
      var t = setTimeout(function() { resolve({ ok: true, status: 200, json: async function() { return {}; } }); }, 500);
      opts.signal.addEventListener('abort', function() { clearTimeout(t); var e = new Error('AbortError'); e.name = 'AbortError'; reject(e); });
    });
  },
  url: 'https://example.com', timeoutMs: 10, retries: 0, retryDelayMs: 1,
});
check('ok false on timeout',    r8.ok === false);
check('timedOut true',          r8.timedOut === true);
check('error mentions timeout', r8.error && r8.error.includes('timeout'));

// 10. return shape contract
console.log('\n\u25b6 10. Return shape contract');
var r9 = await wordpressRequest({
  fetcher: async function() { return { ok: true, status: 200, json: async function() { return {}; } }; },
  url: 'https://example.com', retries: 0, retryDelayMs: 1,
});
check('has ok',       typeof r9.ok === 'boolean');
check('has status',   r9.status !== undefined);
check('has data',     r9.data !== undefined);
check('has raw',      r9.raw !== undefined);
check('has error',    r9.error !== undefined);
check('has attempts', typeof r9.attempts === 'number');
check('has timedOut', typeof r9.timedOut === 'boolean');

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
