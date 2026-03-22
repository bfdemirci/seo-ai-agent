
import 'dotenv/config';
import app from '../../src/app.js';
import request from 'supertest';
import { createArticleRecord, updateArticleMetadata, appendArticleEvent } from '../../src/repositories/articleRepository.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  API Publish Status Test');
console.log('\u2500'.repeat(60));

var lr = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'testpass' });
var token = 'Bearer ' + ((lr.body.data || {}).token || '');

var artId = createArticleRecord({ keyword: 'status-api-test', article: '<p>x</p>', outline: '', research: {}, evaluation: {}, finalization: {} });
var pubId = createArticleRecord({ keyword: 'status-published-api', article: '<p>y</p>', outline: '', research: {}, evaluation: {}, finalization: {} });
updateArticleMetadata(pubId, { publishedUrl: 'https://example.com/pub', publishedAt: new Date().toISOString() });
appendArticleEvent(pubId, { type: 'published_to_wordpress', wordpressPostId: 88, ok: true });

// ── A. Auth guard ──────────────────────────────────────────────────────────────
console.log('\n\u25b6 A. Auth guard');
var a1 = await request(app).get('/api/v1/articles/' + artId + '/publish/status');
check('no token → 401',        a1.status === 401);
var a2 = await request(app).get('/api/v1/publish/articles');
check('no token list → 401',   a2.status === 401);
var a3 = await request(app).get('/api/v1/publish/issues');
check('no token issues → 401', a3.status === 401);

// ── B. Article publish status ──────────────────────────────────────────────────
console.log('\n\u25b6 B. Article publish status');
var b1 = await request(app).get('/api/v1/articles/nonexistent_xxx/publish/status').set('Authorization', token);
check('unknown article → 404',   b1.status === 404);

var b2 = await request(app).get('/api/v1/articles/' + artId + '/publish/status').set('Authorization', token);
check('status 200',              b2.status === 200);
var d2 = b2.body.data || {};
check('has isPublished',         d2.isPublished !== undefined);
check('has publishEventCount',   d2.publishEventCount !== undefined);
check('has canRetry',            d2.canRetry !== undefined);
check('has exists',              d2.exists === true);
check('has keyword',             d2.keyword === 'status-api-test');

var b3 = await request(app).get('/api/v1/articles/' + pubId + '/publish/status').set('Authorization', token);
var d3 = b3.body.data || {};
check('published article status 200', b3.status === 200);
check('isPublished true',             d3.isPublished === true);
check('publishedUrl present',         typeof d3.publishedUrl === 'string');

// ── C. Published list ──────────────────────────────────────────────────────────
console.log('\n\u25b6 C. Published list');
var c1 = await request(app).get('/api/v1/publish/articles').set('Authorization', token);
check('status 200',            c1.status === 200);
check('items array',           Array.isArray((c1.body.data || {}).items));
check('total number',          typeof (c1.body.data || {}).total === 'number');

var c2 = await request(app).get('/api/v1/publish/articles?onlyPublished=true').set('Authorization', token);
check('onlyPublished filter 200', c2.status === 200);
var pubItems = (c2.body.data || {}).items || [];
check('all items published',   pubItems.every(function(i) { return i.isPublished; }));

var c3 = await request(app).get('/api/v1/publish/articles?onlyRetryable=true').set('Authorization', token);
check('onlyRetryable filter 200', c3.status === 200);
var retItems = (c3.body.data || {}).items || [];
check('all items retryable',   retItems.every(function(i) { return i.canRetry; }));

var c4 = await request(app).get('/api/v1/publish/articles?limit=2&offset=0').set('Authorization', token);
check('limit param works',     (c4.body.data || {}).items.length <= 2);

// ── D. Issues ──────────────────────────────────────────────────────────────────
console.log('\n\u25b6 D. Issues');
var d1 = await request(app).get('/api/v1/publish/issues').set('Authorization', token);
check('status 200',            d1.status === 200);
check('items array',           Array.isArray((d1.body.data || {}).items));
check('totalIssues number',    typeof (d1.body.data || {}).totalIssues === 'number');

// ── E. Response contract ──────────────────────────────────────────────────────
console.log('\n\u25b6 E. Response contract');
check('success key',           b2.body.success !== undefined);
check('data key',              b2.body.data !== undefined);
check('meta key',              b2.body.meta !== undefined);
check('meta.requestId',        typeof (b2.body.meta || {}).requestId === 'string');
check('meta.version v1',       (b2.body.meta || {}).version === 'v1');

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
