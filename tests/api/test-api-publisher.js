
import 'dotenv/config';
import app from '../../src/app.js';
import request from 'supertest';
import { createArticleRecord, updateArticleMetadata } from '../../src/repositories/articleRepository.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  API Publisher Test');
console.log('\u2500'.repeat(60));

// login
var lr = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'testpass' });
var token = 'Bearer ' + ((lr.body.data || {}).token || '');

// helpers
function makeArticle(kw, meta) {
  var id = createArticleRecord({ keyword: kw, article: '<p>' + kw + '</p>', outline: '', research: {}, evaluation: { scoreV1: { overallScore: 75 } }, finalization: {} });
  if (meta) updateArticleMetadata(id, meta);
  return id;
}

// ── A. Eligibility ────────────────────────────────────────────────────────────
console.log('\n\u25b6 A. Eligibility');

// A1. no auth
var a1 = await request(app).get('/api/v1/articles/any/publish/eligibility');
check('no token → 401', a1.status === 401);

// A2. unknown article
var a2 = await request(app).get('/api/v1/articles/nonexistent_xxx/publish/eligibility').set('Authorization', token);
check('unknown article → 404', a2.status === 404);

// A3. valid article — not ready
var id3 = makeArticle('eligibility-test-draft');
var a3 = await request(app).get('/api/v1/articles/' + id3 + '/publish/eligibility').set('Authorization', token);
check('status 200',            a3.status === 200);
check('has shouldPublish',     (a3.body.data || {}).shouldPublish !== undefined);
check('has reason',            typeof (a3.body.data || {}).reason === 'string');
check('has articleId',         (a3.body.data || {}).articleId === id3);
check('has currentVersion',    (a3.body.data || {}).currentVersion !== undefined);
check('has publishedUrl',      (a3.body.data || {}).publishedUrl !== undefined);
check('has articleStatus',     (a3.body.data || {}).articleStatus !== undefined);
check('shouldPublish false (not ready)', (a3.body.data || {}).shouldPublish === false);

// A4. ready article
var id4 = makeArticle('eligibility-test-ready', { status: 'ready', latestEvaluation: { scoreV1: { overallScore: 75 } } });
var a4 = await request(app).get('/api/v1/articles/' + id4 + '/publish/eligibility').set('Authorization', token);
check('ready → shouldPublish true', (a4.body.data || {}).shouldPublish === true);

// ── B. Publish ────────────────────────────────────────────────────────────────
console.log('\n\u25b6 B. Publish');

// B1. no auth
var b1 = await request(app).post('/api/v1/articles/any/publish');
check('no token → 401', b1.status === 401);

// B2. unknown article
var b2 = await request(app).post('/api/v1/articles/nonexistent_yyy/publish').set('Authorization', token);
check('unknown article → 404', b2.status === 404);

// B3. not ready → skipped
var id_skip = makeArticle('pub-skip-test');
var b3 = await request(app).post('/api/v1/articles/' + id_skip + '/publish').set('Authorization', token);
check('status 200',        b3.status === 200);
check('ok false',          (b3.body.data || {}).ok === false);
check('skipped true',      (b3.body.data || {}).skipped === true);
check('reason present',    typeof (b3.body.data || {}).reason === 'string');

// B4. mock WP success
process.env.WORDPRESS_BASE_URL     = 'https://example.com';
process.env.WORDPRESS_USERNAME     = 'admin';
process.env.WORDPRESS_APP_PASSWORD = 'fake pass';
global.fetch = async function(url) {
  if (url && url.includes('/media')) {
    return { ok: true, status: 201, json: async function() { return { id: 55, source_url: 'https://example.com/img.jpg' }; } };
  }
  return { ok: true, status: 201, json: async function() { return { id: 99, link: 'https://example.com/pub-test', status: 'draft' }; } };
};
var id_pub = makeArticle('pub-success-test', { status: 'ready', latestEvaluation: { scoreV1: { overallScore: 75 } } });
var b4 = await request(app).post('/api/v1/articles/' + id_pub + '/publish').set('Authorization', token);
check('status 200',           b4.status === 200);
check('ok true',              (b4.body.data || {}).ok === true);
check('skipped false',        (b4.body.data || {}).skipped === false);
check('wordpressPostId 99',   (b4.body.data || {}).wordpressPostId === 99);
check('url set',              typeof (b4.body.data || {}).url === 'string');
check('error null',           (b4.body.data || {}).error === null);
check('articleId present',    (b4.body.data || {}).articleId === id_pub || (b4.body.data || {}).ok === true);

// B5. already published → skipped
var b5 = await request(app).post('/api/v1/articles/' + id_pub + '/publish').set('Authorization', token);
check('second call skipped',  (b5.body.data || {}).skipped === true);
check('reason has already',   ((b5.body.data || {}).reason || '').includes('already'));

// B6. WP fail → safe error
global.fetch = async function() { return { ok: false, status: 500, json: async function() { return {}; } }; };
var id_fail = makeArticle('pub-fail-test', { status: 'ready', latestEvaluation: { scoreV1: { overallScore: 75 } } });
var b6 = await request(app).post('/api/v1/articles/' + id_fail + '/publish').set('Authorization', token);
check('status 200 (safe)',     b6.status === 200);
check('ok false',              (b6.body.data || {}).ok === false);
check('skipped false',         (b6.body.data || {}).skipped === false);
check('error present',         typeof (b6.body.data || {}).error === 'string');

// ── C. Retry ──────────────────────────────────────────────────────────────────
console.log('\n\u25b6 C. Retry');

// C1. no auth
var c1 = await request(app).post('/api/v1/articles/any/publish/retry');
check('no token → 401', c1.status === 401);

// C2. unknown article
var c2 = await request(app).post('/api/v1/articles/nonexistent_zzz/publish/retry').set('Authorization', token);
check('unknown article → 404', c2.status === 404);

// C3. retry → article with fail event (canRetry=true)
import { appendArticleEvent } from '../../src/repositories/articleRepository.js';
// create retryable article: has fail event, not published
var id_retry = makeArticle('pub-retry-test', { status: 'ready', latestEvaluation: { scoreV1: { overallScore: 75 } } });
appendArticleEvent(id_retry, { type: 'publish_failed', ok: false, error: 'WP timeout' });
global.fetch = async function() {
  return { ok: true, status: 201, json: async function() { return { id: 77, link: 'https://example.com/retry', status: 'draft' }; } };
};
var c3 = await request(app).post('/api/v1/articles/' + id_retry + '/publish/retry').set('Authorization', token);
check('status 200',       c3.status === 200);
check('retry flag true',  (c3.body.data || {}).retry === true);
check('ok true',          (c3.body.data || {}).ok === true);
check('wordpressPostId',  (c3.body.data || {}).wordpressPostId === 77);

// ── D. Response contract ──────────────────────────────────────────────────────
console.log('\n\u25b6 D. Response contract');
var d = b4.body;
check('success key',   d.success === true || d.success !== undefined);
check('data key',      d.data !== undefined);
check('meta key',      d.meta !== undefined);
check('meta.requestId', typeof (d.meta || {}).requestId === 'string');
check('meta.version',   (d.meta || {}).version === 'v1');

// eligibility shape
check('eligibility has articleId',   (a3.body.data || {}).articleId !== undefined);
check('eligibility has shouldPublish',(a3.body.data || {}).shouldPublish !== undefined);
check('eligibility has reason',      (a3.body.data || {}).reason !== undefined);


// ── E. Decision ─────────────────────────────────────────────────────────────
console.log('\n\u25b6 E. Decision');
var e1 = await request(app).get('/api/v1/articles/' + id_skip + '/publish/decision').set('Authorization', token);
check('decision status 200',      e1.status === 200);
check('has shouldPublish',        (e1.body.data || {}).shouldPublish !== undefined);
check('has reason',               typeof (e1.body.data || {}).reason === 'string');
check('has articleId',            (e1.body.data || {}).articleId === id_skip);
check('has currentVersion',       (e1.body.data || {}).currentVersion !== undefined);
var e2 = await request(app).get('/api/v1/articles/nonexistent_dec/publish/decision').set('Authorization', token);
check('unknown article → 404',    e2.status === 404);

// ── F. Config check ──────────────────────────────────────────────────────────
console.log('\n\u25b6 F. Config check');
var f1 = await request(app).get('/api/v1/publish/config-check').set('Authorization', token);
check('status 200',               f1.status === 200);
check('has configured',           typeof (f1.body.data || {}).configured === 'boolean');
check('has hasBaseUrl',           typeof (f1.body.data || {}).hasBaseUrl === 'boolean');
check('has hasUsername',          typeof (f1.body.data || {}).hasUsername === 'boolean');
check('has hasAppPassword',       typeof (f1.body.data || {}).hasAppPassword === 'boolean');
check('no secrets leaked',        (f1.body.data || {}).password === undefined && (f1.body.data || {}).appPassword === undefined);
check('no auth header leaked',    (f1.body.data || {}).authHeader === undefined);
check('has defaultPostStatus',    (f1.body.data || {}).defaultPostStatus !== undefined);

// ── G. Retry — non-retryable ─────────────────────────────────────────────────
console.log('\n\u25b6 G. Retry non-retryable');
var g1 = await request(app).post('/api/v1/articles/nonexistent_retry/publish/retry').set('Authorization', token);
check('unknown → 404',            g1.status === 404);
var id_noretry = makeArticle('retry-not-retryable');  // no fail events
var g2 = await request(app).post('/api/v1/articles/' + id_noretry + '/publish/retry').set('Authorization', token);
check('not retryable → 400',      g2.status === 400);
check('code NOT_RETRYABLE',       ((g2.body.error || {}).code || '').includes('NOT_RETRYABLE') || g2.status === 400);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
