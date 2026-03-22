import 'dotenv/config';
import { runDecisionCycle, getSchedulerState } from '../../src/services/scheduler/schedulerService.js';
import { createArticleRecord } from '../../src/repositories/articleRepository.js';

var pass = 0, fail = 0;
function check(label, val) {
  if (val) { console.log('  \u2713 PASS', label); pass++; }
  else      { console.log('  \u2717 FAIL', label); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Scheduler Decision Execution Test');
console.log('\u2500'.repeat(60));

console.log('\n\u25b6 1. runDecisionCycle is function');
check('function', typeof runDecisionCycle === 'function');

console.log('\n\u25b6 2. empty articles');
var r1 = await runDecisionCycle([], {});
check('returns array', Array.isArray(r1));
check('empty result', r1.length === 0);

console.log('\n\u25b6 3. null articles safe');
var r3 = await runDecisionCycle(null, {});
check('null returns array', Array.isArray(r3));
check('null returns empty', r3.length === 0);

console.log('\n\u25b6 4. single article cycle');
var ts = Date.now();
// createArticleRecord returns the articleId string
var testId = createArticleRecord({ keyword: 'test-dec-' + ts, article: { title: 'T', content: 'C' }, outline: null, research: null, evaluation: null, finalization: null });
check('article created', typeof testId === 'string' && testId.length > 0);

var testArticle = { id: testId, meta: { id: testId, status: 'new', impressions: 0, clicks: 0 } };
var r2 = await runDecisionCycle([testArticle], {});
check('result is array', Array.isArray(r2));
check('result length 1', r2.length === 1);
check('result has articleId', r2[0] && r2[0].articleId === testId);

console.log('\n\u25b6 5. scheduler state unchanged');
var state = getSchedulerState();
check('running false', state.running === false);
check('state is object', typeof state === 'object');

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
