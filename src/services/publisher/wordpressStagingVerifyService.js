
export async function verifyWordpressConnection() {
  var result = { ok: false, siteName: null, user: null, canCreatePosts: false, canUploadMedia: false, status: null, error: null, raw: null };
  try {
    var baseUrl  = process.env.WORDPRESS_BASE_URL;
    var username = process.env.WORDPRESS_USERNAME;
    var password = process.env.WORDPRESS_APP_PASSWORD;
    if (!baseUrl || !username || !password) {
      result.error = 'Missing WORDPRESS_BASE_URL, WORDPRESS_USERNAME, or WORDPRESS_APP_PASSWORD';
      return result;
    }
    var auth = Buffer.from(username + ':' + password).toString('base64');
    var url  = baseUrl.replace(/\/$/, '') + '/wp-json/wp/v2/users/me';
    var res  = await fetch(url, { headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json' } });
    result.status = res.status;
    var body = null;
    try { body = await res.json(); } catch(e) { result.error = 'JSON parse error: ' + e.message; return result; }
    result.raw = body;
    if (!res.ok) {
      result.error = 'Auth failed: HTTP ' + res.status;
      return result;
    }
    result.ok             = true;
    result.user           = (body && body.name) || null;
    result.siteName       = null;
    var caps = (body && body.capabilities) || {};
    result.canCreatePosts = !!(caps.publish_posts || caps.edit_posts || caps.administrator);
    result.canUploadMedia = !!(caps.upload_files || caps.administrator);
    result.error          = null;
    return result;
  } catch (err) {
    result.error = err.message || 'connection error';
    return result;
  }
}
