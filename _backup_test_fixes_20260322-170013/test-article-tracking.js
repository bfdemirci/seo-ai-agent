
import { createArticleRecord, getArticleById } from '../../src/repositories/articleRepository.js';
import { updateArticleTracking } from '../../src/services/tracking/articleTrackingService.js';
import { resolveIndexStatus } from '../../src/services/analytics/gscAnalyticsService.js';
import { saveGscSnapshots } from '../../src/repositories/gscSnapshotRepository.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Article Tracking Service Test');
console.log('\u2500'.repeat(60));

// ── 1. resolveIndexStatus ─────────────────────────────────────────────────────
console.log('\n\u25b6 1. resolveIndexStatus');
check('null → not_indexed',    resolveIndexStatus(null) === 'not_indexed');
check('[] → not_indexed',      resolveIndexStatus([]) === 'not_indexed');
check('[row] → indexed',       resolveIndexStatus([{ date: '2026-01-01', clicks: 10 }]) === 'indexed');
check('multi rows → indexed',  resolveIndexStatus([{}, {}, {}]) === 'indexed');

// ── 2. Unknown article → safe return ─────────────────────────────────────────
console.log('\n\u25b6 2. Unknown articleId → safe');
var r1 = await updateArticleTracking('art_nonexistent_xxx');
check('ok false',          r1.ok === false);
check('error present',     typeof r1.error === 'string');
check('indexStatus set',   r1.indexStatus === 'unknown');
check('snapshotCount 0',   r1.snapshotCount === 0);

// ── 3. Article with no snapshots → not_indexed ────────────────────────────────
console.log('\n\u25b6 3. Article with no GSC snapshots → not_indexed');
var id1 = createArticleRecord({
  keyword: 'tracking-test-no-snap', article: '<p>x</p>',
  outline: '', research: {}, evaluation: {}, finalization: {},
});
var r2 = await updateArticleTracking(id1);
check('ok true',               r2.ok === true);
check('indexStatus not_indexed', r2.indexStatus === 'not_indexed');
check('snapshotCount 0',       r2.snapshotCount === 0);

// ── 4. Metadata updated ───────────────────────────────────────────────────────
console.log('\n\u25b6 4. Metadata fields updated');
var after1 = getArticleById(id1);
check('lastCheckedAt set',  typeof after1.meta.lastCheckedAt === 'string');
check('lastGscSyncAt set',  typeof after1.meta.lastGscSyncAt === 'string');
check('indexStatus stored', after1.meta.indexStatus === 'not_indexed');

// ── 5. Article with snapshots → indexed ──────────────────────────────────────
console.log('\n\u25b6 5. Article with GSC snapshots → indexed');
var id2 = createArticleRecord({
  keyword: 'tracking-test-with-snap', article: '<p>y</p>',
  outline: '', research: {}, evaluation: {}, finalization: {},
});

// inject snapshots
saveGscSnapshots(id2, [
  { date: '2026-03-01', page: '/tracking-test', query: 'test', clicks: 5, impressions: 100, ctr: 0.05, position: 8, source: 'gsc' },
  { date: '2026-03-02', page: '/tracking-test', query: 'test', clicks: 7, impressions: 120, ctr: 0.058, position: 7, source: 'gsc' },
]);

var r3 = await updateArticleTracking(id2);
check('ok true',               r3.ok === true);
check('indexStatus indexed',   r3.indexStatus === 'indexed');
check('snapshotCount 2',       r3.snapshotCount === 2);

var after2 = getArticleById(id2);
check('indexStatus stored indexed', after2.meta.indexStatus === 'indexed');
check('lastCheckedAt set',          typeof after2.meta.lastCheckedAt === 'string');

// ── 6. Return shape contract ─────────────────────────────────────────────────
console.log('\n\u25b6 6. Return shape contract');
var r4 = await updateArticleTracking(id1);
check('has ok boolean',       typeof r4.ok === 'boolean');
check('has indexStatus',      typeof r4.indexStatus === 'string');
check('has snapshotCount',    typeof r4.snapshotCount === 'number');

// ── 7. Idempotent — run twice is safe ────────────────────────────────────────
console.log('\n\u25b6 7. Idempotent — run twice safe');
var r5a = await updateArticleTracking(id2);
var r5b = await updateArticleTracking(id2);
check('first ok',   r5a.ok === true);
check('second ok',  r5b.ok === true);
check('same index status', r5a.indexStatus === r5b.indexStatus);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
