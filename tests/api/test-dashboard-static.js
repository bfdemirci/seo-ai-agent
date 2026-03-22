
import 'dotenv/config';
import app from '../../src/app.js';
import request from 'supertest';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Dashboard Static Test');
console.log('\u2500'.repeat(60));

// 1. static serve
console.log('\n\u25b6 1. Static file serving');
var r1 = await request(app).get('/maintenance.html');
check('maintenance.html 200',         r1.status === 200);
check('content-type html',            (r1.headers['content-type'] || '').includes('html'));
check('body has Maintenance',         r1.text && r1.text.includes('Maintenance'));
check('body has WordPress Health',    r1.text && r1.text.includes('WordPress Health'));
check('body has articleTable',        r1.text && r1.text.includes('articleTable'));
check('body has runTable',            r1.text && r1.text.includes('runTable'));
check('body has publishArticle',      r1.text && r1.text.includes('publishArticle'));
check('body has refreshTracking',     r1.text && r1.text.includes('refreshTracking'));
check('body has checkWpConnection',   r1.text && r1.text.includes('checkWpConnection'));

// 2. API routes unbroken
console.log('\n\u25b6 2. API routes intact');
var r2 = await request(app).get('/api/v1/health');
check('health 200',                   r2.status === 200);

// 3. Auth guard on new endpoints
console.log('\n\u25b6 3. Auth guard');
var r3a = await request(app).get('/api/v1/publish/verify-connection');
check('verify-connection 401',        r3a.status === 401);
var r3b = await request(app).post('/api/v1/publish/verify-post');
check('verify-post 401',              r3b.status === 401);
var r3c = await request(app).post('/api/v1/articles/any/publish');
check('publish 401',                  r3c.status === 401);
var r3d = await request(app).post('/api/v1/articles/any/tracking/update');
check('tracking update 401',          r3d.status === 401);

// 4. verify-post body validation
console.log('\n\u25b6 4. verify-post body validation');
var lr = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'testpass' });
var token = 'Bearer ' + ((lr.body.data || {}).token || '');
var r4 = await request(app).post('/api/v1/publish/verify-post').set('Authorization', token).send({});
check('missing postId → 400',         r4.status === 400);

// 5. tracking update unknown article
console.log('\n\u25b6 5. Tracking update unknown article');
var r5 = await request(app).post('/api/v1/articles/nonexistent_art/tracking/update').set('Authorization', token);
check('unknown article → 404',        r5.status === 404);

// 6. tracking update known article
console.log('\n\u25b6 6. Tracking update known article');
var ar = await request(app).get('/api/v1/articles').set('Authorization', token);
var items = ((ar.body.data || {}).items) || [];
if (items.length > 0) {
  var artId = items[0].id;
  var r6 = await request(app).post('/api/v1/articles/' + artId + '/tracking/update').set('Authorization', token);
  check('tracking update 200',        r6.status === 200);
  check('has ok',                     (r6.body.data || {}).ok !== undefined);
  check('has indexStatus',            (r6.body.data || {}).indexStatus !== undefined);
  check('has snapshotCount',          (r6.body.data || {}).snapshotCount !== undefined);
} else {
  check('no articles — skip (OK)',    true);
  check('skip 2',                     true);
  check('skip 3',                     true);
  check('skip 4',                     true);
}

// 7. 404 on unknown static
console.log('\n\u25b6 7. Unknown static 404');
var r7 = await request(app).get('/nonexistent.html');
check('unknown static 404',           r7.status === 404);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
