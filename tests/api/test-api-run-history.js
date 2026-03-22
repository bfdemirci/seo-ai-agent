import { request, app, getToken } from './_helper.js';
import { saveRunHistory } from '../../src/repositories/runHistoryRepository.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  ✓ PASS', label); pass++; }
  else      { console.log('  ✗ FAIL', label); fail++; }
}

console.log('\n' + '─'.repeat(60));
console.log('  API Run History Test');
console.log('─'.repeat(60));

const token = await getToken();

// seed a run
const seedRun = {
  runId: 'api_test_run_' + Date.now(),
  type: 'scheduler_cycle',
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 456,
  summary: { gsc:{total:2,success:1,skipped:1,failed:0}, decisions:{total:2,noAction:1,optimize:1,refresh:0,rewrite:0,delete:0,kill:0,failed:0}, execution:{total:1,executed:1,skipped:1,failed:0}, publish:{total:0,success:0,skipped:0,failed:0} },
  error: null
};
saveRunHistory(seedRun);

console.log('\n▶ A. Auth guard');
const r0 = await request(app).get('/api/v1/run-history/runs');
check('no token → 401', r0.status === 401);

console.log('\n▶ B. List runs');
const r1 = await request(app).get('/api/v1/run-history/runs').set('Authorization','Bearer '+token);
check('status 200', r1.status === 200);
check('success true', r1.body.success === true);
check('data.items array', Array.isArray(r1.body.data?.items));
check('data.pagination present', r1.body.data?.pagination !== undefined);
check('meta.requestId', r1.body.meta?.requestId);
check('meta.version v1', r1.body.meta?.version === 'v1');

console.log('\n▶ C. Get by id');
const r2 = await request(app).get('/api/v1/run-history/runs/' + seedRun.runId).set('Authorization','Bearer '+token);
check('status 200', r2.status === 200);
check('correct runId', r2.body.data?.runId === seedRun.runId);
check('has summary', r2.body.data?.summary !== undefined);
check('has durationMs', typeof r2.body.data?.durationMs === 'number');

console.log('\n▶ D. Unknown id → 404');
const r3 = await request(app).get('/api/v1/run-history/runs/nonexistent_xyz').set('Authorization','Bearer '+token);
check('unknown → 404', r3.status === 404);

console.log('\n' + '─'.repeat(60));
console.log('  SUMMARY');
console.log('─'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
if (fail > 0) process.exit(1);

process.exit(fail > 0 ? 1 : 0);
