import 'dotenv/config';
import { getSchedulerState, startScheduler, stopScheduler } from '../../src/services/scheduler/schedulerService.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Scheduler Lock Test');
console.log('\u2500'.repeat(60));

console.log('\n\u25b6 1. getSchedulerState exports and returns safe shape');
var state = getSchedulerState();
check('returns object', typeof state === 'object');
check('has running bool', typeof state.running === 'boolean');
check('has enabled bool', typeof state.enabled === 'boolean');
check('running is false at start', state.running === false);

console.log('\n\u25b6 2. startScheduler / stopScheduler safe');
check('startScheduler is function', typeof startScheduler === 'function');
check('stopScheduler is function', typeof stopScheduler === 'function');

try {
  stopScheduler();
  check('stopScheduler does not throw', true);
} catch (err) {
  check('stopScheduler does not throw', false);
}

console.log('\n\u25b6 3. state after stop');
var stateAfterStop = getSchedulerState();
check('running false after stop', stateAfterStop.running === false);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
