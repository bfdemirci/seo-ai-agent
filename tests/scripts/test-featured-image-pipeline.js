
import 'dotenv/config';
import { generateFeaturedImage } from '../../src/services/media/imageGenerationService.js';
import { generateAndUploadFeaturedImage } from '../../src/services/media/featuredImagePipeline.js';
import { createArticleRecord, getArticleById } from '../../src/repositories/articleRepository.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Featured Image Pipeline Test');
console.log('\u2500'.repeat(60));

// 1. imageGenerationService exports
console.log('\n\u25b6 1. imageGenerationService');
check('export is function',       typeof generateFeaturedImage === 'function');
check('is async',                 generateFeaturedImage.constructor.name === 'AsyncFunction');

// 2. generate with valid input
console.log('\n\u25b6 2. generate — valid input');
var g1 = await generateFeaturedImage({ keyword: 'seo tools', title: 'Best SEO Tools' });
check('ok true',                  g1.ok === true);
check('has filename',             typeof g1.filename === 'string' && g1.filename.length > 0);
check('filename ends .jpg',       g1.filename.endsWith('.jpg'));
check('mimeType is jpeg',         g1.mimeType === 'image/jpeg');
check('buffer is Buffer',         Buffer.isBuffer(g1.buffer));
check('buffer not empty',         g1.buffer && g1.buffer.length > 0);
check('error null',               g1.error === null);
check('has altText',              typeof g1.altText === 'string');

// 3. generate with empty input
console.log('\n\u25b6 3. generate — empty input');
var g2 = await generateFeaturedImage({});
check('ok false on empty',        g2.ok === false);
check('error present',            typeof g2.error === 'string');
check('buffer null',              g2.buffer === null);

// 4. generate — does not throw
console.log('\n\u25b6 4. generate — no crash on bad input');
var g3 = null, threw = false;
try { g3 = await generateFeaturedImage(null); } catch(e) { threw = true; }
check('no throw on null',         !threw);
check('returns object or null',   g3 === null || typeof g3 === 'object');

// 5. pipeline — generate success + upload mock success
console.log('\n\u25b6 5. pipeline — full success (mock upload)');
var artId = createArticleRecord({ keyword: 'featured image test', article: '<p>x</p>', outline: '', research: {}, evaluation: {}, finalization: { title: 'Featured Image Test' } });
var article = getArticleById(artId);
process.env.WORDPRESS_BASE_URL     = 'https://example.com';
process.env.WORDPRESS_USERNAME     = 'admin';
process.env.WORDPRESS_APP_PASSWORD = 'fake pass';
global.fetch = async function(url) {
  if (url.includes('/media')) {
    return { ok: true, status: 201, json: async function() { return { id: 55, source_url: 'https://example.com/img.jpg' }; } };
  }
  return { ok: true, status: 201, json: async function() { return { id: 99, link: 'https://example.com/post' }; } };
};
var p1 = await generateAndUploadFeaturedImage(article);
check('ok true',                  p1.ok === true);
check('attempted true',           p1.attempted === true);
check('mediaId 55',               p1.mediaId === 55);
check('url set',                  typeof p1.url === 'string');
check('error null',               p1.error === null);

// 6. pipeline — upload fail → graceful
console.log('\n\u25b6 6. pipeline — upload fail');
global.fetch = async function() {
  return { ok: false, status: 403, json: async function() { return {}; } };
};
var p2 = await generateAndUploadFeaturedImage(article);
check('ok false on upload fail',  p2.ok === false);
check('attempted true',           p2.attempted === true);
check('mediaId null',             p2.mediaId === null);
check('error present',            typeof p2.error === 'string');

// 7. pipeline — missing env → graceful
console.log('\n\u25b6 7. pipeline — no WP env');
delete process.env.WORDPRESS_BASE_URL;
var p3 = await generateAndUploadFeaturedImage(article);
check('ok false without env',     p3.ok === false);
check('attempted true',           p3.attempted === true);
check('no throw',                 true);
process.env.WORDPRESS_BASE_URL = 'https://example.com';

// 8. pipeline — null article → safe
console.log('\n\u25b6 8. pipeline — null article');
var p4 = null, threw2 = false;
try { p4 = await generateAndUploadFeaturedImage(null); } catch(e) { threw2 = true; }
check('no throw on null article', !threw2);
check('returns object',           p4 !== null && typeof p4 === 'object');
check('attempted true',           (p4 || {}).attempted === true);

// 9. return shape contract
console.log('\n\u25b6 9. Return shape contract');
global.fetch = async function(url) {
  if (url.includes('/media')) {
    return { ok: true, status: 201, json: async function() { return { id: 77, source_url: 'https://example.com/x.jpg' }; } };
  }
  return { ok: true, status: 201, json: async function() { return { id: 1, link: 'https://example.com/p' }; } };
};
process.env.WORDPRESS_BASE_URL = 'https://example.com';
var p5 = await generateAndUploadFeaturedImage(article);
check('has ok boolean',           typeof p5.ok === 'boolean');
check('has attempted boolean',    typeof p5.attempted === 'boolean');
check('has mediaId',              p5.mediaId !== undefined);
check('has url',                  p5.url !== undefined);
check('has error',                p5.error !== undefined);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
