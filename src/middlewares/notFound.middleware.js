import { notFound } from '../services/api/responseBuilder.js';
export function notFoundMiddleware(req, res) {
  return notFound(res, 'Route not found: ' + req.method + ' ' + req.path);
}
