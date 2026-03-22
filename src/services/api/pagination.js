const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;
const DEFAULT_OFFSET = 0;

export function parsePagination(query) {
  var limit  = Math.min(Math.max(parseInt(query.limit  || DEFAULT_LIMIT,  10) || DEFAULT_LIMIT,  1), MAX_LIMIT);
  var offset = Math.max(parseInt(query.offset || DEFAULT_OFFSET, 10) || DEFAULT_OFFSET, 0);
  return { limit, offset };
}

export function buildPagination(total, limit, offset) {
  return { total, limit, offset, hasMore: offset + limit < total };
}
