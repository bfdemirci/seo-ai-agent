import * as runner from '../lib/testRunner.js';
import * as log from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

runner.run('Storage Layer Test', async ({keyword}) => {

  // ── Load fixtures ──────────────────────────────────────────────────────────
  const article = fixture.exists(keyword,'repaired')  ? fixture.load(keyword,'repaired')
                : fixture.exists(keyword,'optimized') ? fixture.load(keyword,'optimized')
                : fixture.load(keyword,'article');
  const outline      = fixture.load(keyword, 'outline');
  const research     = fixture.load(keyword, 'research');
  const scoreV1      = fixture.load(keyword, 'score');
  const scoreV2      = fixture.exists(keyword,'scoreV2')     ? fixture.load(keyword,'scoreV2')     : null;
  const scoreV3      = fixture.exists(keyword,'scoreV3')     ? fixture.load(keyword,'scoreV3')     : null;
  const decision     = fixture.exists(keyword,'decision')    ? fixture.load(keyword,'decision')    : null;
  const finalization = fixture.exists(keyword,'finalization') ? fixture.load(keyword,'finalization') : null;

  runner.assertNonEmpty('fixtures loaded', article);
  log.info('article chars', article.length);
  log.info('finalization', finalization ? 'yes' : 'none');

  // ── Import repo ────────────────────────────────────────────────────────────
  const {
    createArticleRecord, saveArticleVersion, getArticleById,
    getArticleByKeyword, listArticles, updateCurrentVersion,
    updateArticleMetadata, appendArticleEvent,
  } = await runner.importAgent('repositories/articleRepository.js');

  const evaluation = { scoreV1, scoreV2, scoreV3, decision, improved: !!scoreV2 };

  // ── 1. createArticleRecord ─────────────────────────────────────────────────
  log.section('1. createArticleRecord');
  let articleId;
  try {
    articleId = createArticleRecord({ keyword, article, outline, research, evaluation, finalization });
  } catch(err) { runner.assert('createArticleRecord no error', false, err.message); return; }

  runner.assertNonEmpty('articleId returned', articleId);
  runner.assert('id starts with art_', articleId.startsWith('art_'));
  log.info('articleId', articleId);

  // ── 2. version file written ────────────────────────────────────────────────
  log.section('2. File structure');
  const storageRoot = path.resolve(__dirname, '..', '..', 'storage', 'articles', articleId);
  runner.assert('article.json exists',     fs.existsSync(path.join(storageRoot, 'article.json')));
  runner.assert('versions/v1.json exists', fs.existsSync(path.join(storageRoot, 'versions', 'v1.json')));
  log.info('path', 'storage/articles/' + articleId);

  // ── 3. getArticleById ──────────────────────────────────────────────────────
  log.section('3. getArticleById');
  const rec = getArticleById(articleId);
  runner.assert('record found',              rec !== null);
  runner.assert('id matches',                rec?.meta?.id === articleId);
  runner.assert('keyword matches',           rec?.meta?.keyword === keyword);
  runner.assert('currentVersion is v1',      rec?.meta?.currentVersion === 'v1');
  runner.assert('status is finalized',       rec?.meta?.status === 'finalized');
  runner.assert('createdAt present',         !!rec?.meta?.createdAt);
  runner.assert('events is array',           Array.isArray(rec?.meta?.events));
  runner.assert('gscSnapshots is array',     Array.isArray(rec?.meta?.gscSnapshots));
  runner.assert('publishHistory is array',   Array.isArray(rec?.meta?.publishHistory));
  runner.assert('publishedUrl is null',      rec?.meta?.publishedUrl === null);
  runner.assertNonEmpty('currentArticle',    rec?.currentArticle);
  log.info('status',         rec.meta.status);
  log.info('currentVersion', rec.meta.currentVersion);
  log.info('overallScore',   rec.meta.latestEvaluation?.scoreV1?.overallScore ?? 'n/a');

  // ── 4. finalization preserved ──────────────────────────────────────────────
  log.section('4. finalization preserved');
  if (finalization) {
    runner.assert('metaTitle preserved',       rec?.meta?.finalization?.metaTitle       === finalization.metaTitle);
    runner.assert('metaDescription preserved', rec?.meta?.finalization?.metaDescription === finalization.metaDescription);
    runner.assert('slugSuggestion preserved',  rec?.meta?.finalization?.slugSuggestion  === finalization.slugSuggestion);
    log.info('slug', rec.meta.finalization.slugSuggestion);
  } else {
    runner.assert('finalization null (no fixture)', rec?.meta?.finalization === null, 'skipped');
  }

  // ── 5. latestEvaluation preserved ─────────────────────────────────────────
  log.section('5. latestEvaluation preserved');
  runner.assert('latestEvaluation present',     !!rec?.meta?.latestEvaluation);
  runner.assert('scoreV1 present',              !!rec?.meta?.latestEvaluation?.scoreV1);
  log.info('scoreV1.overallScore', rec.meta.latestEvaluation.scoreV1?.overallScore ?? 'n/a');

  // ── 6. saveArticleVersion ─────────────────────────────────────────────────
  log.section('6. saveArticleVersion');
  const articleV2 = article + '\n\n<!-- v2 marker -->';
  let v2;
  try {
    v2 = saveArticleVersion(articleId, { article: articleV2, outline, research, evaluation, finalization, label: 'humanized' });
  } catch(err) { runner.assert('saveArticleVersion no error', false, err.message); return; }

  runner.assert('v2 returned',               v2 === 'v2', 'got: ' + v2);
  runner.assert('versions/v2.json exists',   fs.existsSync(path.join(storageRoot, 'versions', 'v2.json')));

  const recV2 = getArticleById(articleId);
  runner.assert('currentVersion updated to v2', recV2?.meta?.currentVersion === 'v2');
  runner.assert('v2 article has marker',        recV2?.currentArticle?.includes('v2 marker'));
  log.info('currentVersion after save', recV2.meta.currentVersion);

  // ── 7. getArticleByKeyword ────────────────────────────────────────────────
  log.section('7. getArticleByKeyword');
  const byKw = getArticleByKeyword(keyword);
  runner.assert('found by keyword',    byKw !== null);
  runner.assert('keyword matches',     byKw?.meta?.keyword === keyword);
  log.info('found', byKw?.meta?.id);

  // ── 8. updateCurrentVersion ───────────────────────────────────────────────
  log.section('8. updateCurrentVersion');
  updateCurrentVersion(articleId, 'v1');
  const recRolled = getArticleById(articleId);
  runner.assert('rolled back to v1', recRolled?.meta?.currentVersion === 'v1');
  log.info('after rollback', recRolled.meta.currentVersion);

  // ── 9. updateArticleMetadata ──────────────────────────────────────────────
  log.section('9. updateArticleMetadata');
  updateArticleMetadata(articleId, { status: 'published', publishedUrl: 'https://example.com/seo-nedir' });
  const recMeta = getArticleById(articleId);
  runner.assert('status updated',       recMeta?.meta?.status === 'published');
  runner.assert('publishedUrl updated', recMeta?.meta?.publishedUrl === 'https://example.com/seo-nedir');
  log.info('status',       recMeta.meta.status);
  log.info('publishedUrl', recMeta.meta.publishedUrl);

  // ── 10. appendArticleEvent ────────────────────────────────────────────────
  log.section('10. appendArticleEvent');
  appendArticleEvent(articleId, { type: 'published', url: 'https://example.com/seo-nedir' });
  appendArticleEvent(articleId, { type: 'reindex_requested' });
  const recEvents = getArticleById(articleId);
  runner.assert('2 events appended',         recEvents?.meta?.events?.length === 2);
  runner.assert('event has type',            recEvents?.meta?.events[0]?.type === 'published');
  runner.assert('event has timestamp',       !!recEvents?.meta?.events[0]?.timestamp);
  log.info('events count', recEvents.meta.events.length);

  // ── 11. listArticles ──────────────────────────────────────────────────────
  log.section('11. listArticles');
  const list = listArticles({ limit: 10 });
  runner.assert('list is array',    Array.isArray(list));
  runner.assert('list has record',  list.some(m => m.id === articleId));
  log.info('total in storage', list.length);
});

process.exit(0);
