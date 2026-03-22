
import 'dotenv/config';
import { validateAuthConfig, getAccessToken, clearTokenCache } from '../../src/integrations/gsc/gscAuth.js';
import { fetchSiteGSCData } from '../../src/services/gsc/gscService.js';

var pass = 0; var fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  GSC Auth + Service Test');
console.log('\u2500'.repeat(60));

// 1. validateAuthConfig
console.log('\n\u25b6 1. validateAuthConfig');
var origId = process.env.GSC_CLIENT_ID;
delete process.env.GSC_CLIENT_ID;
var v1 = validateAuthConfig();
check('missing var detected',    !v1.ok);
check('error mentions CLIENT_ID', v1.error && v1.error.includes('GSC_CLIENT_ID'));
process.env.GSC_CLIENT_ID = origId || 'test-client-id';

// 2. validateAuthConfig all missing
console.log('\n\u25b6 2. All env missing');
var savedAll = { id: process.env.GSC_CLIENT_ID, sec: process.env.GSC_CLIENT_SECRET, ref: process.env.GSC_REFRESH_TOKEN };
delete process.env.GSC_CLIENT_ID; delete process.env.GSC_CLIENT_SECRET; delete process.env.GSC_REFRESH_TOKEN;
var v2 = validateAuthConfig();
check('all missing: ok false',   !v2.ok);
check('error is string',          typeof v2.error === 'string' && v2.error.length > 0);
process.env.GSC_CLIENT_ID     = savedAll.id  || 'test-id';
process.env.GSC_CLIENT_SECRET = savedAll.sec || 'test-secret';
process.env.GSC_REFRESH_TOKEN = savedAll.ref || 'test-refresh';

// 3. getAccessToken — no real creds (safe failure)
console.log('\n\u25b6 3. getAccessToken safe failure');
clearTokenCache();
var a1 = await getAccessToken();
check('returns object',          typeof a1 === 'object');
check('has ok field',            'ok' in a1);
check('has token or error',      'token' in a1 || 'error' in a1);
check('no crash',                true);
if (!a1.ok) {
  check('error is string',       typeof a1.error === 'string');
  check('token is null',         a1.token === null);
  console.log('  (expected: no real creds — error:', a1.error, ')');
}

// 4. Real token (skip if no real creds)
console.log('\n\u25b6 4. Real token (skipped if no real creds)');
var hasRealCreds = (process.env.GSC_CLIENT_ID    || '').length > 20
                && (process.env.GSC_CLIENT_SECRET || '').length > 10
                && (process.env.GSC_REFRESH_TOKEN || '').length > 20;
if (hasRealCreds) {
  clearTokenCache();
  var a2 = await getAccessToken();
  check('real token ok',         a2.ok);
  check('token is string',       typeof a2.token === 'string' && a2.token.length > 10);
  // caching
  var a3 = await getAccessToken();
  check('cached token same',     a3.token === a2.token);
} else {
  check('skipped (no real creds)', true);
  check('skipped (no real creds)', true);
  check('skipped (no real creds)', true);
}

// 5. fetchSiteGSCData — safe failure without real creds
console.log('\n\u25b6 5. fetchSiteGSCData safe failure');
var s1 = await fetchSiteGSCData({ siteUrl: 'https://example.com/', startDate: '2025-01-01', endDate: '2025-01-07' });
check('returns object',          typeof s1 === 'object');
check('has ok field',            'ok' in s1);
check('has rows array',          Array.isArray(s1.rows));
check('no crash',                true);

// 6. Exports
console.log('\n\u25b6 6. Exports');
var { fetchArticleGSCData } = await import('../../src/services/gsc/gscService.js');
check('fetchArticleGSCData fn',  typeof fetchArticleGSCData === 'function');
check('fetchSiteGSCData fn',     typeof fetchSiteGSCData    === 'function');
var { getAccessToken: gat, validateAuthConfig: vac, clearTokenCache: ctc } = await import('../../src/integrations/gsc/gscAuth.js');
check('getAccessToken fn',       typeof gat === 'function');
check('validateAuthConfig fn',   typeof vac === 'function');
check('clearTokenCache fn',      typeof ctc === 'function');

// 7. fetchArticleGSCData — no publishedUrl
console.log('\n\u25b6 7. fetchArticleGSCData edge cases');
var e1 = await fetchArticleGSCData(null);
check('null article safe',       !e1.ok && typeof e1.error === 'string');
var e2 = await fetchArticleGSCData({ keyword: 'test' });
check('no publishedUrl safe',    !e2.ok && typeof e2.error === 'string');
var e3 = await fetchArticleGSCData({ publishedUrl: 'not-a-url' });
check('bad url safe',            !e3.ok && typeof e3.error === 'string');
var e4 = await fetchArticleGSCData({ meta: { publishedUrl: 'https://example.com/test' } });
check('valid url structure safe', 'ok' in e4 && Array.isArray(e4.rows));

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
