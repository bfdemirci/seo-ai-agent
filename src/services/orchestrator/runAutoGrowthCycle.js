import { listArticles, getArticleById, appendArticleEvent } from '../../repositories/articleRepository.js';
import { getGscSnapshots, summarizeGscSnapshots } from '../../repositories/gscSnapshotRepository.js';
import { detectDecay } from '../decision/decayDetector.js';
import { publishArticle } from '../publisher/publisherService.js';
import { updateArticleTracking } from '../tracking/articleTrackingService.js';
import { runAutoOptimizationForArticle } from '../maintenance/autoOptimizationService.js';

function generateRunId() {
  return 'run_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function getRecommendedHint(decayStatus) {
  if (decayStatus === 'decaying') return 'refresh_content';
  if (decayStatus === 'watch') return 'monitor';
  return 'no_action';
}

function buildItemSummary(decayStatus) {
  if (decayStatus === 'decaying') return 'Content is decaying — refresh recommended';
  if (decayStatus === 'watch') return 'Performance declining — monitor closely';
  return 'Content is healthy';
}

export async function runAutoGrowthCycle(opts) {
  var mode = (opts && opts.mode) || 'dry_run';
  var keyword = (opts && opts.keyword) || null;
  var articleId = (opts && opts.articleId) || null;
  var limit = (opts && opts.limit) || 50;

  var runId = generateRunId();
  var startedAt = new Date().toISOString();
  var targets = [];

  if (articleId) {
    var single = getArticleById(articleId);
    if (single) targets = [single];
  } else if (keyword) {
    targets = listArticles().filter(function(a) { return a.keyword === keyword; });
  } else {
    targets = listArticles().slice(0, limit);
  }

  var summary = { totalTargets: targets.length, healthy: 0, watch: 0, decaying: 0 };
  var items = [];

  for (var i = 0; i < targets.length; i++) {
    var article = targets[i];
    var artId = article.id;
    var snapshots = [];
    try { snapshots = getGscSnapshots(artId) || []; } catch (e) { snapshots = []; }
    var decayResult = null;
    try { decayResult = detectDecay(artId, snapshots); } catch (e) { decayResult = null; }
    var decayStatus = (decayResult && decayResult.status) || 'healthy';
    var decayTypes = (decayResult && decayResult.decayTypes) || [];
    var recommendedActionHint = getRecommendedHint(decayStatus);
    var gscSummary = null;
    try { gscSummary = summarizeGscSnapshots(artId) || null; } catch (e) { gscSummary = null; }
    if (decayStatus === 'decaying') summary.decaying++;
    else if (decayStatus === 'watch') summary.watch++;
    else summary.healthy++;
    if (mode === 'execute') {
      try {
        appendArticleEvent(artId, {
          type: 'orchestrator_run',
          mode: mode,
          runId: runId,
          decayStatus: decayStatus,
          recommendedActionHint: recommendedActionHint
        });
      } catch (e) {}
    }
    items.push({
      articleId: artId,
      keyword: article.keyword || '',
      status: article.status || 'unknown',
      hasAnalytics: snapshots.length > 0,
      snapshotCount: snapshots.length,
      decayStatus: decayStatus,
      decayTypes: decayTypes,
      recommendedActionHint: recommendedActionHint,
      summary: buildItemSummary(decayStatus),
      gscSummary: gscSummary
    });
  }

  var finishedAt = new Date().toISOString();
  var totals = { totalTargets: summary.totalTargets, healthy: summary.healthy, watch: summary.watch, decaying: summary.decaying };
  return {
    runId: runId,
    mode: mode,
    startedAt: startedAt,
    finishedAt: finishedAt,
    durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    summary: summary,
    totals: totals,
    items: items
  };
}
