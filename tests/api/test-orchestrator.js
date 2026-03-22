import 'dotenv/config';
import { default as app } from '../../src/app.js';
import request from 'supertest';
import fs from 'fs';
import path from 'path';

var pass = 0; var fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Orchestrator API Test');
console.log('\u2500'.repeat(60));

var A = '';
var artId = '';

(async function() {
  // login
  var login = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'testpass' });
  A = 'Bearer ' + (login.body.data || {}).token;

  // get first article
  var list = await request(app).get('/api/v1/articles').set('Authorization', A);
  artId = ((list.body.data || {}).items || [])[0];
  artId = artId && artId.id;
  console.log('  \u2192 articleId', artId || '(none)');

  // 1. Protected route rejects
  var r0 = await request(app).post('/api/v1/orchestrator/run').send({ mode: 'dry_run' });
  check('protected: no token 401', r0.status === 401);

  // 2. dry_run returns summary
  var r1 = await request(app).post('/api/v1/orchestrator/run')
    .set('Authorization', A)
    .send({ mode: 'dry_run', limit: 3 });
  check('dry_run 200', r1.status === 200);
  check('dry_run has runId', typeof (r1.body.data || {}).runId === 'string');
  check('dry_run has mode', (r1.body.data || {}).mode === 'dry_run');
  check('dry_run has summary', typeof (r1.body.data || {}).summary === 'object');
  check('dry_run has items array', Array.isArray((r1.body.data || {}).items));
  var runId = (r1.body.data || {}).runId;
  console.log('  \u2192 dry runId', runId);

  // 3. dry_run does NOT create run history file
  var runFile = path.join('storage', 'orchestrator-runs', runId + '.json');
  check('dry_run no file created', !fs.existsSync(runFile));

  // 4. execute mode creates run history file
  var r2 = await request(app).post('/api/v1/orchestrator/run')
    .set('Authorization', A)
    .send({ mode: 'execute', limit: 2 });
  check('execute 200', r2.status === 200);
  var execRunId = (r2.body.data || {}).runId;
  var execFile  = path.join('storage', 'orchestrator-runs', execRunId + '.json');
  check('execute file created', fs.existsSync(execFile));
  console.log('  \u2192 execute runId', execRunId);

  // 5. GET /runs returns array
  var r3 = await request(app).get('/api/v1/orchestrator/runs').set('Authorization', A);
  check('GET /runs 200', r3.status === 200);
  check('GET /runs items array', Array.isArray((r3.body.data || {}).items));
  check('GET /runs total >= 1', ((r3.body.data || {}).total || 0) >= 1);

  // 6. GET /runs/:runId returns detail
  var r4 = await request(app).get('/api/v1/orchestrator/runs/' + execRunId).set('Authorization', A);
  check('GET /runs/:runId 200', r4.status === 200);
  check('run detail has items', Array.isArray((r4.body.data || {}).items));
  check('run detail has totals', typeof (r4.body.data || {}).totals === 'object');
  check('run detail totals.totalTargets', typeof ((r4.body.data || {}).totals || {}).totalTargets === 'number');

  // 7. unknown runId 404
  var r5 = await request(app).get('/api/v1/orchestrator/runs/nonexistent_run').set('Authorization', A);
  check('unknown runId 404', r5.status === 404);

  // 8. invalid mode 400
  var r6 = await request(app).post('/api/v1/orchestrator/run')
    .set('Authorization', A)
    .send({ mode: 'invalid' });
  check('invalid mode 400', r6.status === 400);

  // 9. single article endpoint
  if (artId) {
    var r7 = await request(app).post('/api/v1/orchestrator/articles/' + artId + '/run')
      .set('Authorization', A)
      .send({ mode: 'dry_run' });
    check('article run 200', r7.status === 200);
    check('article run has items', Array.isArray((r7.body.data || {}).items));
    check('article run 1 item', ((r7.body.data || {}).items || []).length === 1);
    check('article item has decayStatus', typeof (((r7.body.data || {}).items || [])[0] || {}).decayStatus === 'string');
    check('article item has recommendedActionHint', typeof (((r7.body.data || {}).items || [])[0] || {}).recommendedActionHint === 'string');
  } else {
    check('article run (skipped - no articles)', true);
    check('article run has items (skipped)', true);
    check('article run 1 item (skipped)', true);
    check('article item has decayStatus (skipped)', true);
    check('article item has recommendedActionHint (skipped)', true);
  }

  // 10. execute appends article event
  if (artId) {
    var r8 = await request(app).post('/api/v1/orchestrator/articles/' + artId + '/run')
      .set('Authorization', A)
      .send({ mode: 'execute' });
    check('execute article run 200', r8.status === 200);
    // check event appended via article detail
    var detail = await request(app).get('/api/v1/articles/' + artId).set('Authorization', A);
    var events = (detail.body.data || {}).events || [];
    var orcEvent = events.filter(function(e){ return e.type === 'orchestrator_run'; });
    check('orchestrator_run event appended', orcEvent.length >= 1);
  } else {
    check('execute article run (skipped)', true);
    check('orchestrator_run event appended (skipped)', true);
  }

  // 11. run result shape
  var r9 = await request(app).post('/api/v1/orchestrator/run')
    .set('Authorization', A)
    .send({ mode: 'dry_run', limit: 1 });
  var d = r9.body.data || {};
  check('shape: runId string',    typeof d.runId === 'string');
  check('shape: mode string',     typeof d.mode === 'string');
  check('shape: startedAt',       typeof d.startedAt === 'string');
  check('shape: finishedAt',      typeof d.finishedAt === 'string');
  check('shape: durationMs',      typeof d.durationMs === 'number');
  check('shape: summary object',  typeof d.summary === 'object');
  check('shape: items array',     Array.isArray(d.items));

  console.log('\n' + '\u2500'.repeat(60));
  console.log('  SUMMARY');
  console.log('\u2500'.repeat(60));
  console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
  process.exit(fail > 0 ? 1 : 0);
})().catch(function(e){ console.error(e); process.exit(1); });
