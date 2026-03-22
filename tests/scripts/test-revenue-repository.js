import 'dotenv/config';
import { saveRevenueEvent, listRevenueEvents, summarizeRevenue, getTopByValue } from '../../src/repositories/revenueRepository.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Revenue Repository Test');
console.log('\u2500'.repeat(60));

var ts = Date.now();
var ev1 = { eventId: 'rev_test_'+ts+'_1', timestamp: new Date().toISOString(), siteId: 'site1', articleId: 'art1', keyword: 'altın', type: 'sale', value: 150, currency: 'USD', source: 'manual', notes: null };
var ev2 = { eventId: 'rev_test_'+ts+'_2', timestamp: new Date().toISOString(), siteId: 'site1', articleId: 'art1', keyword: 'altın', type: 'lead', value: 20, currency: 'USD', source: null, notes: null };
var ev3 = { eventId: 'rev_test_'+ts+'_3', timestamp: new Date().toISOString(), siteId: 'site2', articleId: 'art2', keyword: 'elmas', type: 'conversion', value: 300, currency: 'TRY', source: 'affiliate', notes: 'test' };

console.log('\n\u25b6 1. saveRevenueEvent');
var s1 = saveRevenueEvent(ev1);
check('returns event', s1 && s1.eventId === ev1.eventId);
saveRevenueEvent(ev2);
saveRevenueEvent(ev3);

console.log('\n\u25b6 2. listRevenueEvents');
var { items, total } = listRevenueEvents({ limit: 20 });
check('items array', Array.isArray(items));
check('total is number', typeof total === 'number');
check('ev1 in list', items.some(function(e){ return e.eventId === ev1.eventId; }));
check('ev3 in list', items.some(function(e){ return e.eventId === ev3.eventId; }));

console.log('\n\u25b6 3. summarizeRevenue — by siteId');
var sum1 = summarizeRevenue({ siteId: 'site1' });
check('totalEvents >= 2', sum1.totalEvents >= 2);
check('totalValue >= 170', sum1.totalValue >= 170);
check('sales >= 1', sum1.sales >= 1);
check('leads >= 1', sum1.leads >= 1);

console.log('\n\u25b6 4. summarizeRevenue — by articleId');
var sum2 = summarizeRevenue({ articleId: 'art2' });
check('art2 conversions >= 1', sum2.conversions >= 1);
check('art2 totalValue >= 300', sum2.totalValue >= 300);

console.log('\n\u25b6 5. summarizeRevenue — empty filter');
var sum3 = summarizeRevenue({ siteId: 'nonexistent_xyz' });
check('empty total 0', sum3.totalEvents === 0);
check('empty value 0', sum3.totalValue === 0);

console.log('\n\u25b6 6. getTopByValue');
var top = getTopByValue({ field: 'siteId', limit: 5 });
check('top is array', Array.isArray(top));
check('top has key+totalValue', top.length === 0 || (top[0].key && typeof top[0].totalValue === 'number'));

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
