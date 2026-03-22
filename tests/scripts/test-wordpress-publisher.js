
import { publishToWordpress } from '../../src/integrations/wordpress/wordpressPublisher.js';

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

// Mock: farklı URL'lere göre farklı response
function mockFetchDual(mediaBody, mediaStatus, postBody, postStatus) {
  global.fetch = async function(url, opts) {
    var isMedia = url.includes('/media');
    var body    = isMedia ? mediaBody  : postBody;
    var status  = isMedia ? mediaStatus : postStatus;
    return { ok: status >= 200 && status < 300, status: status, json: async function() { return body; } };
  };
}
function mockFetchPost(body, status) {
  status = status || 201;
  global.fetch = async function() {
    return { ok: status >= 200 && status < 300, status: status, json: async function() { return body; } };
  };
}
function mockFetchNetworkError() {
  global.fetch = async function() { throw new Error('ECONNREFUSED'); };
}

var VALID = { title: 'Test Article', content: '<p>Content.</p>', slug: 'test-article' };
var FAKE_IMAGE = { filename: 'cover.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake'), altText: 'Cover' };
var WP_POST = { id: 42, link: 'https://example.com/test-article', status: 'draft' };

console.log('\n' + '\u2500'.repeat(60));
console.log('  WordPress Publisher Test');
console.log('\u2500'.repeat(60));

// 1. Export
console.log('\n\u25b6 1. Export');
check('publishToWordpress is function', typeof publishToWordpress === 'function');
check('is async', publishToWordpress.constructor.name === 'AsyncFunction');

// 2. Validation — missing env
console.log('\n\u25b6 2. Validation — missing env');
clearEnv();
mockFetchPost({});
var r1 = await publishToWordpress(VALID);
check('ok false without env',      r1.ok === false);
check('error mentions BASE_URL',   r1.error && r1.error.includes('WORDPRESS_BASE_URL'));

// 3. Validation — missing fields
console.log('\n\u25b6 3. Validation — missing payload fields');
setEnv();
mockFetchPost({});
var r2a = await publishToWordpress({ content: 'x', slug: 'x' });
check('missing title → error',   r2a.ok === false && r2a.error.includes('title'));
var r2b = await publishToWordpress({ title: 'T', slug: 'x' });
check('missing content → error', r2b.ok === false && r2b.error.includes('content'));
var r2c = await publishToWordpress({ title: 'T', content: 'C' });
check('missing slug → error',    r2c.ok === false && r2c.error.includes('slug'));

// 4. Default status is draft
console.log('\n\u25b6 4. Default status is draft');
setEnv();
var capturedBody = null;
global.fetch = async function(_url, opts) {
  if (opts.body) capturedBody = JSON.parse(opts.body);
  return { ok: true, status: 201, json: async function() { return WP_POST; } };
};
await publishToWordpress(VALID);
check('status defaults to draft', capturedBody && capturedBody.status === 'draft');

// 5. No image → post OK
console.log('\n\u25b6 5. No image → post OK');
setEnv();
mockFetchPost(WP_POST, 201);
var r3 = await publishToWordpress(VALID);
check('ok true',         r3.ok === true);
check('postId 42',       r3.postId === 42);
check('url set',         r3.url === 'https://example.com/test-article');
check('error null',      r3.error === null);
check('image null',      r3.image === null);

// 6. Image success → featured_media set
console.log('\n\u25b6 6. Image success → featured_media attached');
setEnv();
var mediaRes = { id: 99, source_url: 'https://example.com/cover.jpg' };
var postRes  = { id: 43, link: 'https://example.com/test-article-2', status: 'draft' };
capturedBody = null;
global.fetch = async function(url, opts) {
  var isMedia = url.includes('/media');
  if (!isMedia && opts.body) capturedBody = JSON.parse(opts.body);
  var body   = isMedia ? mediaRes : postRes;
  var status = 201;
  return { ok: true, status: status, json: async function() { return body; } };
};
var r4 = await publishToWordpress(Object.assign({}, VALID, { featuredImage: FAKE_IMAGE }));
check('post ok',                          r4.ok === true);
check('postId 43',                        r4.postId === 43);
check('image attempted true',             r4.image && r4.image.attempted === true);
check('image success true',               r4.image && r4.image.success === true);
check('featured_media in post body',      capturedBody && capturedBody.featured_media === 99);

// 7. Image fail → post still OK
console.log('\n\u25b6 7. Image fail → post still created');
setEnv();
mockFetchDual({ code: 'upload_error', message: 'fail' }, 500, postRes, 201);
var r5 = await publishToWordpress(Object.assign({}, VALID, { featuredImage: FAKE_IMAGE }));
check('post ok despite image fail',   r5.ok === true);
check('postId set',                   r5.postId === 43);
check('image attempted true',         r5.image && r5.image.attempted === true);
check('image success false',          r5.image && r5.image.success === false);

// 8. Post fail → error
console.log('\n\u25b6 8. Post creation fail → safe error');
setEnv();
mockFetchPost({ code: 'rest_cannot_create', message: 'Not allowed' }, 401);
var r6 = await publishToWordpress(VALID);
check('ok false on 401',       r6.ok === false);
check('status 401',            r6.status === 401);
check('error mentions 401',    r6.error && r6.error.includes('401'));
check('postId null',           r6.postId === null);

// 9. Network error → safe
console.log('\n\u25b6 9. Network error → safe');
setEnv();
mockFetchNetworkError();
var r7 = await publishToWordpress(VALID);
check('ok false',              r7.ok === false);
check('error Network error',   r7.error && r7.error.includes('Network error'));
check('status null',           r7.status === null);

// 10. Return shape contract
console.log('\n\u25b6 10. Return shape contract');
setEnv();
mockFetchPost(WP_POST, 201);
var r8 = await publishToWordpress(VALID);
check('has ok',      typeof r8.ok === 'boolean');
check('has status',  r8.status !== undefined);
check('has postId',  r8.postId !== undefined);
check('has url',     r8.url !== undefined);
check('has raw',     r8.raw !== undefined);
check('has error',   r8.error !== undefined);
check('has image',   r8.image !== undefined);

clearEnv();

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
