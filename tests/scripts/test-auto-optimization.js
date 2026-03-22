
import { createArticleRecord, getArticleById, updateArticleMetadata } from '../../src/repositories/articleRepository.js';
import { saveGscSnapshots } from '../../src/repositories/gscSnapshotRepository.js';
import { runAutoOptimizationForArticle } from '../../src/services/maintenance/autoOptimizationService.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Auto Optimization Service Test');
console.log('\u2500'.repeat(60));

// helpers
function makeArticle(keyword, statusOverride) {
  var id = createArticleRecord({
    keyword: keyword, article: '<p>' + keyword + '</p>',
    outline: '', research: {}, evaluation: { scoreV1: { overallScore: 70 } }, finalization: {},
  });
  if (statusOverride) updateArticleMetadata(id, statusOverride);
  return id;
}

function makeDecayRows(baseline, recent) {
  var rows = [];
  var d = new Date('2026-01-01');
  for (var i = 0; i < 14; i++) {
    rows.push({ date: d.toISOString().slice(0,10), page: '/x', query: 'q', clicks: baseline.clicks, impressions: baseline.impressions, ctr: baseline.ctr, position: baseline.position, source: 'gsc' });
    d.setDate(d.getDate() + 1);
  }
  for (var j = 0; j < 14; j++) {
    rows.push({ date: d.toISOString().slice(0,10), page: '/x', query: 'q', clicks: recent.clicks, impressions: recent.impressions, ctr: recent.ctr, position: recent.position, source: 'gsc' });
    d.setDate(d.getDate() + 1);
  }
  return rows;
}

// 1. Export
console.log('\n\u25b6 1. Export');
check('runAutoOptimizationForArticle is function', typeof runAutoOptimizationForArticle === 'function');
check('is async', runAutoOptimizationForArticle.constructor.name === 'AsyncFunction');

// 2. Unknown article → safe error
console.log('\n\u25b6 2. Unknown article → safe error object');
var r1 = await runAutoOptimizationForArticle('art_nonexistent_xxx');
check('does not throw',    r1 !== null && typeof r1 === 'object');
check('error present',     typeof r1.error === 'string');
check('decay null',        r1.decay === null);
check('decision null',     r1.decision === null);
check('execution null',    r1.execution === null);

// 3. Healthy article → ignore, no write
console.log('\n\u25b6 3. Healthy article → ignore / no write');
var healthyId = makeArticle('healthy keyword auto-opt');
saveGscSnapshots(healthyId, makeDecayRows(
  { clicks: 100, impressions: 1000, ctr: 0.1, position: 5 },
  { clicks: 100, impressions: 1000, ctr: 0.1, position: 5 }
));
var r2 = await runAutoOptimizationForArticle(healthyId, { safeMode: true });
check('no error',             r2.error === null);
check('has decay',            r2.decay !== null);
check('has decision',         r2.decision !== null);
check('has execution',        r2.execution !== null);
check('decay healthy or watch', r2.decay.status === 'healthy' || r2.decay.status === 'watch');
check('execution noop or ignore', r2.execution.executionMode === 'noop' || r2.execution.executed === false);

// 4. Watch article — decision but minimal execution
console.log('\n\u25b6 4. Watch article → decision present');
var watchId = makeArticle('watch keyword auto-opt');
saveGscSnapshots(watchId, makeDecayRows(
  { clicks: 100, impressions: 1000, ctr: 0.1, position: 5 },
  { clicks:  80, impressions:  900, ctr: 0.09, position: 7 }
));
var r3 = await runAutoOptimizationForArticle(watchId, { safeMode: true });
check('no error',         r3.error === null);
check('decision present', r3.decision !== null);
check('action string',    typeof r3.decision.action === 'string');
check('priority string',  typeof r3.decision.priority === 'string');

// 5. Decaying article → decision produced
console.log('\n\u25b6 5. Decaying article → decision + execution');
var decayId = makeArticle('decaying keyword auto-opt');
saveGscSnapshots(decayId, makeDecayRows(
  { clicks: 200, impressions: 4000, ctr: 0.05, position: 5 },
  { clicks:  80, impressions: 2000, ctr: 0.02, position: 11 }
));
var r4 = await runAutoOptimizationForArticle(decayId, { safeMode: true });
check('no error',           r4.error === null);
check('decay status set',   typeof r4.decay.status === 'string');
check('decision action',    typeof r4.decision.action === 'string');
check('execution present',  r4.execution !== null);

// 6. safeMode=true → no writes
console.log('\n\u25b6 6. safeMode=true → no content writes');
var safeId = makeArticle('safemode keyword auto-opt');
saveGscSnapshots(safeId, makeDecayRows(
  { clicks: 200, impressions: 4000, ctr: 0.05, position: 5 },
  { clicks:  60, impressions: 1500, ctr: 0.015, position: 14 }
));
var countBefore = getArticleById(safeId).versionCount;
var r5 = await runAutoOptimizationForArticle(safeId, { safeMode: true });
var countAfter = getArticleById(safeId).versionCount;
check('no error',               r5.error === null);
check('version count unchanged', countAfter === countBefore);
check('execution not null',      r5.execution !== null);

// 7. safeMode=false → execute path runs
console.log('\n\u25b6 7. safeMode=false → execution attempted');
var execId = makeArticle('execute keyword auto-opt');
saveGscSnapshots(execId, makeDecayRows(
  { clicks: 200, impressions: 4000, ctr: 0.05, position: 5 },
  { clicks:  60, impressions: 1500, ctr: 0.015, position: 14 }
));
var r6 = await runAutoOptimizationForArticle(execId, { safeMode: false });
check('no error',          r6.error === null);
check('execution present', r6.execution !== null);
check('executionMode set', typeof r6.execution.executionMode === 'string');
check('rollback shape',    r6.execution.rollback !== undefined);

// 8. Event appended
console.log('\n\u25b6 8. Event appended after run');
var eventId = makeArticle('event keyword auto-opt');
await runAutoOptimizationForArticle(eventId, { safeMode: true });
var events = getArticleById(eventId).meta.events || [];
var optEvents = events.filter(function(e) { return e.type === 'auto_optimization_run'; });
check('event appended',            optEvents.length >= 1);
check('event has decayStatus',     optEvents[0] && typeof optEvents[0].decayStatus === 'string');
check('event has action',          optEvents[0] && typeof optEvents[0].action === 'string');
check('event has safeMode',        optEvents[0] && typeof optEvents[0].safeMode === 'boolean');
check('event has rollbackApplied', optEvents[0] && typeof optEvents[0].rollbackApplied === 'boolean');

// 9. Output contract stable
console.log('\n\u25b6 9. Output contract');
var contractId = makeArticle('contract keyword auto-opt');
var r7 = await runAutoOptimizationForArticle(contractId, { safeMode: true });
check('has articleId',          typeof r7.articleId === 'string');
check('has keyword',            r7.keyword !== undefined);
check('has error field',        r7.error !== undefined);
check('has decay object',       r7.decay !== null && typeof r7.decay === 'object');
check('has decision object',    r7.decision !== null && typeof r7.decision === 'object');
check('has execution object',   r7.execution !== null && typeof r7.execution === 'object');
check('decay has status',       typeof r7.decay.status === 'string');
check('decay has decayTypes',   r7.decay.decayTypes !== undefined && r7.decay.decayTypes !== null);
check('decision has action',    typeof r7.decision.action === 'string');
check('decision has priority',  typeof r7.decision.priority === 'string');
check('decision has confidence', typeof r7.decision.confidence === 'number');
check('execution has executed', typeof r7.execution.executed === 'boolean');
check('execution has rollback', r7.execution.rollback !== undefined);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
