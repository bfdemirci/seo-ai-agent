import { request, app, getToken } from './_helper.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  API Health Runtime Test');
console.log('\u2500'.repeat(60));

const token = await getToken();

console.log('\n\u25b6 A. GET /health (basic)');
const r1 = await request(app).get('/api/v1/health');
check('status 200', r1.status === 200);
check('ok true', r1.body && (r1.body.ok === true || (r1.body.data && r1.body.data.ok === true)));

console.log('\n\u25b6 B. GET /health/details');
const r2 = await request(app).get('/api/v1/health/details');
check('status 200', r2.status === 200);
const d2 = r2.body.data || r2.body;
check('has scheduler', d2 && d2.scheduler !== undefined);
check('scheduler.running is boolean', d2 && typeof d2.scheduler.running === 'boolean');
check('scheduler.enabled is boolean', d2 && typeof d2.scheduler.enabled === 'boolean');
check('has runHistory', d2 && d2.runHistory !== undefined);
check('no secrets', !JSON.stringify(d2).toLowerCase().includes('password') && !JSON.stringify(d2).toLowerCase().includes('api_key'));

console.log('\n\u25b6 C. GET /health/runtime');
const r3 = await request(app).get('/api/v1/health/runtime');
check('status 200', r3.status === 200);
const d3 = r3.body.data || r3.body;
check('has config', d3 && d3.config !== undefined);
check('schedulerEnabled is boolean', d3 && typeof d3.config.schedulerEnabled === 'boolean');
check('publishEnabled is boolean', d3 && typeof d3.config.publishEnabled === 'boolean');
check('gscSyncEnabled is boolean', d3 && typeof d3.config.gscSyncEnabled === 'boolean');
check('campaignSafeMode is boolean', d3 && typeof d3.config.campaignSafeMode === 'boolean');
check('no credentials in runtime', !JSON.stringify(d3).toLowerCase().includes('secret') && !JSON.stringify(d3).toLowerCase().includes('token'));

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);

process.exit(fail > 0 ? 1 : 0);
