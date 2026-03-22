import { request, app, getToken } from './_helper.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  API Sites Test');
console.log('\u2500'.repeat(60));

const token = await getToken();
const ts = Date.now();
const siteId = 'api_site_' + ts;

console.log('\n\u25b6 A. Auth guard');
const r0 = await request(app).get('/api/v1/sites');
check('no token -> 401', r0.status === 401);

console.log('\n\u25b6 B. Create site');
const r1 = await request(app).post('/api/v1/sites').set('Authorization','Bearer '+token).send({ siteId, name: 'API Test Site', baseUrl: 'https://test.com', language: 'tr', enabled: true, publishEnabled: false, gscEnabled: true, campaignEnabled: false, safeMode: true, dailyArticleLimit: 10, hourlyArticleLimit: 3, wordpress: { baseUrl: 'https://test.com', username: 'admin', appPassword: 'supersecret' } });
check('create 200', r1.status === 200);
check('success true', r1.body.success === true);
check('siteId correct', r1.body.data && r1.body.data.siteId === siteId);
check('password redacted', r1.body.data && r1.body.data.wordpress && r1.body.data.wordpress.appPassword === '[REDACTED]');

console.log('\n\u25b6 C. List sites');
const r2 = await request(app).get('/api/v1/sites').set('Authorization','Bearer '+token);
check('list 200', r2.status === 200);
check('items array', Array.isArray(r2.body.data && r2.body.data.items));
check('new site in list', r2.body.data.items.some(function(s){ return s.siteId === siteId; }));
check('no passwords exposed', r2.body.data.items.every(function(s){ return !s.wordpress || s.wordpress.appPassword !== 'supersecret'; }));

console.log('\n\u25b6 D. Get site by id');
const r3 = await request(app).get('/api/v1/sites/' + siteId).set('Authorization','Bearer '+token);
check('get 200', r3.status === 200);
check('correct siteId', r3.body.data && r3.body.data.siteId === siteId);
check('password redacted in get', r3.body.data && r3.body.data.wordpress && r3.body.data.wordpress.appPassword === '[REDACTED]');

console.log('\n\u25b6 E. Update site');
const r4 = await request(app).patch('/api/v1/sites/' + siteId).set('Authorization','Bearer '+token).send({ dailyArticleLimit: 50 });
check('update 200', r4.status === 200);
check('limit updated', r4.body.data && r4.body.data.dailyArticleLimit === 50);

console.log('\n\u25b6 F. Unknown site -> 404');
const r5 = await request(app).get('/api/v1/sites/nonexistent_' + ts).set('Authorization','Bearer '+token);
check('unknown -> 404', r5.status === 404);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
