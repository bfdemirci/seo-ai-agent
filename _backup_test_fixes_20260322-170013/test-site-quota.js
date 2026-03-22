import 'dotenv/config';
import { saveSite } from '../../src/repositories/siteRepository.js';
import { getSiteQuotaState, canGenerateForSite, recordSiteGeneration } from '../../src/repositories/siteQuotaRepository.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Site Quota Test');
console.log('\u2500'.repeat(60));

var siteId = 'quota_test_' + Date.now();
saveSite({ siteId, name: 'Quota Test', enabled: true, dailyArticleLimit: 5, hourlyArticleLimit: 2 });

console.log('\n\u25b6 1. getSiteQuotaState');
var qs = getSiteQuotaState(siteId);
check('ok true', qs.ok === true);
check('has state', qs.state !== undefined);
check('dailyCount is number', typeof qs.state.dailyCount === 'number');
check('dailyLimit 5', qs.state.dailyLimit === 5);
check('hourlyLimit 2', qs.state.hourlyLimit === 2);

console.log('\n\u25b6 2. canGenerateForSite');
var can = canGenerateForSite(siteId, { requestedCount: 1 });
check('allowed initially', can.allowed === true);
check('no reason initially', can.reason === null);

console.log('\n\u25b6 3. recordSiteGeneration');
recordSiteGeneration(siteId, 2);
var qs2 = getSiteQuotaState(siteId);
check('hourlyCount now 2', qs2.state.hourlyCount === 2);
check('dailyCount now 2', qs2.state.dailyCount === 2);

console.log('\n\u25b6 4. quota exceeded');
var cant = canGenerateForSite(siteId, { requestedCount: 1 });
check('hourly limit blocks', cant.allowed === false);
check('has reason', cant.reason !== null);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
