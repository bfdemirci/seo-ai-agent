import { request, app, getToken } from './_helper.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  API Revenue Test');
console.log('\u2500'.repeat(60));

const token = await getToken();

console.log('\n\u25b6 A. Auth guard');
const r0 = await request(app).post('/api/v1/revenue/events').send({ type: 'sale', value: 10 });
check('no token -> 401', r0.status === 401);

console.log('\n\u25b6 B. Create event');
const payload = { siteId: 'api-test-site', articleId: 'api-art-1', keyword: 'test-kw', type: 'sale', value: 99.5, currency: 'USD', source: 'test' };
const r1 = await request(app).post('/api/v1/revenue/events').set('Authorization','Bearer '+token).send(payload);
check('status 200', r1.status === 200);
check('success true', r1.body.success === true);
check('eventId present', r1.body.data && r1.body.data.eventId);
check('type correct', r1.body.data && r1.body.data.type === 'sale');
check('value correct', r1.body.data && r1.body.data.value === 99.5);
check('meta requestId', r1.body.meta && r1.body.meta.requestId);

console.log('\n\u25b6 C. Bad type rejected');
const r2 = await request(app).post('/api/v1/revenue/events').set('Authorization','Bearer '+token).send({ type: 'invalid_type', value: 10 });
check('bad type -> 400', r2.status === 400);

console.log('\n\u25b6 D. List events');
const r3 = await request(app).get('/api/v1/revenue/events').set('Authorization','Bearer '+token);
check('list 200', r3.status === 200);
check('items array', Array.isArray(r3.body.data && r3.body.data.items));
check('pagination present', r3.body.data && r3.body.data.pagination !== undefined);

console.log('\n\u25b6 E. Summary');
const r4 = await request(app).get('/api/v1/revenue/summary?siteId=api-test-site').set('Authorization','Bearer '+token);
check('summary 200', r4.status === 200);
check('totalValue >= 99.5', r4.body.data && r4.body.data.totalValue >= 99.5);
check('totalEvents >= 1', r4.body.data && r4.body.data.totalEvents >= 1);
check('sales >= 1', r4.body.data && r4.body.data.sales >= 1);

console.log('\n\u25b6 F. Summary unknown siteId');
const r5 = await request(app).get('/api/v1/revenue/summary?siteId=nonexistent_xyz_abc').set('Authorization','Bearer '+token);
check('unknown site 200', r5.status === 200);
check('empty totalEvents', r5.body.data && r5.body.data.totalEvents === 0);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
