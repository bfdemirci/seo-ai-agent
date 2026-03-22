import 'dotenv/config';
import { getRuntimeConfig } from '../../src/config/runtimeConfig.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Runtime Config Test');
console.log('\u2500'.repeat(60));

var cfg = getRuntimeConfig();
check('returns object', typeof cfg === 'object');
check('schedulerEnabled is boolean', typeof cfg.schedulerEnabled === 'boolean');
check('schedulerIntervalMs is number', typeof cfg.schedulerIntervalMs === 'number');
check('schedulerIntervalMs > 0', cfg.schedulerIntervalMs > 0);
check('gscSyncEnabled is boolean', typeof cfg.gscSyncEnabled === 'boolean');
check('publishEnabled is boolean', typeof cfg.publishEnabled === 'boolean');
check('campaignSafeMode is boolean', typeof cfg.campaignSafeMode === 'boolean');
check('maxCampaignsPerCycle is number', typeof cfg.maxCampaignsPerCycle === 'number');
check('maxCampaignsPerCycle > 0', cfg.maxCampaignsPerCycle > 0);
check('dashboardEnabled is boolean', typeof cfg.dashboardEnabled === 'boolean');
check('no secrets (no API keys)', !JSON.stringify(cfg).includes('ANTHROPIC') && !JSON.stringify(cfg).includes('password'));

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
