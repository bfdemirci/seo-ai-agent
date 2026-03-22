import { serverError } from '../services/api/responseBuilder.js';
export function errorMiddleware(err, req, res, next) {
  console.error('[ERROR]', err.message);
  return serverError(res, err.message || 'Unexpected error');
}
