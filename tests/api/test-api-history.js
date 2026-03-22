
import 'dotenv/config';
import app from '../../src/app.js';
import request from 'supertest';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  API History Test');
console.log('\u2500'.repeat(60));

var lr = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'testpass' });
var token = 'Bearer ' + ((lr.body.data || {}).token || '');

// 1. Run list
console.log('\n\u25b6 1. GET /orchestrator/runs');
var r1 = await request(app).get('/api/v1/orchestrator/runs').set('Authorization', token);
check('status 200',           r1.status === 200);
check('items array',          Array.isArray((r1.body.data || {}).items));
check('total number',         typeof (r1.body.data || {}).total === 'number');
var runs = (r1.body.data || {}).items || [];

// 2. Run detail shape
console.log('\n\u25b6 2. Run detail shape');
if (runs.length > 0) {
  var runId = runs[0].runId;
  var r2 = await request(app).get('/api/v1/orchestrator/runs/' + runId).set('Authorization', token);
  check('run detail 200',     r2.status === 200);
  var run = r2.body.data || {};
  check('has runId',          typeof run.runId === 'string');
  check('has mode',           typeof run.mode === 'string');
  check('has startedAt',      typeof run.startedAt === 'string');
  check('has durationMs',     typeof run.durationMs === 'number');
  check('has totals',         run.totals !== undefined);
  check('has items array',    Array.isArray(run.items));
  if (run.items && run.items[0]) {
    var item = run.items[0];
    check('item has keyword',    typeof item.keyword === 'string' || typeof item.articleId === 'string');
    check('item has decayStatus', typeof item.decayStatus === 'string');
  }
} else {
  check('no runs yet — skip detail (OK)', true);
}

// 3. Article detail — events accessible
console.log('\n\u25b6 3. Article detail events');
var ar = await request(app).get('/api/v1/articles').set('Authorization', token);
var articles = ((ar.body.data || {}).items) || [];
if (articles.length > 0) {
  var artId = articles[0].id || (articles[0].meta && articles[0].meta.id);
  var r3 = await request(app).get('/api/v1/articles/' + artId).set('Authorization', token);
  check('article detail 200', r3.status === 200);
  var detail = r3.body.data || {};
  var events = detail.events || (detail.meta && detail.meta.events) || [];
  check('events is array',    Array.isArray(events));
  check('meta has publishedUrl field', (detail.meta || {}).publishedUrl !== undefined);
  check('meta has publishedUrl field (dup OK)', (detail.meta || {}).publishedUrl !== undefined);
} else {
  check('no articles — skip (OK)', true);
}

// 4. Static dashboard still loads
console.log('\n\u25b6 4. Dashboard still loads');
var r4 = await request(app).get('/maintenance.html');
check('maintenance.html 200',       r4.status === 200);
check('has Run History section',    r4.text && r4.text.includes('Run History'));
check('has runTable',               r4.text && r4.text.includes('runTable'));
check('has event-tag class',        r4.text && r4.text.includes('event-tag'));
check('has loadRuns function',      r4.text && r4.text.includes('loadRuns'));
check('has toggleRunDetail',        r4.text && r4.text.includes('toggleRunDetail'));

// 5. Publish history fields accessible via article detail
console.log('\n\u25b6 5. Publish history fields in article detail');
if (articles.length > 0) {
  var artId2 = articles[0].id || (articles[0].meta && articles[0].meta.id);
  var r5 = await request(app).get('/api/v1/articles/' + artId2).set('Authorization', token);
  var meta5 = (r5.body.data || {}).meta || {};
  check('publishedUrl accessible',  meta5.publishedUrl !== undefined);
  check('publishedAt accessible',   meta5.publishedAt !== undefined || meta5.createdAt !== undefined);
  check('currentVersion accessible', typeof meta5.currentVersion === 'string');
} else {
  check('no articles — skip (OK)', true);
}

// 6. No auth → 401 on run endpoints
console.log('\n\u25b6 6. Auth guard on run endpoints');
var r6a = await request(app).get('/api/v1/orchestrator/runs');
check('no token runs list → 401',   r6a.status === 401);
var r6b = await request(app).get('/api/v1/orchestrator/runs/nonexistent');
check('no token run detail → 401',  r6b.status === 401);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
