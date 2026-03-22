import * as runner  from '../lib/testRunner.js';
import * as log     from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';

const VALID_ACTIONS = ['rewrite','refresh','meta_only','monitor','ignore','internal_link_boost','offpage_review'];
const VALID_MODES   = ['noop','prepare_only','content_update','metadata_update'];

runner.run('Action Executor Test', async ({keyword}) => {

  const { createArticleRecord, getArticleById, saveArticleVersion } = await runner.importAgent('repositories/articleRepository.js');
  const { executeAction } = await runner.importAgent('services/decision/actionExecutor.js');

  const article = fixture.load(keyword, 'article');
  const outline = fixture.load(keyword, 'outline');
  const score   = fixture.load(keyword, 'score');

  // Create a fresh article record for testing
  const articleId = createArticleRecord({
    keyword, article, outline,
    evaluation: { scoreV1: score },
    finalization: { metaTitle: 'Old Title', metaDescription: 'Old desc', slugSuggestion: 'old-slug' },
  });
  runner.assertNonEmpty('articleId', articleId);

  const record = getArticleById(articleId);

  function decision(action, opts) {
    opts = opts || {};
    return {
      articleId,
      action,
      reason: 'test',
      confidence: opts.confidence || 0.8,
      priority: opts.priority || 'medium',
      evidenceSummary: { status: 'watch', decayTypes: {}, clicksDeltaPct: -10, impressionsDeltaPct: -5, ctrDeltaPct: -5, positionDelta: 1.0, contentAgeDays: 60 },
      thresholdsTriggered: { ctr: 'none', clicks: 'none', position: 'low', contentAge: 'fresh' },
    };
  }

  function assertShape(r, label) {
    runner.assert(label + ' has articleId',       !!r.articleId);
    runner.assert(label + ' action valid',        VALID_ACTIONS.includes(r.action), r.action);
    runner.assert(label + ' executionMode valid', VALID_MODES.includes(r.executionMode), r.executionMode);
    runner.assert(label + ' result present',      typeof r.result === 'object');
    runner.assert(label + ' rollback present',    typeof r.rollback === 'object');
    runner.assert(label + ' result.notes array',  Array.isArray(r.result.notes));
    runner.assert(label + ' rollback.applied bool', typeof r.rollback.applied === 'boolean');
  }

  // ── 1. ignore ───────────────────────────────────────────────────────────────
  log.section('1. ignore');
  var r1 = await executeAction({ articleId, decision: decision('ignore'), articleRecord: record });
  assertShape(r1, 'ignore');
  runner.assert('executed true',     r1.executed === true);
  runner.assert('noop mode',         r1.executionMode === 'noop');
  runner.assert('no article change', r1.result.articleChanged === false);
  log.info('executionMode', r1.executionMode);

  // ── 2. monitor ──────────────────────────────────────────────────────────────
  log.section('2. monitor');
  var r2 = await executeAction({ articleId, decision: decision('monitor'), articleRecord: record });
  assertShape(r2, 'monitor');
  runner.assert('executed true',     r2.executed === true);
  runner.assert('noop mode',         r2.executionMode === 'noop');
  log.info('executionMode', r2.executionMode);

  // ── 3. offpage_review ───────────────────────────────────────────────────────
  log.section('3. offpage_review');
  var r3 = await executeAction({ articleId, decision: decision('offpage_review'), articleRecord: record });
  assertShape(r3, 'offpage_review');
  runner.assert('prepare_only mode',      r3.executionMode === 'prepare_only');
  runner.assert('no article change',      r3.result.articleChanged === false);
  log.info('executionMode', r3.executionMode);
  log.info('notes', r3.result.notes[0]);

  // ── 4. rewrite → prepare_only ───────────────────────────────────────────────
  log.section('4. rewrite → prepare_only');
  var r4 = await executeAction({ articleId, decision: decision('rewrite'), articleRecord: record });
  assertShape(r4, 'rewrite');
  runner.assert('prepare_only mode',    r4.executionMode === 'prepare_only');
  runner.assert('executed false',       r4.executed === false);
  runner.assert('no version saved',     r4.result.newVersion === null);
  log.info('executionMode', r4.executionMode);

  // ── 5. meta_only → metadata_update (mocked finalization) ───────────────────
  log.section('5. meta_only with mock finalizationAgent');
  var mockFin = async function() {
    return { metaTitle: 'New SEO Title', metaDescription: 'New description text here.', slugSuggestion: 'new-seo-slug', inputTokens: 10, outputTokens: 20, durationMs: 50, model: 'mock' };
  };
  var r5 = await executeAction({ articleId, decision: decision('meta_only'), articleRecord: record, _injected: { finalizationAgent: mockFin } });
  assertShape(r5, 'meta_only');
  runner.assert('metadata_update mode',     r5.executionMode === 'metadata_update');
  runner.assert('no article body change',   r5.result.articleChanged === false);
  runner.assert('metadata changed',         r5.result.metadataChanged === true);
  log.info('executionMode',    r5.executionMode);
  log.info('metadataChanged',  r5.result.metadataChanged);
  log.info('notes',            r5.result.notes[0]);

  // ── 6. refresh — no patches applied ─────────────────────────────────────────
  log.section('6. refresh — no patches (mock agents return original)');
  var noopAgent = async function(opts) { return { text: opts.article, patches: [], inputTokens: 1, outputTokens: 1, durationMs: 10, model: 'mock' }; };
  var r6 = await executeAction({ articleId, decision: decision('refresh'), articleRecord: record,
    _injected: { factRepairAgent: noopAgent, humanizerAgent: noopAgent } });
  assertShape(r6, 'refresh_noop');
  runner.assert('content_update mode',    r6.executionMode === 'content_update');
  runner.assert('articleChanged false',   r6.result.articleChanged === false);
  runner.assert('no new version',         r6.result.newVersion === null);
  log.info('executionMode',   r6.executionMode);
  log.info('articleChanged',  r6.result.articleChanged);

  // ── 7. refresh — content changed, score acceptable ──────────────────────────
  log.section('7. refresh — content changed, score OK');
  var patchAgent = async function(opts) { return { text: opts.article + ' [refreshed]', patches: [{ find: 'x', replace: 'y' }], inputTokens: 1, outputTokens: 1, durationMs: 10, model: 'mock' }; };
  var goodScore  = async function() { return { overallScore: 88, structureScore: 90, seoScore: 85, readabilityScore: 88, intentScore: 90, usefulnessScore: 82 }; };
  var mockFin2   = async function() { return { metaTitle: 'Refreshed Title', metaDescription: 'Refreshed desc', slugSuggestion: 'refreshed-slug', inputTokens: 1, outputTokens: 1, durationMs: 10, model: 'mock' }; };
  var r7 = await executeAction({ articleId, decision: decision('refresh'), articleRecord: record,
    _injected: { factRepairAgent: patchAgent, humanizerAgent: noopAgent, scoreAgent: goodScore, finalizationAgent: mockFin2 } });
  assertShape(r7, 'refresh_ok');
  runner.assert('content_update mode',  r7.executionMode === 'content_update');
  runner.assert('articleChanged true',  r7.result.articleChanged === true);
  runner.assert('new version saved',    r7.result.newVersion !== null);
  runner.assert('no rollback',          r7.rollback.applied === false);
  log.info('executionMode',  r7.executionMode);
  log.info('newVersion',     r7.result.newVersion);
  log.info('articleChanged', r7.result.articleChanged);

  // ── 8. refresh — rollback guard fires ───────────────────────────────────────
  log.section('8. refresh — rollback guard (score degraded)');
  var badScore = async function() { return { overallScore: 50, structureScore: 40 }; };
  var r8 = await executeAction({ articleId, decision: decision('refresh'), articleRecord: record,
    _injected: { factRepairAgent: patchAgent, humanizerAgent: noopAgent, scoreAgent: badScore } });
  assertShape(r8, 'rollback');
  runner.assert('rollback applied',     r8.rollback.applied === true);
  runner.assert('rollback reason set',  r8.rollback.reason !== null);
  runner.assert('no new version',       r8.result.newVersion === null);
  runner.assert('articleChanged false', r8.result.articleChanged === false);
  log.info('rollback.applied', r8.rollback.applied);
  log.info('rollback.reason',  r8.rollback.reason);

  // ── 9. event logging ─────────────────────────────────────────────────────────
  log.section('9. event logging');
  var recAfter = getArticleById(articleId);
  var events   = recAfter.meta.events || [];
  var execEvts = events.filter(function(e) { return e.type === 'lifecycle_action_executed'; });
  var rbEvts   = events.filter(function(e) { return e.type === 'lifecycle_action_rollback'; });
  runner.assert('lifecycle_action_executed events > 0', execEvts.length > 0, 'count: ' + execEvts.length);
  runner.assert('lifecycle_action_rollback event exists', rbEvts.length > 0, 'count: ' + rbEvts.length);
  runner.assert('exec event has action',    !!execEvts[0].action);
  runner.assert('rollback event has reason', !!rbEvts[0].reason);
  log.info('lifecycle_action_executed count', execEvts.length);
  log.info('lifecycle_action_rollback count', rbEvts.length);

  // ── 10. output contract validation ───────────────────────────────────────────
  log.section('10. output contract validation');
  var r10 = await executeAction({ articleId, decision: decision('monitor'), articleRecord: record });
  runner.assert('articleId string',         typeof r10.articleId === 'string');
  runner.assert('action valid',             VALID_ACTIONS.includes(r10.action));
  runner.assert('executed boolean',         typeof r10.executed === 'boolean');
  runner.assert('executionMode valid',      VALID_MODES.includes(r10.executionMode));
  runner.assert('result.articleChanged',    typeof r10.result.articleChanged === 'boolean');
  runner.assert('result.metadataChanged',   typeof r10.result.metadataChanged === 'boolean');
  runner.assert('result.newVersion null/str', r10.result.newVersion === null || typeof r10.result.newVersion === 'string');
  runner.assert('result.notes array',       Array.isArray(r10.result.notes));
  runner.assert('rollback.applied boolean', typeof r10.rollback.applied === 'boolean');
  runner.assert('rollback.reason null/str', r10.rollback.reason === null || typeof r10.rollback.reason === 'string');
  log.info('contract OK', 'all fields valid');
});
