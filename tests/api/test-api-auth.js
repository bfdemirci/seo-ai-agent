import { request, app, auth } from './_helper.js';
import * as log from '../lib/logger.js';
import 'dotenv/config';

log.header('API Auth Test');
var pass = 0; var fail = 0;
function check(name, ok, detail) { if (ok){log.pass(name,detail);pass++;}else{log.fail(name,detail);fail++;} }

var email    = process.env.ADMIN_EMAIL    || 'admin@test.com';
var password = process.env.ADMIN_PASSWORD || 'testpass';

// 1. valid login
var r1 = await request(app).post('/api/v1/auth/login').send({ email, password });
check('login 200',           r1.status === 200,                     'got: '+r1.status);
check('success true',        r1.body.success === true);
check('token present',       typeof (r1.body.data||{}).token === 'string');
check('expiresIn present',   !!(r1.body.data||{}).expiresIn);
var token = r1.body.data && r1.body.data.token;

// 2. wrong password
var r2 = await request(app).post('/api/v1/auth/login').send({ email, password: 'wrong' });
check('wrong password 401',  r2.status === 401,    'got: '+r2.status);
check('error code present',  !!(r2.body.error||{}).code);

// 3. missing body
var r3 = await request(app).post('/api/v1/auth/login').send({});
check('missing body 400',    r3.status === 400,    'got: '+r3.status);
check('INVALID_BODY code',   (r3.body.error||{}).code === 'INVALID_BODY');

// 4. protected endpoint without token
var r4 = await request(app).get('/api/v1/articles');
check('no token 401',        r4.status === 401,    'got: '+r4.status);

// 5. protected with bad token
var r5 = await request(app).get('/api/v1/articles').set('Authorization','Bearer bad.token.here');
check('bad token 401',       r5.status === 401,    'got: '+r5.status);

// 6. protected with valid token
var r6 = await request(app).get('/api/v1/articles').set('Authorization', auth(token));
check('valid token passes',  r6.status === 200,    'got: '+r6.status);

log.summary([...Array(pass).fill({ok:true,name:''}), ...Array(fail).fill({ok:false,name:''})]);
log.info('pass', pass); log.info('fail', fail);
process.exit(fail > 0 ? 1 : 0);
