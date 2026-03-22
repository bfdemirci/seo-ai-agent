
import 'dotenv/config';
import app from '../../src/app.js';
import request from 'supertest';

var pass = 0; var fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Maintenance Page Content Test');
console.log('\u2500'.repeat(60));

var r = await request(app).get('/maintenance.html');
check('status 200',                    r.status === 200);
var body = r.text || '';

console.log('\n\u25b6 Core structure');
check('has articleTable',              body.includes('articleTable'));
check('has api/v1',                    body.includes('/api/v1'));
check('has token/localStorage',        body.includes('localStorage') || body.includes('token'));
check('has login logic',               body.includes('doLogin') || body.includes('login'));

console.log('\n\u25b6 Publish features');
check('has publish action',            body.includes('publishArticle') || body.includes('/publish'));
check('has retry action',              body.includes('retryPublish') || body.includes('retry'));
check('has config-check',              body.includes('config-check') || body.includes('configCheck') || body.includes('checkPublishConfig'));
check('has publish status',            body.includes('publishStatusResult') || body.includes('publish/articles'));
check('has integrity issues',          body.includes('loadPublishIssues') || body.includes('publish/issues'));

console.log('\n\u25b6 Orchestrator');
check('has orchestrator',              body.includes('orchestrator'));
check('has runArticle or run btn',     body.includes('runArticle') || body.includes('orchestrator/run'));

console.log('\n\u25b6 API endpoints referenced');
check('/api/v1/articles',              body.includes('/articles'));
check('/api/v1/publish',               body.includes('/publish'));
check('/api/v1/orchestrator',          body.includes('/orchestrator'));

console.log('\n\u25b6 API routes still work');
var lr = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'testpass' });
var token = 'Bearer ' + ((lr.body.data || {}).token || '');
var r2 = await request(app).get('/api/v1/publish/config-check').set('Authorization', token);
check('config-check 200',             r2.status === 200);
check('config-check has configured',  (r2.body.data || {}).configured !== undefined);
var r3 = await request(app).get('/api/v1/publish/issues').set('Authorization', token);
check('issues 200',                   r3.status === 200);
check('issues has totalIssues',       (r3.body.data || {}).totalIssues !== undefined);
var r4 = await request(app).get('/api/v1/publish/articles').set('Authorization', token);
check('publish/articles 200',         r4.status === 200);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
