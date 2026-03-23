import { listSites } from '../../repositories/siteRepository.js';
import { canGenerateForSite, recordSiteGeneration } from '../../repositories/siteQuotaRepository.js';
import { getRuntimeConfig } from '../../config/runtimeConfig.js';

import { runCampaign } from '../programmatic/campaignEngine.js';
import { SITES } from '../../config/sites.js';
import { saveRunHistory } from '../../repositories/runHistoryRepository.js';
import { syncAllArticlesGscMemory } from '../gsc/gscMemoryService.js';
import { syncAllArticlesGSC } from '../gsc/gscSyncService.js';
import { getGscSnapshots } from '../../repositories/gscSnapshotRepository.js';
import { decideAction }   from '../../engine/decisionEngine.js';
import { executeDecision } from '../../engine/actionExecutor.js';
import { listArticles } from '../../repositories/articleRepository.js';
import { runAutoOptimizationForArticle } from '../maintenance/autoOptimizationService.js';
import { shouldPublishArticle } from '../publisher/publishDecisionService.js';
import { publishArticle } from '../publisher/publisherService.js';
import { getArticleById } from '../../repositories/articleRepository.js';

var _schedulerTimer = null;
var _running        = false;
var _lockStartedAt  = null;
var _lastStartedAt  = null;
var _lastFinishedAt = null;
var _lastDurationMs = null;
var _lastError      = null;
var STALE_LOCK_MS   = 2 * 60 * 60 * 1000; // 2 hours

export function getSchedulerState() {
  return {
    enabled:        getRuntimeConfig().schedulerEnabled,
    running:        _running,
    lastStartedAt:  _lastStartedAt,
    lastFinishedAt: _lastFinishedAt,
    lastDurationMs: _lastDurationMs,
    lastError:      _lastError,
  };
}

async function runSchedulerCycle() {
  // Stale lock recovery
  if (_running && _lockStartedAt && (Date.now() - new Date(_lockStartedAt).getTime()) > STALE_LOCK_MS) {
    console.warn('[SCHEDULER] stale lock detected — resetting');
    _running = false;
    _lockStartedAt = null;
  }
  if (_running) {
    console.log('[SCHEDULER] cycle_already_running — skip');
    return { ok: true, skipped: true, reason: 'cycle_already_running' };
  }
  _running = true;
  _lockStartedAt = new Date().toISOString();
  _lastStartedAt = _lockStartedAt;
  _lastError = null;
  var _cycleStartedAt = _lockStartedAt;
  var articles = [];
  try {
    articles = listArticles();
    console.log('[SCHEDULER] started — total articles:', articles.length);

    // GSC sync gate
    var _rc = getRuntimeConfig();
    if (_rc.gscSyncEnabled) {
      try {
        await syncAllArticlesGSC();
        console.log('[SCHEDULER] GSC sync done');
      } catch (gscErr) {
        console.error('[SCHEDULER] GSC sync error:', gscErr && gscErr.message);
      }
    } else {
      console.log('[SCHEDULER] GSC sync disabled by config');
    }
  } catch (err) {
    console.error('[SCHEDULER] failed to list articles:', err.message || err);
    _running = false;
    return;
  }

  for (var i = 0; i < articles.length; i++) {
    var a = articles[i];
    var articleId = a.id || (a.meta && a.meta.id) || null;
    if (!articleId) continue;

    try {
      // A. Auto-optimize
      var optResult = await runAutoOptimizationForArticle(articleId, { safeMode: false });
      console.log('[SCHEDULER]', articleId, 'optimize:', optResult && optResult.action ? optResult.action : 'done');
    } catch (err) {
      console.error('[SCHEDULER]', articleId, 'optimize error:', (err && err.message) || err);
    }

    try {
      // B. Publish decision — with position guard
      var record = getArticleById(articleId);
      if (!record) continue;

      // Position guard: skip if GSC data shows weak position
      var _posBlocked = false;
      var _posReason = null;
      try {
        var _pubSnaps = getGscSnapshots(articleId);
        if (_pubSnaps && _pubSnaps.length > 0) {
          var _lastSnap = _pubSnaps[_pubSnaps.length - 1];
          if (_lastSnap && _lastSnap.position && _lastSnap.position > 20) {
            _posBlocked = true;
            _posReason = 'position_guard_blocked (pos=' + _lastSnap.position + ')';
          }
        }
      } catch (_) {}

      if (_posBlocked) {
        console.log('[SCHEDULER]', articleId, 'publish skipped:', _posReason);
        publishSummary.skippedByPositionGuard = (publishSummary.skippedByPositionGuard || 0) + 1;
        publishSummary.skipped++;
        publishSummary.total++;
      } else {
        var _rcPub = getRuntimeConfig();
        var pubDecision = _rcPub.publishEnabled
          ? shouldPublishArticle(record)
          : { shouldPublish: false, reason: 'publish_disabled_by_config' };
        if (pubDecision && pubDecision.shouldPublish) {
          publishSummary.total++;
          var pubResult = await publishArticle(articleId);
          if (pubResult && pubResult.ok) {
            publishSummary.success++;
            console.log('[SCHEDULER] PUBLISHED', articleId, 'postId:', pubResult.wordpressPostId);
          } else if (pubResult && pubResult.skipped) {
            publishSummary.skipped++;
            console.log('[SCHEDULER]', articleId, 'publish skipped:', pubResult.reason);
          } else {
            publishSummary.failed++;
            console.error('[SCHEDULER]', articleId, 'publish failed:', pubResult && pubResult.error);
          }
        }
      }
    } catch (err) {
      console.error('[SCHEDULER]', articleId, 'publish error:', (err && err.message) || err);
    }
  }

  // Programmatic queue processing
  try {
    var { processQueue } = await import('../programmatic/programmaticEngine.js');
    var pqResult = await processQueue();
    if (pqResult && !pqResult.skipped) {
      console.log('[SCHEDULER] programmatic queue processed:', pqResult.processed || 0);
    }
  } catch (pqErr) {
    console.error('[SCHEDULER] programmatic queue error:', pqErr && pqErr.message);
  }

  // Programmatic queue processing
  try {
    var { processQueue } = await import('../programmatic/programmaticEngine.js');
    var pqResult = await processQueue();
    if (pqResult && !pqResult.skipped) {
      console.log('[SCHEDULER] programmatic queue processed:', pqResult.processed || 0);
    }
  } catch (pqErr) {
    console.error('[SCHEDULER] programmatic queue error:', pqErr && pqErr.message);
  }

  console.log('[SCHEDULER] cycle complete');
  try {
    var _cycleFinishedAt = new Date().toISOString();
    saveRunHistory({
      runId: 'run_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
      type: 'scheduler_cycle',
      startedAt: _cycleStartedAt || _cycleFinishedAt,
      finishedAt: _cycleFinishedAt,
      durationMs: _cycleStartedAt ? Date.now() - new Date(_cycleStartedAt).getTime() : 0,
      summary: {
        gsc:       { total: 0, success: 0, skipped: 0, failed: 0 },
        decisions: { total: 0, noAction: 0, optimize: 0, refresh: 0, rewrite: 0, delete: 0, kill: 0, failed: 0 },
        execution: { total: 0, executed: 0, skipped: 0, failed: 0 },
        publish:   { total: 0, success: 0, skipped: 0, failed: 0, skippedByPositionGuard: 0 }
      },
      error: null
    });
  } catch (_rh) {}
  _running = false;
  _lockStartedAt = null;
}

export function startScheduler() {
  var intervalMs = parseInt(process.env.SCHEDULER_INTERVAL_MS || '600000', 10);
  console.log('[SCHEDULER] initializing — interval:', intervalMs + 'ms');
  if (_schedulerTimer) {
    clearInterval(_schedulerTimer);
  }
  _schedulerTimer = setInterval(function() {
    runSchedulerCycle().catch(function(err) {
      console.error('[SCHEDULER] unhandled cycle error:', err && err.message);
      _running = false;
    });
  }, intervalMs);
  return _schedulerTimer;
}

export function stopScheduler() {
  if (_schedulerTimer) {
    clearInterval(_schedulerTimer);
    _schedulerTimer = null;
    _running = false;
    console.log('[SCHEDULER] stopped');
  }
}

export { runSchedulerCycle };


// ── Decision-driven execution cycle ──────────────────────────────────────────
export async function runDecisionCycle(articles, { optimizeFn } = {}) {
  const results = [];
  if (!articles || !Array.isArray(articles)) return results;
  for (const art of articles) {
    const articleId = art.id || art.meta?.id;
    if (!articleId) continue;
    try {
      // enrich article with stored GSC snapshots for decision engine
      const articleId0 = art.id || art.meta?.id;
      if (articleId0) {
        const snaps = getGscSnapshots(articleId0);
        art = Object.assign({}, art, { gsc_snapshots: snaps });
      }
      const decision = decideAction(art);
      const exec     = await executeDecision(articleId, decision, { optimizeFn });
      results.push({ articleId, ...exec });
      if (!exec.skipped) {
        console.log(`[DECISION] ${articleId} → ${decision.action} | ${exec.ok ? 'OK' : 'FAIL'} | ${decision.reason}`);
      }
    } catch (err) {
      results.push({ articleId, ok: false, error: err?.message });
    }
  }
  return results;
}

export async function runGscMemoryCycle() {
  try {
    const result = await syncAllArticlesGscMemory();
    console.log('[GSC_MEMORY] cycle done — total:', result.total, 'success:', result.success, 'skipped:', result.skipped, 'failed:', result.failed);
    return result;
  } catch (err) {
    console.error('[GSC_MEMORY] cycle error:', err?.message);
    return { ok: false, total: 0, success: 0, skipped: 0, failed: 0, items: [] };
  }
}

export async function runCampaignCycle() {
  var results = [];
  for (var i = 0; i < SITES.length; i++) {
    var site = SITES[i];
    try {
      var cfg = Object.assign({ siteId: site.siteId }, site.campaignDefaults || {});
      if (!cfg.baseKeyword) { results.push({ siteId: site.siteId, skipped: true, reason: 'no baseKeyword' }); continue; }
      console.log('[CAMPAIGN] starting site:', site.siteId, 'limit:', cfg.limit);
      var r = await runCampaign(cfg);
      console.log('[CAMPAIGN] site:', site.siteId, '— created:', r.created, 'published:', r.published, 'failed:', r.failed);
      results.push(Object.assign({ siteId: site.siteId }, r));
    } catch (err) {
      console.error('[CAMPAIGN] site:', site.siteId, 'error:', err && err.message);
      results.push({ siteId: site.siteId, ok: false, error: err && err.message });
    }
  }
  return results;
}

export async function runMultiSiteCycle() {
  var startedAt = new Date().toISOString();
  var results = [];
  var totalSites = 0, processedSites = 0, failedSites = 0;

  try {
    var sites = listSites({ includeDisabled: false });
    totalSites = sites.length;
    console.log('[MULTI_SITE] cycle start — sites:', totalSites);

    for (var i = 0; i < sites.length; i++) {
      var site = sites[i];
      var siteId = site.siteId;
      var siteSummary = { gsc: null, decisions: null, campaigns: null, published: 0 };

      try {
        // 1. GSC memory
        if (site.gscEnabled !== false) {
          try {
            var { syncAllArticlesGscMemory } = await import('../gsc/gscMemoryService.js');
            await syncAllArticlesGscMemory();
          } catch (_) {}
        }

        // 2. Decisions (existing articles for this site)
        try {
          var siteArticles = listArticles({ limit: 999999 }).filter(function(a){ return (a.siteId === siteId || (a.meta && a.meta.siteId === siteId)); });
          if (siteArticles.length) {
            var decResults = await runDecisionCycle(siteArticles, {
            optimizeFn: async function(aid) { return runAutoOptimizationForArticle(aid, { safeMode: false }); }
          });
            siteSummary.decisions = decResults.length;
          }
        } catch (_) {}

        // 3. Campaign if enabled
        if (site.campaignEnabled !== false) {
          try {
            var quotaCheck = canGenerateForSite(siteId, { requestedCount: 1 });
            if (quotaCheck.allowed) {
              var { runCampaign } = await import('../programmatic/campaignEngine.js');
              var siteConfig = Object.assign({}, (site.campaignDefaults || {}), {
                siteId: siteId,
                safeMode: site.safeMode !== false,
                limit: Math.min(site.dailyArticleLimit || 5, 5),
                throttleMs: 500,
              });
              if (siteConfig.baseKeyword) {
                var campResult = await runCampaign(siteConfig);
                if (campResult.created) recordSiteGeneration(siteId, campResult.created);
                siteSummary.campaigns = campResult;
              }
            }
          } catch (_) {}
        }

        processedSites++;
        results.push({ siteId, ok: true, summary: siteSummary, error: null });
        console.log('[MULTI_SITE] site done:', siteId);
      } catch (siteErr) {
        failedSites++;
        results.push({ siteId, ok: false, summary: null, error: siteErr && siteErr.message });
        console.error('[MULTI_SITE] site error:', siteId, siteErr && siteErr.message);
      }
    }
  } catch (outerErr) {
    console.error('[MULTI_SITE] outer error:', outerErr && outerErr.message);
  }

  var finishedAt = new Date().toISOString();
  console.log('[MULTI_SITE] cycle done — processed:', processedSites, 'failed:', failedSites);

  try {
    saveRunHistory({
      runId: 'multi_site_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: 'multi_site_cycle',
      startedAt, finishedAt,
      durationMs: new Date(finishedAt) - new Date(startedAt),
      summary: { totalSites, processedSites, failedSites, items: results.map(function(r){ return { siteId: r.siteId, ok: r.ok }; }) },
      error: null
    });
  } catch (_) {}

  return { ok: true, totalSites, processedSites, failedSites, items: results };
}
