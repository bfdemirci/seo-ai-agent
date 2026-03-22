export function validateGenerate(req) {
  var b = req.body || {};
  if (!b.keyword || typeof b.keyword !== 'string' || !b.keyword.trim()) return { code: 'INVALID_BODY', message: 'keyword is required and must be a non-empty string' };
  if (b.keyword.length > 200) return { code: 'INVALID_BODY', message: 'keyword too long (max 200 chars)' };
  return null;
}
