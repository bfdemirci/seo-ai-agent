import { request, app, getToken, auth } from './_helper.js';
import * as log  from '../lib/logger.js';
import * as fix  from '../lib/fixtureManager.js';
import { createArticleRecord } from '../../src/repositories/articleRepository.js';

log.header('API Decay Test');
var pass = 0; var fail = 0;
function check(name, ok, detail) { if (ok){log.pass(name,detail);pass++;}else{log.fail(name,detail);fail++;} }

var token  = await getToken();
var A      = auth(token);
var article = fix.load('seo nedir','article');
var outline  = fix.load('seo nedir','outline');
var artId = createArticleRecord({ keyword:'seo nedir', article, outline });

// 1. Get decay
var r1 = await request(app).get('/api/v1/articles/'+artId+'/decay').set('Authorization',A);
check('decay 200',                r1.status === 200,    'got: '+r1.status);
check('has articleId',            (r1.body.data||{}).articleId === artId);
check('has status',               typeof (r1.body.data||{}).status === 'string');
check('has decayTypes',           typeof (r1.body.data||{}).decayTypes === 'object');
check('has evidence',             typeof (r1.body.data||{}).evidence === 'object');
check('has confidence',           typeof (r1.body.data||{}).confidence === 'number');
check('has summary',              typeof (r1.body.data||{}).summary === 'string');
check('has recommendedActionHint',typeof (r1.body.data||{}).recommendedActionHint === 'string');

// 2. Recompute
var r2 = await request(app).post('/api/v1/articles/'+artId+'/decay/recompute').set('Authorization',A);
check('recompute 200',            r2.status === 200);
check('recompute has status',     typeof (r2.body.data||{}).status === 'string');

// 3. No GSC = insufficient data
check('insufficient data status', ['watch','healthy'].includes((r1.body.data||{}).status), (r1.body.data||{}).status);

// 4. Unknown article
var r4 = await request(app).get('/api/v1/articles/bad_id/decay').set('Authorization',A);
check('unknown article 404',      r4.status === 404);

// 5. Response meta shape
check('meta requestId',    typeof ((r1.body.meta||{}).requestId) === 'string');
check('meta version v1',   (r1.body.meta||{}).version === 'v1');

log.summary([...Array(pass).fill({ok:true,name:''}), ...Array(fail).fill({ok:false,name:''})]);
log.info('pass', pass); log.info('fail', fail);
process.exit(fail > 0 ? 1 : 0);
