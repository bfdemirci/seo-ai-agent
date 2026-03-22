import jwt from 'jsonwebtoken';
import { unauthorized } from '../services/api/responseBuilder.js';

export function requireAuth(req, res, next) {
  var header = req.headers['authorization'] || '';
  var token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return unauthorized(res, 'No token provided');
  try {
    var decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (_) {
    return unauthorized(res, 'Invalid or expired token');
  }
}
