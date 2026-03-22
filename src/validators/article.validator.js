export function validateArticleId(req) {
  var id = req.params && req.params.articleId;
  if (!id || typeof id !== 'string' || !id.trim()) return { code: 'INVALID_PARAMS', message: 'articleId is required' };
  return null;
}
export function validateVersion(req) {
  var v = req.params && req.params.version;
  if (!v || !/^v\d+$/.test(v)) return { code: 'INVALID_PARAMS', message: 'version must match vN format (e.g. v1, v2)' };
  return null;
}
export function validateCurrentVersion(req) {
  var b = req.body || {};
  if (!b.version || !/^v\d+$/.test(b.version)) return { code: 'INVALID_BODY', message: 'version is required and must match vN format' };
  return null;
}
export function validateMetadataPatch(req) {
  var b = req.body || {};
  var allowed = ['status','publishedUrl','site','initialPosition'];
  var keys = Object.keys(b);
  if (!keys.length) return { code: 'INVALID_BODY', message: 'At least one field required' };
  for (var i=0;i<keys.length;i++) {
    if (!allowed.includes(keys[i])) return { code: 'INVALID_BODY', message: 'Unknown field: '+keys[i], details: { allowed } };
  }
  return null;
}
