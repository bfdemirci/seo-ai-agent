
import 'dotenv/config';
import { verifyPublishedPost } from '../../src/services/publisher/wordpressPublishVerifyService.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

process.env.WORDPRESS_BASE_URL     = 'https://example.com';
process.env.WORDPRESS_USERNAME     = 'admin';
process.env.WORDPRESS_APP_PASSWORD = 'fake pass';

console.log('\n' + '\u2500'.repeat(60));
console.log('  WordPress Publish Verify Test');
console.log('\u2500'.repeat(60));

// 1. export
console.log('\n\u25b6 1. Export');
check('is function',  typeof verifyPublishedPost === 'function');
check('is async',     verifyPublishedPost.constructor.name === 'AsyncFunction');

// 2. missing postId
console.log('\n\u25b6 2. Missing postId');
var r1 = await verifyPublishedPost({});
check('ok false',     r1.ok === false);
check('error present',typeof r1.error === 'string');

// 3. post not found (404)
console.log('\n\u25b6 3. Post not found');
global.fetch = async function() { return { ok: false, status: 404, json: async function() { return { code: 'rest_post_invalid_id' }; } }; };
var r2 = await verifyPublishedPost({ postId: 999 });
check('ok false',     r2.ok === false);
check('error present',r2.error && r2.error.includes('404'));
check('verified false',r2.verified === false);

// 4. slug mismatch
console.log('\n\u25b6 4. Slug mismatch');
global.fetch = async function() {
  return { ok: true, status: 200, json: async function() { return { id: 42, slug: 'actual-slug', status: 'draft' }; } };
};
var r3 = await verifyPublishedPost({ postId: 42, expectedSlug: 'expected-slug', expectedStatus: 'draft' });
check('ok true',         r3.ok === true);
check('verified false',  r3.verified === false);
check('slugMatches false',r3.slugMatches === false);
check('statusMatches true',r3.statusMatches === true);

// 5. status mismatch
console.log('\n\u25b6 5. Status mismatch');
global.fetch = async function() {
  return { ok: true, status: 200, json: async function() { return { id: 43, slug: 'my-slug', status: 'publish' }; } };
};
var r4 = await verifyPublishedPost({ postId: 43, expectedSlug: 'my-slug', expectedStatus: 'draft' });
check('ok true',           r4.ok === true);
check('verified false',    r4.verified === false);
check('slugMatches true',  r4.slugMatches === true);
check('statusMatches false',r4.statusMatches === false);

// 6. full success
console.log('\n\u25b6 6. Full success');
global.fetch = async function() {
  return { ok: true, status: 200, json: async function() { return { id: 99, slug: 'seo-nedir', status: 'draft' }; } };
};
var r5 = await verifyPublishedPost({ postId: 99, expectedSlug: 'seo-nedir', expectedStatus: 'draft' });
check('ok true',           r5.ok === true);
check('verified true',     r5.verified === true);
check('slugMatches true',  r5.slugMatches === true);
check('statusMatches true',r5.statusMatches === true);
check('postId 99',         r5.postId === 99);

// 7. network error
console.log('\n\u25b6 7. Network error');
global.fetch = async function() { throw new Error('Network fail'); };
var r6 = await verifyPublishedPost({ postId: 1 });
check('ok false',    r6.ok === false);
check('error set',   r6.error && r6.error.includes('Network fail'));
check('no throw',    true);

// 8. return shape
console.log('\n\u25b6 8. Return shape');
global.fetch = async function() {
  return { ok: true, status: 200, json: async function() { return { id: 1, slug: 'x', status: 'draft' }; } };
};
var r7 = await verifyPublishedPost({ postId: 1 });
check('has ok',           typeof r7.ok === 'boolean');
check('has verified',     typeof r7.verified === 'boolean');
check('has postId',       r7.postId !== undefined);
check('has slugMatches',  typeof r7.slugMatches === 'boolean');
check('has statusMatches',typeof r7.statusMatches === 'boolean');
check('has actualStatus', r7.actualStatus !== undefined);
check('has actualSlug',   r7.actualSlug !== undefined);
check('has error',        r7.error !== undefined);
check('has raw',          r7.raw !== undefined);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
