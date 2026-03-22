
export async function verifyPublishedPost({ postId, expectedSlug, expectedStatus }) {
  var result = { ok: false, verified: false, postId: null, slugMatches: false, statusMatches: false, actualStatus: null, actualSlug: null, error: null, raw: null };
  try {
    if (!postId) { result.error = 'postId required'; return result; }
    var baseUrl  = process.env.WORDPRESS_BASE_URL;
    var username = process.env.WORDPRESS_USERNAME;
    var password = process.env.WORDPRESS_APP_PASSWORD;
    if (!baseUrl || !username || !password) { result.error = 'Missing WP env vars'; return result; }
    var auth = Buffer.from(username + ':' + password).toString('base64');
    var url  = baseUrl.replace(/\/$/, '') + '/wp-json/wp/v2/posts/' + postId;
    var res  = await fetch(url, { headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json' } });
    result.status = res.status;
    var body = null;
    try { body = await res.json(); } catch(e) { result.error = 'JSON parse error: ' + e.message; return result; }
    result.raw = body;
    if (!res.ok) { result.error = 'Post not found: HTTP ' + res.status; return result; }
    result.ok           = true;
    result.postId       = body.id || null;
    result.actualStatus = body.status || null;
    result.actualSlug   = body.slug   || null;
    result.slugMatches  = expectedSlug   ? (result.actualSlug   === expectedSlug)   : true;
    result.statusMatches= expectedStatus ? (result.actualStatus === expectedStatus) : true;
    result.verified     = result.slugMatches && result.statusMatches;
    return result;
  } catch (err) {
    result.error = err.message || 'verify error';
    return result;
  }
}
