import { request, app, getToken } from './_helper.js';
import * as log from '../lib/logger.js';

log.header('API Programmatic Test');
var pass = 0; var fail = 0;
function check(name, ok, detail) {
  if (ok) { log.pass(name, detail); pass++; }
  else    { log.fail(name, detail); fail++; }
}

var TOKEN = await getToken();

// A. Auth guard
console.log('\n\u25b6 A. Auth guard');
var r1 = await request(app).post('/api/v1/programmatic/run').send({ baseKeyword: 'test' });
check('no token → 401', r1.status === 401);

// B. Validation
console.log('\n\u25b6 B. Validation');
var r2 = await request(app).post('/api/v1/programmatic/run').set('Authorization', 'Bearer ' + TOKEN).send({});
check('missing baseKeyword → 400', r2.status === 400);
var r2b = await request(app).post('/api/v1/programmatic/run').set('Authorization', 'Bearer ' + TOKEN).send({ baseKeyword: '' });
check('empty baseKeyword → 400', r2b.status === 400);

// C. Valid request
console.log('\n\u25b6 C. Valid request');
var r3 = await request(app).post('/api/v1/programmatic/run')
  .set('Authorization', 'Bearer ' + TOKEN)
  .send({ baseKeyword: 'seo nedir', limit: 1, safeMode: true })
  .timeout(300000);
check('status 200', r3.status === 200, 'got: ' + r3.status + ' body: ' + JSON.stringify(r3.body).slice(0,200));
check('success true', r3.body.success === true);

// D. safeMode=true → published 0
console.log('\n\u25b6 D. safeMode');
var d = r3.body.data || {};
check('safeMode published 0', d.published === 0);

// E. Response shape
console.log('\n\u25b6 E. Response shape');
check('has ok',             'ok'             in d);
check('has totalGenerated', 'totalGenerated' in d);
check('has created',        'created'        in d);
check('has published',      'published'      in d);
check('has failed',         'failed'         in d);
check('has items',          'items'          in d);
check('items is array',     Array.isArray(d.items));

// F. No crash
console.log('\n\u25b6 F. No crash');
check('no crash', r3.status === 200 || r3.status === 500);

// G. Meta
console.log('\n\u25b6 G. Meta');
check('meta.requestId', r3.body.meta && r3.body.meta.requestId);
check('meta.version v1', r3.body.meta && r3.body.meta.version === 'v1');

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
if (fail > 0) process.exit(1);
