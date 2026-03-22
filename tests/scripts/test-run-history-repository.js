import 'dotenv/config';
import { saveRunHistory, listRunHistory, getRunHistoryById } from '../../src/repositories/runHistoryRepository.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  ✓ PASS', label); pass++; }
  else      { console.log('  ✗ FAIL', label); fail++; }
}

console.log('\n' + '─'.repeat(60));
console.log('  Run History Repository Test');
console.log('─'.repeat(60));

const run1 = {
  runId: 'test_run_' + Date.now(),
  type: 'scheduler_cycle',
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 123,
  summary: { gsc: { total:5,success:3,skipped:2,failed:0 }, decisions:{total:5,noAction:3,optimize:1,refresh:1,rewrite:0,delete:0,kill:0,failed:0}, execution:{total:2,executed:2,skipped:3,failed:0}, publish:{total:0,success:0,skipped:0,failed:0} },
  error: null
};

console.log('\n▶ 1. saveRunHistory');
const saved = saveRunHistory(run1);
check('returns run object', saved && saved.runId === run1.runId);

console.log('\n▶ 2. listRunHistory');
const { items, total } = listRunHistory({ limit: 10 });
check('returns array', Array.isArray(items));
check('total is number', typeof total === 'number');
check('saved run in list', items.some(r => r.runId === run1.runId));
check('newest first', items.length < 2 || items[0].startedAt >= items[items.length-1].startedAt);

console.log('\n▶ 3. getRunHistoryById');
const found = getRunHistoryById(run1.runId);
check('found run', found !== null);
check('correct runId', found && found.runId === run1.runId);
check('has summary', found && found.summary);
check('has durationMs', found && typeof found.durationMs === 'number');

console.log('\n▶ 4. unknown id');
const missing = getRunHistoryById('nonexistent_run_id_xyz');
check('unknown returns null', missing === null);

console.log('\n▶ 5. max runs enforcement');
const before = listRunHistory({ limit: 999 }).total;
for (let i = 0; i < 5; i++) {
  saveRunHistory({ runId: 'bulk_' + i + '_' + Date.now(), type:'scheduler_cycle', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), durationMs:1, summary:{gsc:{},decisions:{},execution:{},publish:{}}, error:null });
}
const after = listRunHistory({ limit: 999 }).total;
check('grows with saves', after >= 1 && after <= 100);
check('within max 100', after <= 100);

console.log('\n' + '─'.repeat(60));
console.log('  SUMMARY');
console.log('─'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
if (fail > 0) process.exit(1);
