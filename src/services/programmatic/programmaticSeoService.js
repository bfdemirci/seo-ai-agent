import { writerPipeline } from '../../pipelines/writerPipeline.js';
import { createArticleRecord, appendArticleEvent } from '../../repositories/articleRepository.js';

export function generateKeywords(config) {
  var base      = (config.baseKeyword || '').trim();
  var locations = config.locations  || [''];
  var modifiers = config.modifiers  || [''];
  var limit     = config.limit      || 100;
  var seen = {};
  var keywords = [];
  for (var li = 0; li < locations.length; li++) {
    for (var mi = 0; mi < modifiers.length; mi++) {
      if (keywords.length >= limit) break;
      var parts = [];
      if (locations[li]) parts.push(locations[li].trim());
      if (base)          parts.push(base);
      if (modifiers[mi]) parts.push(modifiers[mi].trim());
      var kw = parts.join(' ').replace(/\s+/g, ' ').trim();
      if (kw && !seen[kw]) { seen[kw] = true; keywords.push(kw); }
    }
    if (keywords.length >= limit) break;
  }
  return keywords;
}

export async function runProgrammaticSeoCampaign(config, injected) {
  config   = config   || {};
  injected = injected || {};

  var safeMode   = config.safeMode !== false;
  var keywords   = generateKeywords(config);
  var total      = keywords.length;
  var created    = 0;
  var published  = 0;
  var failed     = 0;
  var items      = [];
  var campaignId = 'camp_' + Date.now();

  var writerFn   = injected.writerFn   || function(opts) { return writerPipeline(opts); };
  var optimizeFn = injected.optimizeFn || null;
  var publishFn  = injected.publishFn  || null;

  console.log('[PROGRAMMATIC] starting -- keywords:', total, '| safeMode:', safeMode);

  for (var i = 0; i < keywords.length; i++) {
    var kw = keywords[i];
    try {
      console.log('[PROGRAMMATIC] (' + (i+1) + '/' + total + ') generating:', kw);

      var pipelineResult = await writerFn({ keyword: kw });

      if (!pipelineResult || !pipelineResult.article) {
        failed++;
        items.push({ keyword: kw, articleId: null, ok: false, error: 'writerFn returned no article' });
        console.log('[PROGRAMMATIC] FAIL:', kw, 'no article');
        continue;
      }

      var articleId = (pipelineResult.evaluation && pipelineResult.evaluation.articleId) || null;

      if (!articleId) {
        articleId = createArticleRecord({
          keyword:      kw,
          article:      pipelineResult.article      || '',
          outline:      pipelineResult.outline       || '',
          research:     pipelineResult.research      || {},
          evaluation:   pipelineResult.evaluation    || {},
          finalization: (pipelineResult.evaluation && pipelineResult.evaluation.finalization) || {},
        });
      }

      appendArticleEvent(articleId, {
        type:      'programmatic_created',
        campaignId: campaignId,
        keyword:   kw,
        createdAt: new Date().toISOString(),
      });

      created++;
      var itemPublished = false;

      if (!safeMode) {
        var _optimizeFn = optimizeFn;
        if (!_optimizeFn) {
          try { var optMod = await import('../maintenance/autoOptimizationService.js'); _optimizeFn = optMod.runAutoOptimizationForArticle; } catch(e) {}
        }
        if (_optimizeFn) {
          try { await _optimizeFn(articleId, { safeMode: false }); } catch(e) { console.log('[PROGRAMMATIC] optimize warn:', e.message); }
        }

        var _publishFn = publishFn;
        if (!_publishFn) {
          try { var pubMod = await import('../publisher/publisherService.js'); _publishFn = pubMod.publishArticle; } catch(e) {}
        }
        if (_publishFn) {
          try {
            var pubResult = await _publishFn(articleId);
            if (pubResult && pubResult.ok && !pubResult.skipped) { published++; itemPublished = true; }
          } catch(e) { console.log('[PROGRAMMATIC] publish warn:', e.message); }
        }
      }

      items.push({ keyword: kw, articleId: articleId, ok: true, error: null });
      console.log('[PROGRAMMATIC] OK:', kw, '-->', articleId);

    } catch(err) {
      failed++;
      items.push({ keyword: kw, articleId: null, ok: false, error: err.message || 'unknown error' });
      console.log('[PROGRAMMATIC] ERROR:', kw, err.message);
    }
  }

  console.log('[PROGRAMMATIC] done -- created:', created, 'published:', published, 'failed:', failed);
  return { ok: true, totalGenerated: total, created: created, published: published, failed: failed, items: items };
}
