
import 'dotenv/config';
import { trashWordpressPost } from '../../src/services/publisher/wordpressCleanupService.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

process.env.WORDPRESS_BASE_URL     = 'https://example.com';
process.env.WORDPRESS_USERNAME     = 'admin';
process.env.WORDPRESS_APP_PASSWORD = 'fake pass';

console.log('\n' + '\u2500'.repeat(60));
console.log('  WordPress Cleanup (Trash) Test');
console.log('\u2500'.repeat(60));

// 1. export
console.log('\n\u25b6 1. Export');
check('is function',  typeof trashWordpressPost === 'function');
check('is async',     trashWordpressPost.constructor.name === 'AsyncFunction');

// 2. missing postId
console.log('\n\u25b6 2. Missing postId');
var r1 = await trashWordpressPost(null);
check('ok false',     r1.ok === false);
check('error present',typeof r1.error === 'string');
check('trashed false',r1.trashed === false);

// 3. trash success
console.log('\n\u25b6 3. Trash success');
global.fetch = async function() {
  return { ok: true, status: 200, json: async function() { return { id: 42, status: 'trash' }; } };
};
var r2 = await trashWordpressPost(42);
check('ok true',      r2.ok === true);
check('trashed true', r2.trashed === true);
check('postId 42',    r2.postId === 42);
check('error null',   r2.error === null);

// 4. trash fail (403)
console.log('\n\u25b6 4. Trash fail');
global.fetch = async function() { return { ok: false, status: 403, json: async function() { return {}; } }; };
var r3 = await trashWordpressPost(99);
check('ok false',     r3.ok === false);
check('trashed false',r3.trashed === false);
check('status 403',   r3.status === 403);
check('error present',r3.error && r3.error.includes('403'));

// 5. network error
console.log('\n\u25b6 5. Network error');
global.fetch = async function() { throw new Error('Network fail'); };
var r4 = await trashWordpressPost(1);
check('ok false',     r4.ok === false);
check('error set',    r4.error && r4.error.includes('Network fail'));
check('no throw',     true);

// 6. return shape
console.log('\n\u25b6 6. Return shape');
global.fetch = async function() { return { ok: true, status: 200, json: async function() { return { id: 5, status: 'trash' }; } }; };
var r5 = await trashWordpressPost(5);
check('has ok',      typeof r5.ok === 'boolean');
check('has trashed', typeof r5.trashed === 'boolean');
check('has postId',  r5.postId !== undefined);
check('has status',  r5.status !== undefined);
check('has error',   r5.error !== undefined);
check('has raw',     r5.raw !== undefined);

// 7. missing env
console.log('\n\u25b6 7. Missing env');
var bak = process.env.WORDPRESS_BASE_URL;
delete process.env.WORDPRESS_BASE_URL;
var r6 = await trashWordpressPost(1);
check('ok false without env', r6.ok === false);
check('error present',        typeof r6.error === 'string');
process.env.WORDPRESS_BASE_URL = bak;

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
