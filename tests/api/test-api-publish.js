
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
console.log('  API Publish Test');
console.log('\u2500'.repeat(60));

// login
var lr = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'testpass' });
var token = 'Bearer ' + ((lr.body.data || {}).token || '');

function makeArticle(keyword, metaOverride) {
  var id = createArticleRecord({
    keyword: keyword, article: '<p>' + keyword + '</p>',
    outline: '', research: {}, evaluation: { scoreV1: { overallScore: 75 } }, finalization: {},
  });
  if (metaOverride) updateArticleMetadata(id, metaOverride);
  return id;
}

// 1. No auth → 401
console.log('\n\u25b6 1. Auth guard');
var r1 = await request(app).post('/api/v1/articles/any/publish');
check('no token → 401', r1.status === 401);

// 2. Unknown article → 404
console.log('\n\u25b6 2. Unknown article');
var r2 = await request(app).post('/api/v1/articles/art_nonexistent_xxx/publish').set('Authorization', token);
check('unknown article 404', r2.status === 404);

// 3. Decision false (wrong status) → skipped
console.log('\n\u25b6 3. Decision false → skipped');
var skipId = makeArticle('publish-test-skip');
// status is finalized by default — not ready
var r3 = await request(app).post('/api/v1/articles/' + skipId + '/publish').set('Authorization', token);
check('status 200',         r3.status === 200);
check('ok false',           (r3.body.data || {}).ok === false);
check('skipped true',       (r3.body.data || {}).skipped === true);
check('reason present',     typeof (r3.body.data || {}).reason === 'string');

// 4. Decision false (low score) → skipped
console.log('\n\u25b6 4. Low score → skipped');
var lowId = makeArticle('publish-test-low-score', {
  status: 'ready',
  latestEvaluation: { scoreV1: { overallScore: 30 } },
});
var r4 = await request(app).post('/api/v1/articles/' + lowId + '/publish').set('Authorization', token);
check('status 200',         r4.status === 200);
check('skipped true',       (r4.body.data || {}).skipped === true);
check('reason mentions score', ((r4.body.data || {}).reason || '').includes('30'));

// 5. WP env missing → safe error (not crash)
console.log('\n\u25b6 5. No WP env → safe error returned');
var noWpId = makeArticle('publish-test-no-wp', {
  status: 'ready',
  latestEvaluation: { scoreV1: { overallScore: 75 } },
});
// clear WP env
var savedUrl = process.env.WORDPRESS_BASE_URL;
delete process.env.WORDPRESS_BASE_URL;
var r5 = await request(app).post('/api/v1/articles/' + noWpId + '/publish').set('Authorization', token);
process.env.WORDPRESS_BASE_URL = savedUrl || '';
check('status 200',         r5.status === 200);
check('ok false',           (r5.body.data || {}).ok === false);
check('skipped false',      (r5.body.data || {}).skipped === false);
check('error present',      typeof (r5.body.data || {}).error === 'string');

// 6. Mock WP → success
console.log('\n\u25b6 6. Mock WP success');
process.env.WORDPRESS_BASE_URL     = 'https://example.com';
process.env.WORDPRESS_USERNAME     = 'admin';
process.env.WORDPRESS_APP_PASSWORD = 'fake pass';
global.fetch = async function() {
  return { ok: true, status: 201, json: async function() { return { id: 99, link: 'https://example.com/test', status: 'draft' }; } };
};
var wpId = makeArticle('publish-test-wp-success', {
  status: 'ready',
  latestEvaluation: { scoreV1: { overallScore: 75 } },
});
var r6 = await request(app).post('/api/v1/articles/' + wpId + '/publish').set('Authorization', token);
check('status 200',               r6.status === 200);
check('ok true',                  (r6.body.data || {}).ok === true);
check('skipped false',            (r6.body.data || {}).skipped === false);
check('wordpressPostId 99',       (r6.body.data || {}).wordpressPostId === 99);
check('url set',                  typeof (r6.body.data || {}).url === 'string');
check('error null',               (r6.body.data || {}).error === null);

// 7. Already published → skipped
console.log('\n\u25b6 7. Already published → skipped');
var r7 = await request(app).post('/api/v1/articles/' + wpId + '/publish').set('Authorization', token);
check('status 200',               r7.status === 200);
check('skipped true (2nd call)',  (r7.body.data || {}).skipped === true);
check('reason mentions already',  ((r7.body.data || {}).reason || '').includes('already'));

// 8. Response shape contract
console.log('\n\u25b6 8. Response shape contract');
check('has ok',              (r6.body.data || {}).ok !== undefined);
check('has skipped',         (r6.body.data || {}).skipped !== undefined);
check('has reason',          (r6.body.data || {}).reason !== undefined);
check('has wordpressPostId', (r6.body.data || {}).wordpressPostId !== undefined);
check('has url',             (r6.body.data || {}).url !== undefined);
check('has error',           (r6.body.data || {}).error !== undefined);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
