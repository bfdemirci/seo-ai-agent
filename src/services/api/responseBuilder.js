import { randomUUID } from 'crypto';

function meta(extra) {
  return Object.assign({ requestId: randomUUID(), version: 'v1' }, extra || {});
}

export function ok(res, data, extra) {
  return res.status(200).json({ success: true, data, meta: meta(extra) });
}

export function created(res, data, extra) {
  return res.status(201).json({ success: true, data, meta: meta(extra) });
}

export function badRequest(res, code, message, details) {
  return res.status(400).json({ success: false, error: { code: code || 'INVALID_REQUEST', message: message || 'Bad request', details: details || null }, meta: meta() });
}

export function unauthorized(res, message) {
  return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: message || 'Authentication required', details: null }, meta: meta() });
}

export function notFound(res, message) {
  return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: message || 'Resource not found', details: null }, meta: meta() });
}

export function serverError(res, message, details) {
  return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: message || 'Internal server error', details: details || null }, meta: meta() });
}
