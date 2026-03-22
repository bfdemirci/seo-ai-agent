import { wordpressRequest } from './wordpressRequest.js';
import { generateAndUploadFeaturedImage } from '../../services/media/featuredImagePipeline.js';

/**
 * wordpressPublisher.js
 * WordPress REST API publisher — draft-first, featured image best-effort.
 */

import { uploadImageToWordpress } from './wordpressMedia.js';

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

function validate(payload, config) {
  if (!config.baseUrl)     return 'WORDPRESS_BASE_URL is not set';
  if (!config.username)    return 'WORDPRESS_USERNAME is not set';
  if (!config.appPassword) return 'WORDPRESS_APP_PASSWORD is not set';
  if (!payload.title   || !payload.title.trim())  return 'title is required';
  if (!payload.content || !payload.content.trim()) return 'content is required';
  if (!payload.slug    || !payload.slug.trim())   return 'slug is required';
  return null;
}

export async function publishToWordpress(payload) {
  var config = getConfig();
  payload = payload || {};

  var err = validate(payload, config);
  if (err) {
    return { ok: false, status: null, postId: null, url: null, raw: null, error: err, image: null };
  }

  // ── Featured image — best-effort ──────────────────────────────────────────
  var imageResult = null;
  var featuredMediaId = null;

  if (payload.featuredImage && payload.featuredImage.buffer) {
    var imgRes = await uploadImageToWordpress(payload.featuredImage);
    imageResult = { attempted: true, success: imgRes.ok };
    if (imgRes.ok && imgRes.mediaId) {
      featuredMediaId = imgRes.mediaId;
    }
    // non-blocking: post creation continues regardless
  }

  // ── Build post body ───────────────────────────────────────────────────────
  var postBody = {
    title:   payload.title.trim(),
    content: payload.content.trim(),
    slug:    payload.slug.trim(),
    status:  payload.status || 'draft',
    excerpt: payload.excerpt || '',
  };
  if (featuredMediaId) {
    postBody.featured_media = featuredMediaId;
  }

  // ── POST /wp-json/wp/v2/posts ─────────────────────────────────────────────
  var endpoint = config.baseUrl + '/wp-json/wp/v2/posts';
  var headers  = {
    'Content-Type':  'application/json',
    'Authorization': makeBasicAuth(config.username, config.appPassword),
  };

  var response, raw = null;
  try {
    response = await fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(postBody) });
  } catch (networkErr) {
    return { ok: false, status: null, postId: null, url: null, raw: null, error: 'Network error: ' + networkErr.message, image: imageResult };
  }

  try { raw = await response.json(); } catch (_) {
    return { ok: false, status: response.status, postId: null, url: null, raw: null, error: 'Failed to parse WordPress response (status ' + response.status + ')', image: imageResult };
  }

  if (!response.ok) {
    var wpMsg = (raw && raw.message) || (raw && raw.code) || 'Unknown WordPress error';
    return { ok: false, status: response.status, postId: null, url: null, raw: raw, error: 'WordPress returned ' + response.status + ': ' + wpMsg, image: imageResult };
  }

  return { ok: true, status: response.status, postId: raw.id || null, url: raw.link || null, raw: raw, error: null, image: imageResult };
}
