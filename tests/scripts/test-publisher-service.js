
import { createArticleRecord, getArticleById, updateArticleMetadata } from '../../src/repositories/articleRepository.js';
import { publishArticle } from '../../src/services/publisher/publisherService.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

function setEnv() {
  process.env.WORDPRESS_BASE_URL     = 'https://example.com';
  process.env.WORDPRESS_USERNAME     = 'admin';
  process.env.WORDPRESS_APP_PASSWORD = 'abcd 1234 efgh 5678';
}
function clearEnv() {
  delete process.env.WORDPRESS_BASE_URL;
  delete process.env.WORDPRESS_USERNAME;
  delete process.env.WORDPRESS_APP_PASSWORD;
}

function mockFetchSuccess() {
  global.fetch = async function() {
    return { ok: true, status: 201, json: async function() { return { id: 77, link: 'https://example.com/test-keyword', status: 'draft' }; } };
  };
}
function mockFetchFail() {
  global.fetch = async function() {
    return { ok: false, status: 500, json: async function() { return { code: 'server_error', message: 'Internal error' }; } };
  };
}

function makeReadyArticle(keyword) {
  var id = createArticleRecord({
    keyword:     keyword || 'test keyword',
    article:     '<h1>Test</h1><p>Content here for publish test.</p>',
    outline:     '# Outline',
    research:    {},
    evaluation:  { scoreV1: { overallScore: 75 }, scoreV2: null, scoreV3: null, decision: null },
    finalization: { metaTitle: 'Test', metaDescription: 'Desc', slugSuggestion: 'test' },
  });
  // set status to ready + score
  updateArticleMetadata(id, {
    status: 'ready',
    latestEvaluation: { scoreV1: { overallScore: 75 } },
  });
  return id;
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Publisher Service Test');
console.log('\u2500'.repeat(60));

// 1. Export
console.log('\n\u25b6 1. Export');
check('publishArticle is function', typeof publishArticle === 'function');
check('is async', publishArticle.constructor.name === 'AsyncFunction');

// 2. Unknown articleId → error
console.log('\n\u25b6 2. Unknown articleId');
setEnv();
mockFetchSuccess();
var r1 = await publishArticle('art_nonexistent_000');
check('ok false',       r1.ok === false);
check('skipped false',  r1.skipped === false);
check('error present',  typeof r1.error === 'string');

// 3. Decision false (wrong status) → skip
console.log('\n\u25b6 3. Decision false → skipped');
setEnv();
mockFetchSuccess();
var skipId = createArticleRecord({
  keyword: 'skip test', article: '<p>x</p>', outline: '', research: {}, evaluation: {}, finalization: {},
});
// status is 'finalized' by default — not 'ready'
var r2 = await publishArticle(skipId);
check('ok false',      r2.ok === false);
check('skipped true',  r2.skipped === true);
check('reason set',    typeof r2.reason === 'string' && r2.reason.length > 0);

// 4. Publish success → metadata updated + event appended
console.log('\n\u25b6 4. Publish success → metadata + event');
setEnv();
mockFetchSuccess();
var readyId = makeReadyArticle('test keyword success');
var r3 = await publishArticle(readyId);
check('ok true',              r3.ok === true);
check('skipped false',        r3.skipped === false);
check('wordpressPostId 77',   r3.wordpressPostId === 77);
check('url set',              typeof r3.url === 'string' && r3.url.length > 0);

// verify metadata updated
var afterPublish = getArticleById(readyId);
check('publishedUrl updated', afterPublish.meta.publishedUrl && afterPublish.meta.publishedUrl.length > 0);
check('publishedAt set',      typeof afterPublish.meta.publishedAt === 'string');

// verify event appended
var events = afterPublish.meta.events || [];
var pubEvent = events.filter(function(e) { return e.type === 'published_to_wordpress'; });
check('event appended',            pubEvent.length >= 1);
check('event has wordpressPostId', pubEvent[0] && pubEvent[0].wordpressPostId === 77);

// 5. Already published → skip (second call)
console.log('\n\u25b6 5. Already published → skip on second call');
setEnv();
mockFetchSuccess();
var r4 = await publishArticle(readyId);
check('second call skipped', r4.skipped === true);
check('reason mentions already', r4.reason && r4.reason.includes('already'));

// 6. WordPress fail → safe error
console.log('\n\u25b6 6. WordPress fail → safe error');
setEnv();
mockFetchFail();
var failId = makeReadyArticle('test keyword fail');
var r5 = await publishArticle(failId);
check('ok false on WP error',   r5.ok === false);
check('skipped false',          r5.skipped === false);
check('error present',          typeof r5.error === 'string');

// 7. No env → safe error (not crash)
console.log('\n\u25b6 7. No env → safe error');
clearEnv();
var noEnvId = makeReadyArticle('test keyword no env');
var r6 = await publishArticle(noEnvId);
check('ok false without env',  r6.ok === false);
check('skipped false',         r6.skipped === false);

setEnv();

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
