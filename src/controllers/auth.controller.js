import jwt from 'jsonwebtoken';
import { ok, unauthorized } from '../services/api/responseBuilder.js';

export function login(req, res) {
  var email    = (req.body.email    || '').trim();
  var password = (req.body.password || '').trim();
  var adminEmail    = process.env.ADMIN_EMAIL    || '';
  var adminPassword = process.env.ADMIN_PASSWORD || '';
  if (email !== adminEmail || password !== adminPassword) {
    return unauthorized(res, 'Invalid credentials');
  }
  var expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  var token = jwt.sign({ email, role: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn });
  return ok(res, { token, expiresIn });
}
