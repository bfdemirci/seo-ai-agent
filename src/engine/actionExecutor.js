export async function executeDecision(articleId, decision, deps = {}) {
  try {
    const action = decision?.action ?? 'NO_ACTION';

    if (action === 'NO_ACTION') {
      return { ok: true, skipped: true, action, articleId, error: null };
    }

    if (action === 'DELETE' || action === 'KILL') {
      return { ok: true, skipped: true, action, articleId, error: null };
    }

    if (action === 'OPTIMIZE' || action === 'REFRESH' || action === 'REWRITE') {
      if (typeof deps.optimizeFn !== 'function') {
        return { ok: true, skipped: true, action, articleId, error: null };
      }
      try {
        await deps.optimizeFn(articleId);
        return { ok: true, skipped: false, action, articleId, error: null };
      } catch (err) {
        return { ok: false, skipped: false, action, articleId, error: err?.message ?? String(err) };
      }
    }

    return { ok: true, skipped: true, action, articleId, error: null };
  } catch (err) {
    return { ok: false, skipped: true, action: decision?.action ?? 'UNKNOWN', articleId, error: err?.message ?? String(err) };
  }
}
