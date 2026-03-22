
import 'dotenv/config';

var pass = 0; var fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Scheduler Smoke Test');
console.log('\u2500'.repeat(60));

// 1. imports
console.log('\n\u25b6 1. Imports');
var { startScheduler, stopScheduler, runSchedulerCycle } = await import('../../src/services/scheduler/schedulerService.js');
check('startScheduler is function',   typeof startScheduler === 'function');
check('stopScheduler is function',    typeof stopScheduler === 'function');
check('runSchedulerCycle is function',typeof runSchedulerCycle === 'function');

// 2. dependency imports
console.log('\n\u25b6 2. Dependencies');
var { runAutoOptimizationForArticle } = await import('../../src/services/maintenance/autoOptimizationService.js');
check('autoOptimization imported',    typeof runAutoOptimizationForArticle === 'function');

var { publishArticle } = await import('../../src/services/publisher/publisherService.js');
check('publisherService imported',    typeof publishArticle === 'function');

var { shouldPublishArticle } = await import('../../src/services/publisher/publishDecisionService.js');
check('publishDecisionService imported', typeof shouldPublishArticle === 'function');

// 3. scheduler start/stop
console.log('\n\u25b6 3. Start / Stop');
var originalInterval = process.env.SCHEDULER_INTERVAL_MS;
process.env.SCHEDULER_INTERVAL_MS = '999999999'; // don't actually fire
var timer = startScheduler();
check('startScheduler returns timer', timer !== null && timer !== undefined);
stopScheduler();
check('stopScheduler no throw',       true);
if (originalInterval) process.env.SCHEDULER_INTERVAL_MS = originalInterval;
else delete process.env.SCHEDULER_INTERVAL_MS;

// 4. runSchedulerCycle — no crash (empty or minimal articles)
console.log('\n\u25b6 4. Cycle smoke (no crash)');
var threw = false;
try {
  await runSchedulerCycle();
} catch(e) {
  threw = true;
  console.error('  cycle threw:', e.message);
}
check('cycle no crash',               !threw);

// 5. multiple start/stop safe
console.log('\n\u25b6 5. Multiple start/stop safe');
process.env.SCHEDULER_INTERVAL_MS = '999999999';
var t1 = startScheduler();
var t2 = startScheduler(); // should replace
check('double start no crash',        true);
stopScheduler();
stopScheduler(); // should be safe
check('double stop no crash',         true);
delete process.env.SCHEDULER_INTERVAL_MS;

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
