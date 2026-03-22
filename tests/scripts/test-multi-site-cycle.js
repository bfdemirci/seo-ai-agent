import 'dotenv/config';
import { saveSite } from '../../src/repositories/siteRepository.js';
import { runMultiSiteCycle, getSchedulerState } from '../../src/services/scheduler/schedulerService.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Multi-Site Cycle Test');
console.log('\u2500'.repeat(60));

var ts = Date.now();
saveSite({ siteId: 'ms_test_a_'+ts, name: 'Site A', enabled: true, publishEnabled: false, gscEnabled: false, campaignEnabled: false, safeMode: true, dailyArticleLimit: 5, hourlyArticleLimit: 2 });
saveSite({ siteId: 'ms_test_b_'+ts, name: 'Site B', enabled: true, publishEnabled: false, gscEnabled: false, campaignEnabled: false, safeMode: true, dailyArticleLimit: 5, hourlyArticleLimit: 2 });

console.log('\n\u25b6 1. runMultiSiteCycle is function');
check('is function', typeof runMultiSiteCycle === 'function');

console.log('\n\u25b6 2. run cycle');
var result = await runMultiSiteCycle();
check('ok true', result.ok === true);
check('totalSites >= 2', result.totalSites >= 2);
check('items array', Array.isArray(result.items));
check('failedSites is number', typeof result.failedSites === 'number');
check('processedSites is number', typeof result.processedSites === 'number');

console.log('\n\u25b6 3. per-site results');
var siteA = result.items.find(function(i){ return i.siteId === 'ms_test_a_'+ts; });
var siteB = result.items.find(function(i){ return i.siteId === 'ms_test_b_'+ts; });
check('site A in results', siteA !== undefined);
check('site B in results', siteB !== undefined);
check('site A ok', siteA && siteA.ok === true);
check('site B ok', siteB && siteB.ok === true);

console.log('\n\u25b6 4. scheduler state after cycle');
var state = getSchedulerState();
check('state is object', typeof state === 'object');
check('running false after', state.running === false);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);

process.exit(fail > 0 ? 1 : 0);

process.exit(fail > 0 ? 1 : 0);
