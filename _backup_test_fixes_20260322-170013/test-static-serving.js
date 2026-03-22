
import 'dotenv/config';
import app from '../../src/app.js';
import request from 'supertest';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Static Serving + Dashboard Smoke Test');
console.log('\u2500'.repeat(60));

// 1. maintenance.html 200
console.log('\n\u25b6 1. Static file serving');
var r1 = await request(app).get('/maintenance.html');
check('maintenance.html status 200',       r1.status === 200);
check('content-type html',                 (r1.headers['content-type'] || '').includes('html'));
check('body contains Maintenance',         r1.text && r1.text.includes('Maintenance'));
check('body contains article table',       r1.text && r1.text.includes('articleTable'));
check('body contains dry run button',      r1.text && r1.text.includes('dry_run'));
check('body contains safe mode notice',    r1.text && r1.text.includes('Safe Mode'));

// 2. API routes still intact
console.log('\n\u25b6 2. API routes unbroken');
var r2 = await request(app).get('/api/v1/health');
check('health endpoint still 200',         r2.status === 200);
check('health response ok',                (r2.body.data || {}).ok === true);

// 3. Auth flow works
console.log('\n\u25b6 3. Auth flow');
var r3 = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'testpass' });
check('login 200',                         r3.status === 200);
check('token present',                     !!(r3.body.data || {}).token);

var token = 'Bearer ' + ((r3.body.data || {}).token || '');

// 4. Article list reachable with token
console.log('\n\u25b6 4. Article list');
var r4 = await request(app).get('/api/v1/articles').set('Authorization', token);
check('articles 200',                      r4.status === 200);
check('items array',                       Array.isArray(((r4.body.data || {}).items)));

// 5. Orchestrator run reachable
console.log('\n\u25b6 5. Orchestrator dry run');
var r5 = await request(app).post('/api/v1/orchestrator/run').set('Authorization', token).send({ mode: 'dry_run' });
check('orchestrator 200',                  r5.status === 200);
check('has runId',                         !!(r5.body.data || {}).runId);
check('mode is dry_run',                   (r5.body.data || {}).mode === 'dry_run');

// 6. Single article run (use first article)
console.log('\n\u25b6 6. Single article run');
var articles = ((r4.body.data || {}).items) || [];
if (articles.length > 0) {
  var artId = articles[0].id || (articles[0].meta && articles[0].meta.id);
  var r6 = await request(app)
    .post('/api/v1/orchestrator/articles/' + artId + '/run')
    .set('Authorization', token)
    .send({ mode: 'dry_run' });
  check('single article run 200',          r6.status === 200);
  check('has items',                       Array.isArray((r6.body.data || {}).items));
} else {
  check('no articles — skip single run',   true);
}

// 7. Unknown page 404 (not crashing)
console.log('\n\u25b6 7. 404 still works');
var r7 = await request(app).get('/nonexistent-page.html');
check('unknown static 404',               r7.status === 404);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
