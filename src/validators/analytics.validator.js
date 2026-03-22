export function validateGscQuery(req) {
  var q = req.query || {};
  if (q.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(q.startDate)) return { code: 'INVALID_QUERY', message: 'startDate must be YYYY-MM-DD' };
  if (q.endDate   && !/^\d{4}-\d{2}-\d{2}$/.test(q.endDate))   return { code: 'INVALID_QUERY', message: 'endDate must be YYYY-MM-DD' };
  return null;
}
