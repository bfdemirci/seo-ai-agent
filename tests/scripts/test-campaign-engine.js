import 'dotenv/config';
import { runCampaign } from '../../src/services/programmatic/campaignEngine.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '─'.repeat(60));
console.log('  Campaign Engine Test');
console.log('─'.repeat(60));

var mockWriterFn = async function(keyword) {
  return { ok: true, keyword, article: { title: 'Test: ' + keyword, content: 'content' }, outline: null, research: null, evaluation: null, finalization: null };
};
var mockOptimizeFn  = async function() { return { ok: true }; };
var mockPublishFn   = async function() { return { ok: true, publishedUrl: 'https://example.com/' + Date.now() }; };

console.log('\n▶ 1. basic campaign run (safeMode, mock injected)');
var r1 = await runCampaign(
  { siteId: 'test-site', baseKeyword: 'altın', locations: ['istanbul', 'ankara'], modifiers: ['fiyat', 'fiyatları'], limit: 4, safeMode: true, throttleMs: 0 },
  { writerFn: mockWriterFn, optimizeFn: mockOptimizeFn, publishFn: mockPublishFn }
);
check('ok true', r1.ok === true);
check('totalGenerated > 0', r1.totalGenerated > 0);
check('totalGenerated <= 4', r1.totalGenerated <= 4);
check('items array', Array.isArray(r1.items));
check('items.length === totalGenerated', r1.items.length === r1.totalGenerated);
check('created + failed === totalGenerated', r1.created + r1.failed === r1.totalGenerated);
check('safeMode → 0 published', r1.published === 0);

console.log('\n▶ 2. limit respected');
var r2 = await runCampaign(
  { siteId: 'test-site', baseKeyword: 'elmas', locations: ['izmir','bursa','antalya','trabzon','kayseri'], modifiers: ['fiyat','karat','yüzük','kolye','bilezik'], limit: 3, safeMode: true, throttleMs: 0 },
  { writerFn: mockWriterFn, optimizeFn: mockOptimizeFn, publishFn: mockPublishFn }
);
check('limit 3 respected', r2.totalGenerated <= 3);

console.log('\n▶ 3. item shape');
var item = r1.items[0];
check('item has keyword', typeof item.keyword === 'string');
check('item has siteId', item.siteId === 'test-site');
check('item has ok', typeof item.ok === 'boolean');

console.log('\n▶ 4. multi-site separation (different siteIds)');
var r3 = await runCampaign(
  { siteId: 'site-A', baseKeyword: 'bilezik', locations: [''], modifiers: [''], limit: 2, safeMode: true, throttleMs: 0 },
  { writerFn: mockWriterFn, optimizeFn: mockOptimizeFn, publishFn: mockPublishFn }
);
var r4 = await runCampaign(
  { siteId: 'site-B', baseKeyword: 'kolye', locations: [''], modifiers: [''], limit: 2, safeMode: true, throttleMs: 0 },
  { writerFn: mockWriterFn, optimizeFn: mockOptimizeFn, publishFn: mockPublishFn }
);
check('site-A items all have siteId site-A', r3.items.every(function(i){ return i.siteId === 'site-A'; }));
check('site-B items all have siteId site-B', r4.items.every(function(i){ return i.siteId === 'site-B'; }));

console.log('\n▶ 5. single keyword failure does not crash loop');
var failWriterFn = async function(keyword) {
  if (keyword.includes('fail')) throw new Error('intentional fail');
  return { ok: true, keyword, article: { title: keyword, content: 'x' }, outline: null, research: null, evaluation: null, finalization: null };
};
var r5 = await runCampaign(
  { siteId: 'test-site', baseKeyword: 'fail', locations: ['test'], modifiers: ['one','two'], limit: 3, safeMode: true, throttleMs: 0 },
  { writerFn: failWriterFn, optimizeFn: mockOptimizeFn, publishFn: mockPublishFn }
);
check('campaign completes despite failures', r5.ok === true);
check('failed count > 0', r5.failed > 0);
check('items still populated', r5.items.length > 0);

console.log('\n' + '─'.repeat(60));
console.log('  SUMMARY');
console.log('─'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
