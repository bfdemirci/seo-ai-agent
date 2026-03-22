import { ok, serverError } from '../services/api/responseBuilder.js';
import { writerPipeline } from '../pipelines/writerPipeline.js';

/**
 * POST /api/v1/generate
 * Sync for now. Architecture stays future-proof for async (202+jobId) pattern.
 * When async is added: extract runGeneration() into a shared service, call from job worker too.
 */
export async function generate(req, res) {
  var keyword = (req.body.keyword || '').trim();
  var site    = (req.body.site    || '').trim() || null;
  try {
    var result = await writerPipeline({ keyword, site });
    return ok(res, {
      keyword,
      articleId:   result.articleId   || null,
      article:     result.article,
      outline:     result.outline,
      research:    result.research,
      evaluation:  result.evaluation,
      finalization:result.finalization || null,
      _meta:       result._meta,
    });
  } catch (err) {
    console.error('[generate]', err.message);
    return serverError(res, 'Generation failed: ' + err.message);
  }
}
