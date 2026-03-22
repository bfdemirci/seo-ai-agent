import { makeReport, finishReport } from '../../utils/runReport.js';
import { listArticles } from '../../repositories/articleRepository.js';
import { getGscSnapshots } from '../../repositories/gscSnapshotRepository.js';
import { detectDecay } from '../../services/decision/decayDetector.js';
import { runLifecycleDecision } from '../../services/decision/lifecycleDecisionEngine.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function normKw(kw) { return (kw || '').toLowerCase().trim(); }

function dedupe(arr) {
  var seen = {};
  return arr.filter(function(kw) {
    var k = normKw(kw);
    if (!k || seen[k]) return false;
    seen[k] = true;
    return true;
  });
}

function mapDecayStatus(decay) {
  if (!decay) return 'unknown';
  return decay.status || 'unknown';
}

function lifecycleHint(lifecycle) {
  if (!lifecycle) return 'monitor';
  return lifecycle.action || lifecycle.recommendedActionHint || 'monitor';
}

function maintenanceRecommendation(decayStatus, lifecycle) {
  var lhint = lifecycleHint(lifecycle);
  if (lhint === 'refresh' || lhint === 'refresh_candidate') return 'refresh_candidate';
  if (lhint === 'rewrite')                                  return 'rewrite_candidate';
  if (lhint === 'meta_only' || lhint === 'meta_candidate') return 'meta_candidate';
  if (lhint === 'offpage_review')                          return 'offpage_candidate';
  if (decayStatus === 'decaying')                          return 'refresh_candidate';
  if (decayStatus === 'watch')                             return 'monitor';
  return 'ignore';
}

// ── Opportunity scan ──────────────────────────────────────────────────────────

async function runOpportunityScan(opts, report) {
  var rawKws = opts.keywords || [];
  if (typeof rawKws === 'string') rawKws = rawKws.split(',');
  var kws = dedupe(rawKws.map(normKw).filter(Boolean));

  report.summary.totalKeywordsInput = kws.length;

  // Build set of existing article keywords
  var existingArticles;
  try { existingArticles = listArticles({ limit: 500 }); }
  catch (_) { existingArticles = []; }

  var existingKwSet = {};
  existingArticles.forEach(function(m) {
    if (m.keyword) existingKwSet[normKw(m.keyword)] = m.id;
  });

  report.summary.totalExistingArticles = existingArticles.length;

  var candidates = kws.map(function(kw) {
    var exists = !!existingKwSet[kw];
    return {
      keyword:           kw,
      reason:            exists ? 'article already exists for this keyword' : 'no existing article found',
      source:            'input',
      existsAlready:     exists,
      recommendedAction: exists ? 'skip' : 'generate',
    };
  });

  report.candidates = candidates;
  report.summary.totalCandidates     = candidates.filter(function(c){return c.recommendedAction==='generate';}).length;
  report.summary.totalRecommendations += report.summary.totalCandidates;
}

// ── Article maintenance ───────────────────────────────────────────────────────

async function runArticleMaintenance(opts, report) {
  var articles;
  try { articles = listArticles({ limit: 500 }); }
  catch (_) { articles = []; }

  report.summary.totalExistingArticles = articles.length;
  report.summary.totalArticlesChecked  = 0;

  var maintenance = [];

  for (var i = 0; i < articles.length; i++) {
    var meta = articles[i];
    var articleId = meta.id;
    if (!articleId) continue;

    report.summary.totalArticlesChecked++;

    // GSC snapshots → decay detection
    var snapshots = [];
    try { snapshots = getGscSnapshots(articleId); } catch (_) {}

    var decay = null;
    try { decay = detectDecay(articleId, snapshots); } catch (_) {}

    var decayStatus = mapDecayStatus(decay);

    // Lifecycle decision
    var lifecycle = null;
    if (decay) {
      try {
        lifecycle = runLifecycleDecision({
          articleId,
          articleMeta: meta,
          decayReport:  decay,
        });
      } catch (_) {}
    }

    var recommendation = maintenanceRecommendation(decayStatus, lifecycle);

    // Counters
    if (decayStatus === 'decaying') report.summary.totalDecaying++;
    else if (decayStatus === 'watch') report.summary.totalWatch++;
    else report.summary.totalHealthy++;

    if (recommendation !== 'ignore' && recommendation !== 'monitor') {
      report.summary.totalRecommendations++;
    }

    maintenance.push({
      articleId,
      keyword:           meta.keyword || '',
      status:            decayStatus,
      decay:             decay,
      lifecycle:         lifecycle,
      recommendedAction: recommendation,
    });
  }

  report.maintenance = maintenance;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function runAutoGrowth(opts) {
  opts = opts || {};
  var mode = opts.mode || 'full_cycle';
  var report = makeReport(mode);
  var t0 = Date.now();

  try {
    if (mode === 'opportunity_scan') {
      await runOpportunityScan(opts, report);
    } else if (mode === 'article_maintenance') {
      await runArticleMaintenance(opts, report);
    } else {
      // full_cycle
      await runOpportunityScan(opts, report);
      await runArticleMaintenance(opts, report);
    }
  } catch (err) {
    report.errors.push({ type: 'orchestrator_error', message: err.message });
  }

  return finishReport(report, t0);
}
