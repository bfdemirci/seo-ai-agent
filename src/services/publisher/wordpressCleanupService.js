
export async function trashWordpressPost(postId) {
  var result = { ok: false, trashed: false, postId: null, status: null, error: null, raw: null };
  try {
    if (!postId) { result.error = 'postId required'; return result; }
    var baseUrl  = process.env.WORDPRESS_BASE_URL;
    var username = process.env.WORDPRESS_USERNAME;
    var password = process.env.WORDPRESS_APP_PASSWORD;
    if (!baseUrl || !username || !password) { result.error = 'Missing WP env vars'; return result; }
    var auth = Buffer.from(username + ':' + password).toString('base64');
    // DELETE to WP REST API moves post to trash (not permanent delete)
    var url = baseUrl.replace(/\/$/, '') + '/wp-json/wp/v2/posts/' + postId;
    var res = await fetch(url, { method: 'DELETE', headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json' } });
    result.status = res.status;
    var body = null;
    try { body = await res.json(); } catch(e) {}
    result.raw = body;
    if (!res.ok) { result.error = 'Trash failed: HTTP ' + res.status; return result; }
    result.ok      = true;
    result.trashed = true;
    result.postId  = postId;
    return result;
  } catch (err) {
    result.error = err.message || 'cleanup error';
    return result;
  }
}
