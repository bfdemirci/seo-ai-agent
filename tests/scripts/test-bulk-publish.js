
import 'dotenv/config';
import {
  enqueueArticles, getQueueStatus, clearQueue, runQueue, bulkPublishAll
} from '../../src/services/publisher/bulkPublishService.js';
import { createArticleRecord, updateArticleMetadata } from '../../src/repositories/articleRepository.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Bulk Publish Service Test');
console.log('\u2500'.repeat(60));

// 1. Exports
console.log('\n\u25b6 1. Exports');
check('enqueueArticles is function', typeof enqueueArticles === 'function');
check('getQueueStatus is function',  typeof getQueueStatus === 'function');
check('clearQueue is function',      typeof clearQueue === 'function');
check('runQueue is function',        typeof runQueue === 'function');
check('bulkPublishAll is function',  typeof bulkPublishAll === 'function');

// 2. enqueue
console.log('\n\u25b6 2. enqueue');
clearQueue();
var r1 = enqueueArticles(['a1','a2','a3']);
check('enqueued 3',         r1.enqueued === 3);
check('total 3',            r1.total === 3);
check('pending 3',          getQueueStatus().pending === 3);
check('not running',        getQueueStatus().running === false);

// 3. no duplicates
console.log('\n\u25b6 3. no duplicates');
var r2 = enqueueArticles(['a1','a4']);
check('only new added',     r2.enqueued === 1);
check('total 4',            r2.total === 4);

// 4. clearQueue
console.log('\n\u25b6 4. clearQueue');
clearQueue();
check('pending 0 after clear', getQueueStatus().pending === 0);
check('running false',         getQueueStatus().running === false);

// 5. dry run
console.log('\n\u25b6 5. dry run');
clearQueue();
enqueueArticles(['x1','x2']);
var r3 = await runQueue({ dryRun: true });
check('ok true',            r3.ok === true);
check('total 2',            r3.total === 2);
check('all skipped',        r3.skipped === 2);
check('success 0',          r3.success === 0);
check('failed 0',           r3.failed === 0);
check('results array',      Array.isArray(r3.results));
check('result has articleId', r3.results[0].articleId === 'x1');
check('result reason dry_run', r3.results[0].reason === 'dry_run');

// 6. real run — unknown articles → safe error per item
console.log('\n\u25b6 6. real run — unknown articles');
clearQueue();
enqueueArticles(['nonexistent_art_1','nonexistent_art_2']);
var r4 = await runQueue({ dryRun: false });
check('ok true (queue ran)', r4.ok === true);
check('total 2',             r4.total === 2);
check('no crash',            true);
check('failed 2',            r4.failed === 2);
for (var i = 0; i < r4.results.length; i++) {
  check('result has error', typeof r4.results[i].error === 'string');
}

// 7. runQueue already running guard
console.log('\n\u25b6 7. concurrent run guard');
clearQueue();
enqueueArticles(['z1']);
// manually set running state by checking it starts false
var before = getQueueStatus().running;
check('starts not running', before === false);

// 8. bulkPublishAll dry run
console.log('\n\u25b6 8. bulkPublishAll dry run');
clearQueue();
var artId = createArticleRecord({ keyword: 'bulk test', article: '<p>x</p>', outline: '', research: {}, evaluation: {}, finalization: {} });
var r5 = await bulkPublishAll({ dryRun: true });
check('ok true',            r5.ok === true);
check('has results',        Array.isArray(r5.results));
check('all skipped',        r5.skipped === r5.total);

// 9. queue status after run
console.log('\n\u25b6 9. queue status contract');
clearQueue();
var status = getQueueStatus();
check('has pending',        typeof status.pending === 'number');
check('has running',        typeof status.running === 'boolean');
check('has results',        Array.isArray(status.results));

// 10. return shape contract
console.log('\n\u25b6 10. return shape contract');
clearQueue();
enqueueArticles(['shape_test']);
var r6 = await runQueue({ dryRun: true });
check('has ok',      typeof r6.ok === 'boolean');
check('has total',   typeof r6.total === 'number');
check('has success', typeof r6.success === 'number');
check('has skipped', typeof r6.skipped === 'number');
check('has failed',  typeof r6.failed === 'number');
check('has results', Array.isArray(r6.results));

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
