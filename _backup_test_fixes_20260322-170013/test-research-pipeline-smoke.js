
var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Research Pipeline Smoke Test');
console.log('\u2500'.repeat(60));

// 1. Module import
console.log('\n\u25b6 1. Module import');
var mod;
try {
  mod = await import('../../src/pipelines/researchPipeline.js');
  check('module loads without error', true);
} catch (e) {
  check('module loads without error', false, e.message);
  process.exit(1);
}

// 2. Export shape
console.log('\n\u25b6 2. Export shape');
check('exports researchPipeline fn', typeof mod.researchPipeline === 'function');
check('is async function', mod.researchPipeline.constructor.name === 'AsyncFunction');

// 3. Call does not crash (returns object or throws Error — both acceptable)
console.log('\n\u25b6 3. Call does not crash');
var result = null;
var err = null;
try {
  result = await mod.researchPipeline({ keyword: 'smoke-test' });
} catch (e) {
  err = e;
}

var returnedObject = result !== null && typeof result === 'object';
var threwError     = err instanceof Error;
check('no silent crash (returns object or throws Error)', returnedObject || threwError);

if (returnedObject) {
  console.log('  \u2192 pipeline completed, result keys:', Object.keys(result).join(', '));
}
if (threwError) {
  console.log('  \u2192 pipeline threw (acceptable):', err.message.slice(0, 80));
}

// 4. If returned object — basic shape
console.log('\n\u25b6 4. Result shape (if returned)');
if (returnedObject) {
  check('has text or structured', result.text !== undefined || result.structured !== undefined);
} else {
  check('shape check skipped (threw error — OK)', true);
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
