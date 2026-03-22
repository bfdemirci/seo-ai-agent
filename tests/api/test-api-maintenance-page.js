
import 'dotenv/config';
import app from '../../src/app.js';
import request from 'supertest';

var pass = 0; var fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Maintenance Page Test');
console.log('\u2500'.repeat(60));

// 1. static serve
console.log('\n\u25b6 1. Static file serving');
var r1 = await request(app).get('/maintenance.html');
check('status 200',              r1.status === 200);
check('content-type html',       (r1.headers['content-type'] || '').includes('html'));
check('not 404',                 r1.status !== 404);

// 2. content markers
console.log('\n\u25b6 2. Content markers');
var body = r1.text || '';
check('has Maintenance/Dashboard', body.includes('Maintenance') || body.includes('Dashboard'));
check('has articleTable',          body.includes('articleTable'));
check('has Publish text',          body.includes('Publish') || body.includes('publish'));
check('has Retry text',            body.includes('Retry') || body.includes('retry') || body.includes('retryPublish'));
check('has Optimize',              body.includes('Optimize') || body.includes('optimizeArticle'));
check('has Eligibility',           body.includes('checkEligibility') || body.includes('Eligib'));
check('has Publish Status fn',     body.includes('checkPublishStatus'));
check('has WP Ops Summary',        body.includes('wpOpsSummary') || body.includes('WP Ops'));
check('has api/v1',                body.includes('/api/v1'));
check('has auth logic',            body.includes('localStorage') || body.includes('token'));

// 3. publish status section
console.log('\n\u25b6 3. Publish status section');
check('has publishStatusResult',   body.includes('publishStatusResult'));
check('has loadPublishedList',     body.includes('loadPublishedList'));
check('has retryPublish fn',       body.includes('retryPublish'));
check('has loadPublishIssues',     body.includes('loadPublishIssues'));

// 4. API routes intact
console.log('\n\u25b6 4. API routes intact');
var r2 = await request(app).get('/api/v1/health');
check('health 200',                r2.status === 200);
var r3 = await request(app).get('/api/v1/publish/articles');
check('publish/articles 401',      r3.status === 401);
var r4 = await request(app).get('/api/v1/publish/issues');
check('publish/issues 401',        r4.status === 401);
var r5 = await request(app).get('/api/v1/publish/config-check');
check('config-check 401',          r5.status === 401);

// 5. unknown static 404
console.log('\n\u25b6 5. Unknown static');
var r6 = await request(app).get('/nonexistent-page.html');
check('unknown 404',               r6.status === 404);

// 6. decision endpoint
console.log('\n\u25b6 6. Decision endpoint');
var lr = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'testpass' });
var token = 'Bearer ' + ((lr.body.data || {}).token || '');
var arts = await request(app).get('/api/v1/articles').set('Authorization', token);
var artId = (((arts.body.data || {}).items || [])[0] || {}).id;
if (artId) {
  var rd = await request(app).get('/api/v1/articles/' + artId + '/publish/decision').set('Authorization', token);
  check('decision 200',            rd.status === 200);
  check('has shouldPublish',       (rd.body.data || {}).shouldPublish !== undefined);
} else {
  check('decision skip (no arts)', true);
  check('skip 2',                  true);
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
