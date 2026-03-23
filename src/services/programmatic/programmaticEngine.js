import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE   = path.resolve(__dirname, '..', '..', '..', 'storage', 'programmatic');
const CAMPAIGNS = path.join(STORAGE, 'campaigns.json');
const QUEUE     = path.join(STORAGE, 'queue.json');
const HISTORY   = path.join(STORAGE, 'history.json');

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS   = 240000;
var _processing    = false;

function ensureStorage() {
  if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE, { recursive: true });
  if (!fs.existsSync(CAMPAIGNS)) fs.writeFileSync(CAMPAIGNS, '[]');
  if (!fs.existsSync(QUEUE))     fs.writeFileSync(QUEUE,     '[]');
  if (!fs.existsSync(HISTORY))   fs.writeFileSync(HISTORY,   '[]');
}

function read(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── Campaigns ────────────────────────────────────────────
export function createCampaign(data) {
  ensureStorage();
  if (!data.siteId || !data.name) throw new Error('siteId and name required');
  var campaigns = read(CAMPAIGNS);
  var id = 'camp_' + Date.now();
  var camp = {
    id,
    name:      data.name,
    siteId:    data.siteId,
    status:    'active',
    createdAt: new Date().toISOString(),
    settings: {
      publish:              data.publish              !== false,
      dripIntervalMinutes:  data.dripIntervalMinutes  || 10,
      maxPerRun:            data.maxPerRun            || 3,
    }
  };
  campaigns.push(camp);
  write(CAMPAIGNS, campaigns);
  console.log('[PROGRAMMATIC] campaign created:', id, camp.name);
  return camp;
}

export function listCampaigns() {
  ensureStorage();
  return read(CAMPAIGNS);
}

export function getCampaign(id) {
  return read(CAMPAIGNS).find(function(c) { return c.id === id; }) || null;
}

export function updateCampaignStatus(id, status) {
  ensureStorage();
  var campaigns = read(CAMPAIGNS);
  var idx = campaigns.findIndex(function(c) { return c.id === id; });
  if (idx < 0) return null;
  campaigns[idx].status = status;
  write(CAMPAIGNS, campaigns);
  return campaigns[idx];
}

// ── Keywords / Queue ──────────────────────────────────────
export function addKeywords(campaignId, keywords) {
  ensureStorage();
  var camp = getCampaign(campaignId);
  if (!camp) throw new Error('Campaign not found: ' + campaignId);

  var queue   = read(QUEUE);
  var added   = 0;
  var skipped = 0;

  keywords.forEach(function(kw) {
    kw = (kw || '').trim();
    if (!kw) return;

    // Duplicate check: same keyword + same siteId + pending/processing
    var exists = queue.find(function(q) {
      return q.keyword === kw && q.siteId === camp.siteId &&
             (q.status === 'pending' || q.status === 'processing');
    });
    if (exists) { skipped++; return; }

    queue.push({
      id:          'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      campaignId:  campaignId,
      keyword:     kw,
      siteId:      camp.siteId,
      status:      'pending',
      attempts:    0,
      lastError:   null,
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    });
    added++;
  });

  write(QUEUE, queue);
  console.log('[PROGRAMMATIC] keywords added:', added, 'skipped duplicates:', skipped);
  return { added, skipped, total: queue.filter(function(q) { return q.status === 'pending'; }).length };
}

export function getQueue(filter) {
  ensureStorage();
  var queue = read(QUEUE);
  if (filter && filter.status) queue = queue.filter(function(q) { return q.status === filter.status; });
  if (filter && filter.campaignId) queue = queue.filter(function(q) { return q.campaignId === filter.campaignId; });
  return queue;
}

export function getQueueStats() {
  ensureStorage();
  var queue = read(QUEUE);
  var stats = { pending: 0, processing: 0, done: 0, failed: 0, total: queue.length };
  queue.forEach(function(q) { if (stats[q.status] !== undefined) stats[q.status]++; });
  return stats;
}

// ── History ───────────────────────────────────────────────
export function getHistory(limit) {
  ensureStorage();
  var h = read(HISTORY);
  return limit ? h.slice(-limit).reverse() : h.reverse();
}

function addHistory(item) {
  var h = read(HISTORY);
  h.push(Object.assign({ createdAt: new Date().toISOString() }, item));
  // keep last 1000
  if (h.length > 1000) h = h.slice(-1000);
  write(HISTORY, h);
}

// ── Worker ────────────────────────────────────────────────
export async function processQueue() {
  if (_processing) {
    console.log('[PROGRAMMATIC] already running, skip');
    return { skipped: true };
  }
  _processing = true;

  try {
    ensureStorage();
    var queue     = read(QUEUE);
    var campaigns = read(CAMPAIGNS);
    var pending   = queue.filter(function(q) { return q.status === 'pending'; });

    if (!pending.length) {
      console.log('[PROGRAMMATIC] queue empty');
      _processing = false;
      return { processed: 0 };
    }

    // Group by campaign, respect maxPerRun
    var toProcess = [];
    var campCounts = {};
    pending.forEach(function(q) {
      var camp = campaigns.find(function(c) { return c.id === q.campaignId; });
      if (!camp || camp.status !== 'active') return;
      var max = (camp.settings && camp.settings.maxPerRun) || 3;
      campCounts[q.campaignId] = campCounts[q.campaignId] || 0;
      if (campCounts[q.campaignId] < max) {
        toProcess.push({ q, camp });
        campCounts[q.campaignId]++;
      }
    });

    console.log('[PROGRAMMATIC] processing', toProcess.length, 'items');

    // Lazy import to avoid circular deps
    var { writerPipeline } = await import('../../pipelines/writerPipeline.js');

    var processed = 0;
    for (var i = 0; i < toProcess.length; i++) {
      var item = toProcess[i];
      var q    = item.q;
      var camp = item.camp;

      // Mark processing
      queue = read(QUEUE);
      var idx = queue.findIndex(function(x) { return x.id === q.id; });
      if (idx < 0) continue;
      queue[idx].status    = 'processing';
      queue[idx].updatedAt = new Date().toISOString();
      write(QUEUE, queue);

      console.log('[PROGRAMMATIC] processing keyword:', q.keyword, '(site:', q.siteId + ')');

      try {
        // Timeout wrapper
        var result = await Promise.race([
          writerPipeline({ keyword: q.keyword, site: q.siteId }),
          new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error('timeout after ' + TIMEOUT_MS + 'ms')); }, TIMEOUT_MS);
          })
        ]);

        // Mark done
        queue = read(QUEUE);
        idx   = queue.findIndex(function(x) { return x.id === q.id; });
        if (idx >= 0) {
          queue[idx].status    = 'done';
          queue[idx].articleId = result.evaluation.articleId || null;
          queue[idx].updatedAt = new Date().toISOString();
          write(QUEUE, queue);
        }

        addHistory({
          keyword:    q.keyword,
          siteId:     q.siteId,
          campaignId: q.campaignId,
          articleId:  result.evaluation.articleId || null,
          success:    true,
          error:      null,
        });

        console.log('[PROGRAMMATIC] success: keyword=' + q.keyword + ' articleId=' + (result.evaluation.articleId || '—'));
        processed++;

      } catch(err) {
        var errMsg = err && err.message || String(err);
        console.error('[PROGRAMMATIC] failed:', q.keyword, '—', errMsg);

        queue = read(QUEUE);
        idx   = queue.findIndex(function(x) { return x.id === q.id; });
        if (idx >= 0) {
          queue[idx].attempts++;
          queue[idx].lastError = errMsg;
          queue[idx].updatedAt = new Date().toISOString();
          if (queue[idx].attempts >= MAX_ATTEMPTS) {
            queue[idx].status = 'failed';
            console.log('[PROGRAMMATIC] permanently failed after', MAX_ATTEMPTS, 'attempts:', q.keyword);
          } else {
            queue[idx].status = 'pending'; // retry
            console.log('[PROGRAMMATIC] will retry (attempt', queue[idx].attempts + '/' + MAX_ATTEMPTS + '):', q.keyword);
          }
          write(QUEUE, queue);
        }

        addHistory({
          keyword:    q.keyword,
          siteId:     q.siteId,
          campaignId: q.campaignId,
          articleId:  null,
          success:    false,
          error:      errMsg,
        });
      }
    }

    _processing = false;
    return { processed, pending: pending.length - processed };

  } catch(e) {
    _processing = false;
    console.error('[PROGRAMMATIC] processQueue error:', e.message);
    throw e;
  }
}
