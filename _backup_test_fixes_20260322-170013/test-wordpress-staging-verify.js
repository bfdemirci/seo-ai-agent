
import 'dotenv/config';
import { verifyWordpressConnection } from '../../src/services/publisher/wordpressStagingVerifyService.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  WordPress Staging Verify Test');
console.log('\u2500'.repeat(60));

// 1. export
console.log('\n\u25b6 1. Export');
check('is function',  typeof verifyWordpressConnection === 'function');
check('is async',     verifyWordpressConnection.constructor.name === 'AsyncFunction');

// 2. missing env → safe fail
console.log('\n\u25b6 2. Missing env');
var saved = { a: process.env.WORDPRESS_BASE_URL, b: process.env.WORDPRESS_USERNAME, c: process.env.WORDPRESS_APP_PASSWORD };
delete process.env.WORDPRESS_BASE_URL; delete process.env.WORDPRESS_USERNAME; delete process.env.WORDPRESS_APP_PASSWORD;
var r1 = await verifyWordpressConnection();
check('ok false',      r1.ok === false);
check('error present', typeof r1.error === 'string' && r1.error.length > 0);
check('no throw',      true);
process.env.WORDPRESS_BASE_URL     = saved.a || 'https://example.com';
process.env.WORDPRESS_USERNAME     = saved.b || 'admin';
process.env.WORDPRESS_APP_PASSWORD = saved.c || 'fake';

// 3. auth fail (mock 401)
console.log('\n\u25b6 3. Auth fail');
global.fetch = async function() { return { ok: false, status: 401, json: async function() { return { code: 'rest_forbidden' }; } }; };
var r2 = await verifyWordpressConnection();
check('ok false on 401',   r2.ok === false);
check('status 401',        r2.status === 401);
check('error mentions auth', r2.error && r2.error.includes('401'));
check('no throw',          true);

// 4. success
console.log('\n\u25b6 4. Success');
global.fetch = async function() {
  return { ok: true, status: 200, json: async function() {
    return { id: 1, name: 'Admin User', capabilities: { administrator: true, upload_files: true, edit_posts: true } };
  }};
};
var r3 = await verifyWordpressConnection();
check('ok true',           r3.ok === true);
check('user set',          r3.user === 'Admin User');
check('canCreatePosts',    r3.canCreatePosts === true);
check('canUploadMedia',    r3.canUploadMedia === true);
check('error null',        r3.error === null);

// 5. network error → safe fail
console.log('\n\u25b6 5. Network error');
global.fetch = async function() { throw new Error('Network timeout'); };
var r4 = await verifyWordpressConnection();
check('ok false',          r4.ok === false);
check('error message',     r4.error && r4.error.includes('Network timeout'));
check('no throw',          true);

// 6. return shape contract
console.log('\n\u25b6 6. Return shape');
global.fetch = async function() {
  return { ok: true, status: 200, json: async function() { return { id: 1, name: 'User', capabilities: {} }; } };
};
var r5 = await verifyWordpressConnection();
check('has ok',             typeof r5.ok === 'boolean');
check('has siteName',       r5.siteName !== undefined);
check('has user',           r5.user !== undefined);
check('has canCreatePosts', typeof r5.canCreatePosts === 'boolean');
check('has canUploadMedia', typeof r5.canUploadMedia === 'boolean');
check('has status',         r5.status !== undefined);
check('has error',          r5.error !== undefined);
check('has raw',            r5.raw !== undefined);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
