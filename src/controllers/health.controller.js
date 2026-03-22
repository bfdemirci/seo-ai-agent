import { ok } from '../services/api/responseBuilder.js';
export function getHealth(req, res) {
  return ok(res, { ok: true, service: 'seo-ai-agent-system', version: 'v1', uptime: process.uptime() });
}

import { getSchedulerState } from '../services/scheduler/schedulerService.js';
import { listRunHistory } from '../repositories/runHistoryRepository.js';
import { getRuntimeConfig } from '../config/runtimeConfig.js';

export function getHealthDetails(req, res) {
  try {
    var sched   = getSchedulerState();
    var runs    = listRunHistory({ limit: 1 });
    var latest  = runs.items && runs.items[0] ? runs.items[0] : null;
    return ok(res, {
      ok: true,
      scheduler: {
        enabled:        sched.enabled,
        running:        sched.running,
        lastStartedAt:  sched.lastStartedAt,
        lastFinishedAt: sched.lastFinishedAt,
        lastDurationMs: sched.lastDurationMs,
        lastError:      sched.lastError,
      },
      runHistory: {
        latestRunId: latest ? latest.runId : null,
        latestRunAt: latest ? latest.startedAt : null,
      },
    });
  } catch (err) {
    return ok(res, { ok: false, error: err && err.message });
  }
}

export function getHealthRuntime(req, res) {
  try {
    var cfg = getRuntimeConfig();
    return ok(res, {
      ok: true,
      config: {
        schedulerEnabled:     cfg.schedulerEnabled,
        schedulerIntervalMs:  cfg.schedulerIntervalMs,
        gscSyncEnabled:       cfg.gscSyncEnabled,
        publishEnabled:       cfg.publishEnabled,
        campaignSafeMode:     cfg.campaignSafeMode,
        maxCampaignsPerCycle: cfg.maxCampaignsPerCycle,
      },
    });
  } catch (err) {
    return ok(res, { ok: false, error: err && err.message });
  }
}
