import { request, app, getToken, auth } from './_helper.js';
import * as log  from '../lib/logger.js';
import * as fix  from '../lib/fixtureManager.js';
import { createArticleRecord } from '../../src/repositories/articleRepository.js';

log.header('API Articles Test');
var pass = 0; var fail = 0;
function check(name, ok, detail) { if (ok){log.pass(name,detail);pass++;}else{log.fail(name,detail);fail++;} }

var token = await getToken();
var A = auth(token);

// Seed a test article
var article = fix.load('seo nedir','article');
var outline  = fix.load('seo nedir','outline');
var artId = createArticleRecord({ keyword:'seo nedir', article, outline });

// 1. List articles
var r1 = await request(app).get('/api/v1/articles').set('Authorization',A);
check('list 200',                   r1.status === 200,              'got: '+r1.status);
check('list data.items array',      Array.isArray((r1.body.data||{}).items));
check('list pagination present',    typeof (r1.body.data||{}).pagination === 'object');
check('pagination has total',       typeof ((r1.body.data||{}).pagination||{}).total === 'number');

// 2. List with q filter
var r2 = await request(app).get('/api/v1/articles?q=seo').set('Authorization',A);
check('list filter 200',            r2.status === 200);
check('filtered results',           r2.body.data.items.every(function(i){return (i.keyword||'').toLowerCase().includes('seo');}));

// 3. Get article
var r3 = await request(app).get('/api/v1/articles/'+artId).set('Authorization',A);
check('get article 200',            r3.status === 200,              'got: '+r3.status);
check('article has meta',           !!(r3.body.data||{}).meta);
check('article meta.id matches',    (r3.body.data.meta||{}).id === artId);

// 4. Bad articleId
var r4 = await request(app).get('/api/v1/articles/nonexistent_id').set('Authorization',A);
check('unknown article 404',        r4.status === 404,              'got: '+r4.status);

// 5. Get versions
var r5 = await request(app).get('/api/v1/articles/'+artId+'/versions').set('Authorization',A);
check('versions 200',               r5.status === 200);
check('versions array',             Array.isArray((r5.body.data||{}).versions));
check('versions has v1',            ((r5.body.data||{}).versions||[]).some(function(v){return v.version==='v1';}));

// 6. Get version detail
var r6 = await request(app).get('/api/v1/articles/'+artId+'/versions/v1').set('Authorization',A);
check('version v1 200',             r6.status === 200);
check('version has data',           !!(r6.body.data||{}).data);

// 7. Bad version
var r7 = await request(app).get('/api/v1/articles/'+artId+'/versions/v999').set('Authorization',A);
check('missing version 404',        r7.status === 404);

// 8. Invalid version format
var r8 = await request(app).get('/api/v1/articles/'+artId+'/versions/bad').set('Authorization',A);
check('bad version format 400',     r8.status === 400);

// 9. Patch metadata
var r9 = await request(app).patch('/api/v1/articles/'+artId+'/metadata').set('Authorization',A).send({ status:'published', publishedUrl:'https://example.com/seo' });
check('patch metadata 200',         r9.status === 200);
check('patch returns meta',         !!(r9.body.data||{}).meta);

// 10. Patch current version
var r10 = await request(app).patch('/api/v1/articles/'+artId+'/current-version').set('Authorization',A).send({ version:'v1' });
check('patch current version 200',  r10.status === 200);
check('currentVersion updated',     (r10.body.data||{}).currentVersion === 'v1');

// 11. Invalid patch metadata field
var r11 = await request(app).patch('/api/v1/articles/'+artId+'/metadata').set('Authorization',A).send({ badField:'val' });
check('invalid metadata field 400', r11.status === 400);

log.summary([...Array(pass).fill({ok:true,name:''}), ...Array(fail).fill({ok:false,name:''})]);
log.info('pass', pass); log.info('fail', fail);
process.exit(fail > 0 ? 1 : 0);
