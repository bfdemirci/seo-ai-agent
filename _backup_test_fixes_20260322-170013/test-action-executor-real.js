import 'dotenv/config';
import { executeDecision } from '../../src/engine/actionExecutor.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Action Executor Real Test');
console.log('\u2500'.repeat(60));

var articleId = 'test_art_exec_' + Date.now();

console.log('\n\u25b6 1. NO_ACTION');
var r1 = await executeDecision(articleId, { action: 'NO_ACTION' });
check('ok true', r1.ok === true);
check('skipped true', r1.skipped === true);
check('action NO_ACTION', r1.action === 'NO_ACTION');
check('no error', r1.error === null);

console.log('\n\u25b6 2. DELETE safe skip');
var r2 = await executeDecision(articleId, { action: 'DELETE' });
check('ok true', r2.ok === true);
check('skipped true', r2.skipped === true);
check('no destructive', r2.error === null);

console.log('\n\u25b6 3. KILL safe skip');
var r3 = await executeDecision(articleId, { action: 'KILL' });
check('ok true', r3.ok === true);
check('skipped true', r3.skipped === true);

console.log('\n\u25b6 4. OPTIMIZE without optimizeFn — safe skip');
var r4 = await executeDecision(articleId, { action: 'OPTIMIZE' });
check('ok true', r4.ok === true);
check('skipped true', r4.skipped === true);

console.log('\n\u25b6 5. OPTIMIZE with real optimizeFn');
var called = false;
var r5 = await executeDecision(articleId, { action: 'OPTIMIZE' }, {
  optimizeFn: async function(aid) { called = true; return { ok: true }; }
});
check('optimizeFn called', called === true);
check('ok true', r5.ok === true);
check('skipped false', r5.skipped === false);

console.log('\n\u25b6 6. REFRESH with optimizeFn');
var calledR = false;
var r6 = await executeDecision(articleId, { action: 'REFRESH' }, {
  optimizeFn: async function(aid) { calledR = true; return { ok: true }; }
});
check('REFRESH calls optimizeFn', calledR === true);
check('ok true', r6.ok === true);

console.log('\n\u25b6 7. REWRITE with optimizeFn');
var calledW = false;
var r7 = await executeDecision(articleId, { action: 'REWRITE' }, {
  optimizeFn: async function(aid) { calledW = true; return { ok: true }; }
});
check('REWRITE calls optimizeFn', calledW === true);

console.log('\n\u25b6 8. OPTIMIZE with failing optimizeFn');
var r8 = await executeDecision(articleId, { action: 'OPTIMIZE' }, {
  optimizeFn: async function(aid) { throw new Error('optimize failed'); }
});
check('ok false on failure', r8.ok === false);
check('skipped false', r8.skipped === false);
check('error message present', r8.error && r8.error.includes('optimize failed'));

console.log('\n\u25b6 9. return shape always complete');
check('r5 has articleId', r5.articleId === articleId);
check('r5 has action field', r5.action === 'OPTIMIZE');

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
