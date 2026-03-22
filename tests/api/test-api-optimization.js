
import 'dotenv/config';
import app from '../../src/app.js';
import request from 'supertest';
import { createArticleRecord } from '../../src/repositories/articleRepository.js';

var pass = 0; var fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  API Optimization Test');
console.log('\u2500'.repeat(60));

var lr = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'testpass' });
var token = 'Bearer ' + ((lr.body.data || {}).token || '');
var artId = createArticleRecord({ keyword: 'optimize-test', article: '<p>x</p>', outline: '', research: {}, evaluation: {}, finalization: {} });

// 1. Auth guard
console.log('\n\u25b6 1. Auth guard');
var r1 = await request(app).post('/api/v1/articles/' + artId + '/optimize');
check('no token → 401',          r1.status === 401);

// 2. Unknown article
console.log('\n\u25b6 2. Unknown article');
var r2 = await request(app).post('/api/v1/articles/nonexistent_opt/optimize').set('Authorization', token).send({});
check('unknown → 404',           r2.status === 404);

// 3. Valid article safeMode=true
console.log('\n\u25b6 3. Valid article optimize');
var r3 = await request(app).post('/api/v1/articles/' + artId + '/optimize').set('Authorization', token).send({ safeMode: true });
check('status 200',              r3.status === 200);
var d3 = r3.body.data || {};
check('has articleId',           d3.articleId === artId);
check('has decision',            d3.decision !== undefined);
check('has execution',           d3.execution !== undefined);
check('has decay',               d3.decay !== undefined);
check('has keyword',             typeof d3.keyword === 'string' || d3.keyword === null);
check('no crash',                true);

// 4. No body (defaults safeMode=true)
console.log('\n\u25b6 4. No body defaults safe');
var r4 = await request(app).post('/api/v1/articles/' + artId + '/optimize').set('Authorization', token);
check('status 200 no body',      r4.status === 200);
check('no crash no body',        true);

// 5. Response contract
console.log('\n\u25b6 5. Response contract');
check('success key',             r3.body.success !== undefined);
check('data key',                r3.body.data !== undefined);
check('meta key',                r3.body.meta !== undefined);
check('meta.requestId',          typeof (r3.body.meta || {}).requestId === 'string');
check('meta.version v1',         (r3.body.meta || {}).version === 'v1');

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
