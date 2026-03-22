
import { shouldPublishArticle } from '../../src/services/publisher/publishDecisionService.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Publish Decision Service Test');
console.log('\u2500'.repeat(60));

function makeArticle(overrides) {
  var base = {
    meta: {
      status:         'ready',
      currentVersion: 'v1',
      publishedUrl:   null,
      keyword:        'test keyword',
      latestEvaluation: { scoreV1: { overallScore: 75 } },
    },
    currentArticle: '<p>Content</p>',
    versionCount:   1,
  };
  if (overrides.meta) {
    Object.assign(base.meta, overrides.meta);
  }
  return base;
}

// 1. Export
console.log('\n\u25b6 1. Export');
check('shouldPublishArticle is function', typeof shouldPublishArticle === 'function');

// 2. Ready + good score → true
console.log('\n\u25b6 2. Ready + good score → shouldPublish true');
var r1 = shouldPublishArticle(makeArticle({}));
check('shouldPublish true',   r1.shouldPublish === true);
check('reason contains score', r1.reason && r1.reason.includes('75'));

// 3. Score >= 60 boundary
console.log('\n\u25b6 3. Score boundary');
var r2a = shouldPublishArticle(makeArticle({ meta: { latestEvaluation: { scoreV1: { overallScore: 60 } } } }));
check('score 60 → true',  r2a.shouldPublish === true);

var r2b = shouldPublishArticle(makeArticle({ meta: { latestEvaluation: { scoreV1: { overallScore: 59 } } } }));
check('score 59 → false', r2b.shouldPublish === false);
check('reason mentions score', r2b.reason && r2b.reason.includes('59'));

// 4. Status not ready → false
console.log('\n\u25b6 4. Status not ready');
var r3 = shouldPublishArticle(makeArticle({ meta: { status: 'finalized' } }));
check('finalized → false',     r3.shouldPublish === false);
check('reason mentions status', r3.reason && r3.reason.includes('status'));

var r3b = shouldPublishArticle(makeArticle({ meta: { status: 'draft' } }));
check('draft → false', r3b.shouldPublish === false);

// 5. Already published → false
console.log('\n\u25b6 5. Already published');
var r4 = shouldPublishArticle(makeArticle({ meta: { publishedUrl: 'https://example.com/post' } }));
check('publishedUrl set → false',    r4.shouldPublish === false);
check('reason mentions already',     r4.reason && r4.reason.includes('already'));

// 6. No version → false
console.log('\n\u25b6 6. No currentVersion');
var r5 = shouldPublishArticle(makeArticle({ meta: { currentVersion: null } }));
check('no version → false', r5.shouldPublish === false);

// 7. No score → false
console.log('\n\u25b6 7. No evaluation score');
var r6 = shouldPublishArticle(makeArticle({ meta: { latestEvaluation: {} } }));
check('no score → false',          r6.shouldPublish === false);
check('reason mentions no score',  r6.reason && r6.reason.includes('score'));

// 8. Null article → false
console.log('\n\u25b6 8. Null / invalid input');
var r7 = shouldPublishArticle(null);
check('null → false', r7.shouldPublish === false);

var r8 = shouldPublishArticle({});
check('empty object → false', r8.shouldPublish === false);

// 9. Return shape
console.log('\n\u25b6 9. Return shape');
var r9 = shouldPublishArticle(makeArticle({}));
check('has shouldPublish boolean', typeof r9.shouldPublish === 'boolean');
check('has reason string',         typeof r9.reason === 'string');

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
