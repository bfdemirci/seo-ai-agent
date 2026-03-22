import 'dotenv/config';

var _cachedToken = null;
var _tokenExpiry  = 0;

export function validateAuthConfig() {
  var missing = [];
  if (!process.env.GSC_CLIENT_ID)     missing.push('GSC_CLIENT_ID');
  if (!process.env.GSC_CLIENT_SECRET) missing.push('GSC_CLIENT_SECRET');
  if (!process.env.GSC_REFRESH_TOKEN) missing.push('GSC_REFRESH_TOKEN');
  if (missing.length > 0) {
    return { ok: false, error: 'Missing GSC env vars: ' + missing.join(', ') };
  }
  return { ok: true };
}

export async function getAccessToken() {
  var cfg = validateAuthConfig();
  if (!cfg.ok) return { ok: false, error: cfg.error, token: null };

  var now = Date.now();
  if (_cachedToken && now < _tokenExpiry - 30000) {
    return { ok: true, token: _cachedToken };
  }

  try {
    var body = new URLSearchParams();
    body.set('client_id',     process.env.GSC_CLIENT_ID);
    body.set('client_secret', process.env.GSC_CLIENT_SECRET);
    body.set('refresh_token', process.env.GSC_REFRESH_TOKEN);
    body.set('grant_type',    'refresh_token');

    var res  = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });
    var data = await res.json();

    if (!res.ok || !data.access_token) {
      var msg = (data.error_description || data.error || 'token fetch failed');
      return { ok: false, error: msg, token: null };
    }

    _cachedToken = data.access_token;
    _tokenExpiry = now + (data.expires_in || 3600) * 1000;
    return { ok: true, token: _cachedToken };
  } catch (err) {
    return { ok: false, error: err.message || 'getAccessToken failed', token: null };
  }
}

export function clearTokenCache() {
  _cachedToken = null;
  _tokenExpiry  = 0;
}
