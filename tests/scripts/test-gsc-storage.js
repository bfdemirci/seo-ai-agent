import * as runner  from '../lib/testRunner.js';
import * as log     from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';

runner.run('GSC Storage & Analytics Service Test', async ({keyword}) => {

  // ── Bootstrap: create a fresh article record ───────────────────────────────
  const article      = fixture.load(keyword, 'article');
  const outline      = fixture.load(keyword, 'outline');
  const finalization = fixture.exists(keyword,'finalization') ? fixture.load(keyword,'finalization') : null;

  const { createArticleRecord, getArticleById, updateArticleMetadata } =
    await runner.importAgent('repositories/articleRepository.js');
  const {
    saveGscSnapshots, getGscSnapshots, appendGscSnapshots,
    getLatestGscSnapshot, summarizeGscSnapshots,
  } = await runner.importAgent('repositories/gscSnapshotRepository.js');
  const {
    syncArticleGscData, syncArticleGscDataByUrl,
    getArticleGscSummary, extractPagePath,
  } = await runner.importAgent('services/analytics/gscAnalyticsService.js');

  const articleId = createArticleRecord({ keyword, article, outline, finalization });
  runner.assertNonEmpty('articleId', articleId);
  log.info('articleId', articleId);

  // ── Mock GSC rows ──────────────────────────────────────────────────────────
  const mockBatch1 = [
    { date: '2026-03-01', page: '/seo-nedir', query: 'seo nedir',      clicks: 80,  impressions: 2000, ctr: 0.04,  position: 7.2,  source: 'gsc' },
    { date: '2026-03-02', page: '/seo-nedir', query: 'seo nedir ne',   clicks: 20,  impressions: 800,  ctr: 0.025, position: 9.1,  source: 'gsc' },
    { date: '2026-03-03', page: '/seo-nedir', query: 'seo nedir',      clicks: 95,  impressions: 2200, ctr: 0.043, position: 6.8,  source: 'gsc' },
  ];
  const mockBatch2 = [
    // duplicate — should be skipped
    { date: '2026-03-01', page: '/seo-nedir', query: 'seo nedir',      clicks: 80,  impressions: 2000, ctr: 0.04,  position: 7.2,  source: 'gsc' },
    // new row
    { date: '2026-03-04', page: '/seo-nedir', query: 'seo nedir',      clicks: 110, impressions: 2500, ctr: 0.044, position: 6.1,  source: 'gsc' },
  ];

  // ── 1. saveGscSnapshots ────────────────────────────────────────────────────
  log.section('1. saveGscSnapshots');
  saveGscSnapshots(articleId, mockBatch1);
  const saved = getGscSnapshots(articleId);
  runner.assert('snapshots file created',  saved.length > 0);
  runner.assert('correct row count after save', saved.length === 3, 'got: ' + saved.length);
  runner.assert('sorted by date', saved[0].date <= saved[saved.length-1].date);
  log.info('rows saved', saved.length);

  // ── 2. dedupe on appendGscSnapshots ───────────────────────────────────────
  log.section('2. dedupe identical rows');
  const { added, total } = appendGscSnapshots(articleId, mockBatch2);
  runner.assert('only 1 new row added',    added === 1, 'added: ' + added);
  runner.assert('total is 4 after append', total === 4, 'total: ' + total);
  log.info('added', added);
  log.info('total', total);

  // ── 3. getLatestGscSnapshot ────────────────────────────────────────────────
  log.section('3. getLatestGscSnapshot');
  const latest = getLatestGscSnapshot(articleId);
  runner.assert('latest snapshot exists', latest !== null);
  runner.assert('latest date is 2026-03-04', latest?.date === '2026-03-04', 'got: ' + latest?.date);
  log.info('latest date', latest?.date);
  log.info('latest clicks', latest?.clicks);

  // ── 4. summarizeGscSnapshots ───────────────────────────────────────────────
  log.section('4. summarizeGscSnapshots');
  const summary = summarizeGscSnapshots(articleId);
  runner.assert('totalRows is 4',        summary.totalRows === 4,   'got: ' + summary.totalRows);
  runner.assert('totalClicks correct',   summary.totalClicks === 305, 'got: ' + summary.totalClicks);
  runner.assert('avgPosition present',   summary.avgPosition > 0);
  runner.assert('latestDate correct',    summary.latestDate === '2026-03-04');
  runner.assert('avgCtr present',        summary.avgCtr > 0);
  log.info('totalClicks',    summary.totalClicks);
  log.info('avgPosition',    summary.avgPosition);
  log.info('avgCtr',         summary.avgCtr);
  log.info('latestDate',     summary.latestDate);

  // ── 5. syncArticleGscData (mocked fetcher) ────────────────────────────────
  log.section('5. syncArticleGscData with mock fetcher');
  const mockFetcher = async () => ({
    rows: [
      { keys: ['2026-03-10', '/seo-nedir', 'seo nedir'], clicks: 130, impressions: 3000, ctr: 0.043, position: 5.5 },
      { keys: ['2026-03-11', '/seo-nedir', 'seo ne demek'], clicks: 40, impressions: 900, ctr: 0.044, position: 8.0 },
    ],
  });

  const syncResult = await syncArticleGscData({
    articleId,
    siteUrl:    'https://example.com',
    page:       '/seo-nedir',
    startDate:  '2026-03-10',
    endDate:    '2026-03-11',
    fetcher:    mockFetcher,
  });
  runner.assert('rowsFetched is 2',  syncResult.rowsFetched === 2, 'got: ' + syncResult.rowsFetched);
  runner.assert('rowsAdded is 2',    syncResult.rowsAdded   === 2, 'got: ' + syncResult.rowsAdded);
  log.info('rowsFetched', syncResult.rowsFetched);
  log.info('rowsAdded',   syncResult.rowsAdded);
  log.info('total',       syncResult.total);

  // ── 6. metadata updated ────────────────────────────────────────────────────
  log.section('6. article metadata updated');
  const rec = getArticleById(articleId);
  runner.assert('lastGscSyncAt set',  !!rec?.meta?.lastGscSyncAt);
  runner.assert('snapshotCount > 0',  (rec?.meta?.snapshotCount ?? 0) > 0, 'got: ' + rec?.meta?.snapshotCount);
  log.info('lastGscSyncAt',  rec.meta.lastGscSyncAt);
  log.info('snapshotCount',  rec.meta.snapshotCount);

  // ── 7. gsc_sync event appended ─────────────────────────────────────────────
  log.section('7. gsc_sync event appended');
  const events   = rec?.meta?.events ?? [];
  const syncEvt  = events.find(e => e.type === 'gsc_sync');
  runner.assert('gsc_sync event exists',     !!syncEvt);
  runner.assert('event has rowsFetched',     syncEvt?.rowsFetched === 2);
  runner.assert('event has timestamp',       !!syncEvt?.timestamp);
  log.info('event type',     syncEvt?.type);
  log.info('event date',     syncEvt?.startDate);

  // ── 8. initialPosition set once ───────────────────────────────────────────
  log.section('8. initialPosition set once and not overwritten');
  const firstPos = rec?.meta?.initialPosition;
  runner.assert('initialPosition populated', firstPos !== null && firstPos !== undefined, 'got: ' + firstPos);
  log.info('initialPosition', firstPos);

  // sync again — initialPosition should not change
  await syncArticleGscData({
    articleId,
    siteUrl:   'https://example.com',
    page:      '/seo-nedir',
    startDate: '2026-03-12',
    endDate:   '2026-03-12',
    fetcher:   async () => ({
      rows: [{ keys: ['2026-03-12', '/seo-nedir', 'seo nedir'], clicks: 200, impressions: 4000, ctr: 0.05, position: 2.0 }],
    }),
  });
  const rec2    = getArticleById(articleId);
  const newPos  = rec2?.meta?.initialPosition;
  runner.assert('initialPosition unchanged after re-sync', newPos === firstPos, `was ${firstPos}, now ${newPos}`);
  log.info('initialPosition after re-sync', newPos);

  // ── 9. getArticleGscSummary ───────────────────────────────────────────────
  log.section('9. getArticleGscSummary');
  const fullSummary = getArticleGscSummary(articleId);
  runner.assert('summary totalRows > 0',      fullSummary.totalRows > 0);
  runner.assert('summary totalClicks > 0',    fullSummary.totalClicks > 0);
  runner.assert('summary totalImpressions > 0', fullSummary.totalImpressions > 0);
  runner.assert('summary avgCtr present',     fullSummary.avgCtr >= 0);
  runner.assert('summary avgPosition present', fullSummary.avgPosition > 0);
  runner.assert('summary latestDate present', !!fullSummary.latestDate);
  log.info('summary.totalRows',        fullSummary.totalRows);
  log.info('summary.totalClicks',      fullSummary.totalClicks);
  log.info('summary.totalImpressions', fullSummary.totalImpressions);
  log.info('summary.avgCtr',           fullSummary.avgCtr);
  log.info('summary.avgPosition',      fullSummary.avgPosition);
  log.info('summary.latestDate',       fullSummary.latestDate);

  // ── 10. syncArticleGscDataByUrl ────────────────────────────────────────────
  log.section('10. extractPagePath + syncArticleGscDataByUrl');
  runner.assert('extractPagePath /seo-nedir',   extractPagePath('https://example.com/seo-nedir') === '/seo-nedir');
  runner.assert('extractPagePath root /',        extractPagePath('https://example.com/') === '/');
  runner.assert('extractPagePath no trailing',   extractPagePath('https://example.com/path') === '/path');
  runner.assert('extractPagePath already path',  extractPagePath('/my-page') === '/my-page');

  const byUrlResult = await syncArticleGscDataByUrl({
    articleId,
    siteUrl:      'https://example.com',
    publishedUrl: 'https://example.com/seo-nedir',
    startDate:    '2026-03-13',
    endDate:      '2026-03-13',
    fetcher: async () => ({
      rows: [{ keys: ['2026-03-13', '/seo-nedir', 'seo nedir'], clicks: 55, impressions: 1100, ctr: 0.05, position: 5.0 }],
    }),
  });
  runner.assert('byUrl rowsFetched 1', byUrlResult.rowsFetched === 1);
  log.info('byUrl rowsFetched', byUrlResult.rowsFetched);
});
