import { runProgrammaticSeoCampaign } from '../services/programmatic/programmaticSeoService.js';
import { ok, badRequest, serverError } from '../services/api/responseBuilder.js';

export async function runCampaign(req, res) {
  try {
    var body = req.body || {};
    if (!body.baseKeyword || typeof body.baseKeyword !== 'string' || !body.baseKeyword.trim()) {
      return badRequest(res, 'baseKeyword is required.');
    }
    var config = {
      baseKeyword: body.baseKeyword.trim(),
      locations:   Array.isArray(body.locations)  ? body.locations  : [],
      modifiers:   Array.isArray(body.modifiers)  ? body.modifiers  : [],
      limit:       Number.isInteger(body.limit)   ? body.limit      : 50,
      safeMode:    body.safeMode !== false,
    };
    // injected fns — for testing
    var injected = req._programmaticInjected || {};
    var result = await runProgrammaticSeoCampaign(config, injected);
    return ok(res, {
      ok:             result.ok,
      totalGenerated: result.totalGenerated,
      created:        result.created,
      published:      result.published,
      failed:         result.failed,
      items:          result.items,
    });
  } catch (err) {
    return serverError(res, err.message || 'Programmatic campaign failed.');
  }
}
