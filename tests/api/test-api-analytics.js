import { request, app, getToken, auth } from './_helper.js';
import * as log  from '../lib/logger.js';
import * as fix  from '../lib/fixtureManager.js';
import { createArticleRecord } from '../../src/repositories/articleRepository.js';
import { saveGscSnapshots } from '../../src/repositories/gscSnapshotRepository.js';

log.header('API Analytics Test');
var pass = 0; var fail = 0;
function check(name, ok, detail) { if (ok){log.pass(name,detail);pass++;}else{log.fail(name,detail);fail++;} }

var token  = await getToken();
var A      = auth(token);
var article = fix.load('seo nedir','article');
var outline  = fix.load('seo nedir','outline');
var artId = createArticleRecord({ keyword:'seo nedir', article, outline });

// Seed GSC snapshots
saveGscSnapshots(artId, [
  { date:'2026-03-01', page:'/seo', query:'seo nedir', clicks:80, impressions:2000, ctr:0.04, position:7.0, source:'gsc' },
  { date:'2026-03-02', page:'/seo', query:'seo nedir', clicks:90, impressions:2200, ctr:0.041, position:6.8, source:'gsc' },
]);

// 1. GSC summary
var r1 = await request(app).get('/api/v1/articles/'+artId+'/analytics/gsc').set('Authorization',A);
check('gsc summary 200',         r1.status === 200,        'got: '+r1.status);
check('summary has totalRows',   typeof ((r1.body.data||{}).summary||{}).totalRows === 'number');
check('totalRows is 2',          ((r1.body.data||{}).summary||{}).totalRows === 2, 'got: '+((r1.body.data||{}).summary||{}).totalRows);
check('summary has avgPosition', ((r1.body.data||{}).summary||{}).avgPosition > 0);

// 2. GSC snapshots
var r2 = await request(app).get('/api/v1/articles/'+artId+'/analytics/gsc/snapshots').set('Authorization',A);
check('snapshots 200',           r2.status === 200);
check('items array',             Array.isArray((r2.body.data||{}).items));
check('items length 2',          ((r2.body.data||{}).items||[]).length === 2);

// 3. GSC snapshots with date filter
var r3 = await request(app).get('/api/v1/articles/'+artId+'/analytics/gsc/snapshots?startDate=2026-03-02').set('Authorization',A);
check('date filter 200',         r3.status === 200);
check('date filter 1 row',       ((r3.body.data||{}).items||[]).length === 1);

// 4. Invalid date format
var r4 = await request(app).get('/api/v1/articles/'+artId+'/analytics/gsc/snapshots?startDate=bad').set('Authorization',A);
check('invalid date 400',        r4.status === 400);

// 5. GSC sync (MVP placeholder)
var r5 = await request(app).post('/api/v1/articles/'+artId+'/analytics/gsc/sync').set('Authorization',A);
check('sync 200',                r5.status === 200);
check('sync has rowsFetched',    typeof ((r5.body.data||{}).rowsFetched) === 'number');

// 6. Unknown article
var r6 = await request(app).get('/api/v1/articles/unknown_art/analytics/gsc').set('Authorization',A);
check('unknown article 404',     r6.status === 404);

log.summary([...Array(pass).fill({ok:true,name:''}), ...Array(fail).fill({ok:false,name:''})]);
log.info('pass', pass); log.info('fail', fail);
process.exit(fail > 0 ? 1 : 0);
