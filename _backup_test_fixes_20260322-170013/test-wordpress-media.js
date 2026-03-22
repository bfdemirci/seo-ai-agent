
import { uploadImageToWordpress } from '../../src/integrations/wordpress/wordpressMedia.js';

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

function mockFetch(body, status) {
  status = status || 201;
  global.fetch = async function() {
    return { ok: status >= 200 && status < 300, status: status, json: async function() { return body; } };
  };
}
function mockFetchNetworkError() {
  global.fetch = async function() { throw new Error('ECONNREFUSED'); };
}

var VALID = { filename: 'cover.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake') };

console.log('\n' + '\u2500'.repeat(60));
console.log('  WordPress Media Upload Test');
console.log('\u2500'.repeat(60));

// 1. Export
console.log('\n\u25b6 1. Export');
check('uploadImageToWordpress is function', typeof uploadImageToWordpress === 'function');
check('is async', uploadImageToWordpress.constructor.name === 'AsyncFunction');

// 2. Validation — missing env
console.log('\n\u25b6 2. Validation — missing env');
clearEnv();
mockFetch({});
var r1 = await uploadImageToWordpress(VALID);
check('ok false without env',          r1.ok === false);
check('error mentions BASE_URL',       r1.error && r1.error.includes('WORDPRESS_BASE_URL'));
check('mediaId null',                  r1.mediaId === null);

// 3. Validation — missing fields
console.log('\n\u25b6 3. Validation — missing fields');
setEnv();
mockFetch({});
var r2a = await uploadImageToWordpress({ mimeType: 'image/jpeg', buffer: Buffer.from('x') });
check('missing filename → error', r2a.ok === false && r2a.error.includes('filename'));

var r2b = await uploadImageToWordpress({ filename: 'x.jpg', buffer: Buffer.from('x') });
check('missing mimeType → error', r2b.ok === false && r2b.error.includes('mimeType'));

var r2c = await uploadImageToWordpress({ filename: 'x.jpg', mimeType: 'image/jpeg' });
check('missing buffer → error',   r2c.ok === false && r2c.error.includes('buffer'));

// 4. Success
console.log('\n\u25b6 4. Successful upload');
setEnv();
mockFetch({ id: 99, source_url: 'https://example.com/wp-content/cover.jpg' }, 201);
var r3 = await uploadImageToWordpress(VALID);
check('ok true',          r3.ok === true);
check('status 201',       r3.status === 201);
check('mediaId 99',       r3.mediaId === 99);
check('url present',      r3.url === 'https://example.com/wp-content/cover.jpg');
check('error null',       r3.error === null);

// 5. Non-200 response
console.log('\n\u25b6 5. Non-200 response');
setEnv();
mockFetch({ code: 'rest_upload_error', message: 'Upload not allowed' }, 403);
var r4 = await uploadImageToWordpress(VALID);
check('ok false on 403',      r4.ok === false);
check('status 403',           r4.status === 403);
check('error mentions 403',   r4.error && r4.error.includes('403'));
check('mediaId null',         r4.mediaId === null);

// 6. Network error
console.log('\n\u25b6 6. Network error');
setEnv();
mockFetchNetworkError();
var r5 = await uploadImageToWordpress(VALID);
check('ok false',              r5.ok === false);
check('error mentions Network', r5.error && r5.error.includes('Network error'));
check('status null',           r5.status === null);

// 7. Return shape
console.log('\n\u25b6 7. Return shape contract');
setEnv();
mockFetch({ id: 1, source_url: 'https://example.com/x.jpg' }, 201);
var r6 = await uploadImageToWordpress(VALID);
check('has ok',      typeof r6.ok === 'boolean');
check('has status',  r6.status !== undefined);
check('has mediaId', r6.mediaId !== undefined);
check('has url',     r6.url !== undefined);
check('has raw',     r6.raw !== undefined);
check('has error',   r6.error !== undefined);

clearEnv();

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
