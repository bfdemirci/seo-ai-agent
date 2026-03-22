import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSiteByIdRaw } from './siteRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE   = path.resolve(__dirname, '..', '..', 'storage', 'quotas');

function quotaPath(siteId) { return path.join(STORAGE, siteId + '.json'); }

function ensureDir() { if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE, { recursive: true }); }

function readQuota(siteId) {
  ensureDir();
  var fp = quotaPath(siteId);
  if (!fs.existsSync(fp)) return { dailyCount: 0, hourlyCount: 0, dailyWindowStart: null, hourlyWindowStart: null };
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return { dailyCount: 0, hourlyCount: 0, dailyWindowStart: null, hourlyWindowStart: null }; }
}

function writeQuota(siteId, state) {
  ensureDir();
  fs.writeFileSync(quotaPath(siteId), JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function resetIfStale(state) {
  var now = Date.now();
  var HOUR = 3600000;
  var DAY  = 86400000;
  if (!state.hourlyWindowStart || (now - new Date(state.hourlyWindowStart).getTime()) > HOUR) {
    state.hourlyCount = 0;
    state.hourlyWindowStart = new Date().toISOString();
  }
  if (!state.dailyWindowStart || (now - new Date(state.dailyWindowStart).getTime()) > DAY) {
    state.dailyCount = 0;
    state.dailyWindowStart = new Date().toISOString();
  }
  return state;
}

export function getSiteQuotaState(siteId) {
  try {
    var site = getSiteByIdRaw(siteId);
    var state = resetIfStale(readQuota(siteId));
    return {
      ok: true,
      state: {
        dailyCount:   state.dailyCount,
        hourlyCount:  state.hourlyCount,
        dailyLimit:   site ? (site.dailyArticleLimit  || 20)  : 20,
        hourlyLimit:  site ? (site.hourlyArticleLimit || 5)   : 5,
      }
    };
  } catch { return { ok: false, state: { dailyCount: 0, hourlyCount: 0, dailyLimit: 20, hourlyLimit: 5 } }; }
}

export function recordSiteGeneration(siteId, count) {
  try {
    var state = resetIfStale(readQuota(siteId));
    state.dailyCount  += (count || 1);
    state.hourlyCount += (count || 1);
    writeQuota(siteId, state);
    return { ok: true };
  } catch { return { ok: false }; }
}

export function canGenerateForSite(siteId, { requestedCount = 1 } = {}) {
  try {
    var site = getSiteByIdRaw(siteId);
    var state = resetIfStale(readQuota(siteId));
    var dailyLimit  = site ? (site.dailyArticleLimit  || 20)  : 20;
    var hourlyLimit = site ? (site.hourlyArticleLimit || 5)   : 5;
    var dailyOk  = (state.dailyCount  + requestedCount) <= dailyLimit;
    var hourlyOk = (state.hourlyCount + requestedCount) <= hourlyLimit;
    var allowed  = dailyOk && hourlyOk;
    var reason   = !allowed ? (!dailyOk ? 'daily_limit_reached' : 'hourly_limit_reached') : null;
    return { ok: true, allowed, reason, state: { dailyCount: state.dailyCount, hourlyCount: state.hourlyCount, dailyLimit, hourlyLimit } };
  } catch { return { ok: false, allowed: false, reason: 'quota_check_error', state: {} }; }
}
