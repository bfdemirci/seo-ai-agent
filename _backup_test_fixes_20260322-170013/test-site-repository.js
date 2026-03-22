import 'dotenv/config';
import { saveSite, listSites, getSiteById, updateSite } from '../../src/repositories/siteRepository.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Site Repository Test');
console.log('\u2500'.repeat(60));

var ts = Date.now();
var site1 = { siteId: 'test_site_'+ts, name: 'Test Site', baseUrl: 'https://test.com', language: 'tr', niche: 'jewelry', enabled: true, publishEnabled: false, gscEnabled: true, campaignEnabled: false, safeMode: true, dailyArticleLimit: 10, hourlyArticleLimit: 3, wordpress: { baseUrl: 'https://test.com', username: 'admin', appPassword: 'secret123' } };

console.log('\n\u25b6 1. saveSite');
var saved = saveSite(site1);
check('returns object', saved && saved.siteId === site1.siteId);
check('password redacted', saved && saved.wordpress && saved.wordpress.appPassword === '[REDACTED]');

console.log('\n\u25b6 2. getSiteById');
var found = getSiteById(site1.siteId);
check('found site', found !== null);
check('password redacted in get', found && found.wordpress && found.wordpress.appPassword === '[REDACTED]');

console.log('\n\u25b6 3. listSites');
var sites = listSites();
check('returns array', Array.isArray(sites));
check('contains saved site', sites.some(function(s){ return s.siteId === site1.siteId; }));
check('all redacted', sites.every(function(s){ return !s.wordpress || s.wordpress.appPassword !== 'secret123'; }));

console.log('\n\u25b6 4. updateSite');
var updated = updateSite(site1.siteId, { dailyArticleLimit: 25, enabled: false });
check('update ok', updated !== null);
check('limit updated', updated && updated.dailyArticleLimit === 25);
check('enabled updated', updated && updated.enabled === false);

console.log('\n\u25b6 5. unknown site');
var missing = getSiteById('nonexistent_xyz_' + ts);
check('unknown returns null', missing === null);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
