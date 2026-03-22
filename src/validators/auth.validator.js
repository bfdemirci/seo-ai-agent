export function validateLogin(req) {
  var b = req.body || {};
  if (!b.email || typeof b.email !== 'string') return { code: 'INVALID_BODY', message: 'email is required' };
  if (!b.password || typeof b.password !== 'string') return { code: 'INVALID_BODY', message: 'password is required' };
  return null;
}
