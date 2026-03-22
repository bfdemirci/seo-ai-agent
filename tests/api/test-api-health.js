import { request, app } from './_helper.js';
import * as log from '../lib/logger.js';

log.header('API Health Test');
var pass = 0; var fail = 0;

function check(name, ok, detail) {
  if (ok) { log.pass(name, detail); pass++; }
  else    { log.fail(name, detail); fail++; }
}

var res = await request(app).get('/api/v1/health');
check('status 200',             res.status === 200,              'got: '+res.status);
check('success true',           res.body.success === true);
check('data.ok true',           res.body.data && res.body.data.ok === true);
check('data.service present',   typeof (res.body.data||{}).service === 'string');
check('meta.requestId present', typeof (res.body.meta||{}).requestId === 'string');
check('meta.version v1',        (res.body.meta||{}).version === 'v1');
check('404 on bad route',       (await request(app).get('/api/v1/nonexistent')).status === 404);

log.summary([...Array(pass).fill({ok:true,name:''}), ...Array(fail).fill({ok:false,name:''})]);
log.info('pass', pass); log.info('fail', fail);
process.exit(fail > 0 ? 1 : 0);
