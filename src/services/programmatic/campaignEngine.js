import { generateKeywords, runProgrammaticSeoCampaign } from './programmaticSeoService.js';
import { saveRunHistory } from '../../repositories/runHistoryRepository.js';
import { listArticles } from '../../repositories/articleRepository.js';

var DEFAULT_THROTTLE_MS = parseInt(process.env.CAMPAIGN_THROTTLE_MS || '500', 10);

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

export async function runCampaign(campaignConfig, injected) {
  campaignConfig = campaignConfig || {};
  injected       = injected       || {};

  var siteId      = campaignConfig.siteId      || 'default';
  var baseKeyword = campaignConfig.baseKeyword  || '';
  var locations   = campaignConfig.locations    || [''];
  var modifiers   = campaignConfig.modifiers    || [''];
  var limit       = Math.min(campaignConfig.limit || 10, 1000);
  var safeMode    = campaignConfig.safeMode !== false;
  var throttleMs  = campaignConfig.throttleMs || DEFAULT_THROTTLE_MS;

  var startedAt = new Date().toISOString();
  var totalGenerated = 0;
  var created        = 0;
  var published      = 0;
  var failed         = 0;
  var items          = [];

  try {
    var keywords = generateKeywords({ baseKeyword, locations, modifiers, limit });
    totalGenerated = keywords.length;

    for (var i = 0; i < keywords.length; i++) {
      var kw = keywords[i];
      try {
        var result = await runProgrammaticSeoCampaign(
          { baseKeyword: kw, locations: [''], modifiers: [''], limit: 1, safeMode, siteId },
          injected
        );
        if (result && result.items && result.items.length > 0) {
          var item = result.items[0];
          var itemOk = item.ok !== false;
          items.push({ keyword: kw, siteId, articleId: item.articleId || null, published: item.published || false, ok: itemOk, error: item.error || null });
          if (itemOk) { created++; } else { failed++; }
          if (item.published) published++;
        } else {
          items.push({ keyword: kw, siteId, articleId: null, published: false, ok: false, error: 'no result' });
          failed++;
        }
      } catch (err) {
        items.push({ keyword: kw, siteId, articleId: null, published: false, ok: false, error: err && err.message ? err.message : String(err) });
        failed++;
      }

      if (i < keywords.length - 1 && throttleMs > 0) {
        await sleep(throttleMs);
      }
    }
  } catch (outerErr) {
    failed++;
    items.push({ keyword: null, siteId, articleId: null, published: false, ok: false, error: outerErr && outerErr.message ? outerErr.message : String(outerErr) });
  }

  var finishedAt = new Date().toISOString();
  var durationMs = new Date(finishedAt) - new Date(startedAt);

  try {
    saveRunHistory({
      runId:      'campaign_' + siteId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type:       'campaign_run',
      startedAt,
      finishedAt,
      durationMs,
      summary: {
        siteId,
        totalGenerated,
        created,
        published,
        failed,
      },
      error: failed > 0 && created === 0 ? 'all_failed' : null,
    });
  } catch (_) {}

  return { ok: true, totalGenerated, created, published, failed, items };
}
