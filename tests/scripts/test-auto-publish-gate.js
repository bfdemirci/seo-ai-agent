import 'dotenv/config';
import { appendGscSnapshots } from '../../src/repositories/gscSnapshotRepository.js';
import { createArticleRecord, getArticleById, updateArticleMetadata } from '../../src/repositories/articleRepository.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Auto Publish Gate Test');
console.log('\u2500'.repeat(60));

// Position guard logic (extracted for unit testing)
function positionGuardCheck(gscSnapshots) {
  if (!gscSnapshots || gscSnapshots.length === 0) return { blocked: false, reason: null };
  var latest = gscSnapshots[gscSnapshots.length - 1];
  if (latest && latest.position && latest.position > 20) {
    return { blocked: true, reason: 'position_guard_blocked (pos=' + latest.position + ')' };
  }
  return { blocked: false, reason: null };
}

console.log('\n\u25b6 1. No GSC data — allow publish');
var g1 = positionGuardCheck([]);
check('not blocked', g1.blocked === false);
check('reason null', g1.reason === null);

console.log('\n\u25b6 2. Position > 20 — block');
var g2 = positionGuardCheck([{ position: 35, date: '2026-01-01' }]);
check('blocked', g2.blocked === true);
check('reason contains position_guard_blocked', g2.reason && g2.reason.includes('position_guard_blocked'));

console.log('\n\u25b6 3. Position == 20 — allow');
var g3 = positionGuardCheck([{ position: 20, date: '2026-01-01' }]);
check('not blocked at 20', g3.blocked === false);

console.log('\n\u25b6 4. Position = 5 — allow');
var g4 = positionGuardCheck([{ position: 5, date: '2026-01-01' }]);
check('not blocked at 5', g4.blocked === false);

console.log('\n\u25b6 5. Multiple snapshots — use latest');
var g5 = positionGuardCheck([
  { position: 5, date: '2025-12-01' },
  { position: 30, date: '2026-01-01' }
]);
check('blocked by latest pos 30', g5.blocked === true);

console.log('\n\u25b6 6. Latest position null/undefined — allow');
var g6 = positionGuardCheck([{ date: '2026-01-01' }]);
check('not blocked when no position field', g6.blocked === false);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
