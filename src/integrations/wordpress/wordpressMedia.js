import { wordpressRequest } from './wordpressRequest.js';

/**
 * wordpressMedia.js
 * WordPress REST API media upload — MVP-safe, best-effort.
 */

function getConfig() {
  return {
    baseUrl:     (process.env.WORDPRESS_BASE_URL || '').replace(/\/+$/, ''),
    username:    process.env.WORDPRESS_USERNAME    || '',
    appPassword: process.env.WORDPRESS_APP_PASSWORD || '',
  };
}

function makeBasicAuth(username, appPassword) {
  return 'Basic ' + Buffer.from(username + ':' + appPassword, 'utf8').toString('base64');
}

export async function uploadImageToWordpress(payload) {
  var config = getConfig();
  payload = payload || {};

  if (!config.baseUrl)     return { ok: false, status: null, mediaId: null, url: null, raw: null, error: 'WORDPRESS_BASE_URL is not set' };
  if (!config.username)    return { ok: false, status: null, mediaId: null, url: null, raw: null, error: 'WORDPRESS_USERNAME is not set' };
  if (!config.appPassword) return { ok: false, status: null, mediaId: null, url: null, raw: null, error: 'WORDPRESS_APP_PASSWORD is not set' };
  if (!payload.filename)   return { ok: false, status: null, mediaId: null, url: null, raw: null, error: 'filename is required' };
  if (!payload.mimeType)   return { ok: false, status: null, mediaId: null, url: null, raw: null, error: 'mimeType is required' };
  if (!payload.buffer)     return { ok: false, status: null, mediaId: null, url: null, raw: null, error: 'buffer is required' };

  var endpoint = config.baseUrl + '/wp-json/wp/v2/media';
  var headers  = {
    'Content-Type':        payload.mimeType,
    'Content-Disposition': 'attachment; filename="' + payload.filename + '"',
    'Authorization':       makeBasicAuth(config.username, config.appPassword),
  };
  if (payload.altText) {
    headers['X-WP-Alt-Text'] = payload.altText;
  }

  var response, raw = null;
  try {
    response = await fetch(endpoint, { method: 'POST', headers: headers, body: payload.buffer });
  } catch (err) {
    return { ok: false, status: null, mediaId: null, url: null, raw: null, error: 'Network error: ' + err.message };
  }

  try { raw = await response.json(); } catch (_) {
    return { ok: false, status: response.status, mediaId: null, url: null, raw: null, error: 'Failed to parse media response (status ' + response.status + ')' };
  }

  if (!response.ok) {
    var msg = (raw && raw.message) || (raw && raw.code) || 'Unknown error';
    return { ok: false, status: response.status, mediaId: null, url: null, raw: raw, error: 'Media upload failed ' + response.status + ': ' + msg };
  }

  return { ok: true, status: response.status, mediaId: raw.id || null, url: raw.source_url || null, raw: raw, error: null };
}
