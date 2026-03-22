
var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Writer Pipeline Smoke Test');
console.log('\u2500'.repeat(60));

// 1. Module import
console.log('\n\u25b6 1. Module import');
var mod;
try {
  mod = await import('../../src/pipelines/writerPipeline.js');
  check('module loads without error', true);
} catch (e) {
  check('module loads without error', false, e.message);
  process.exit(1);
}
check('exports writerPipeline fn', typeof mod.writerPipeline === 'function');

// 2. Function signature
console.log('\n\u25b6 2. Function signature');
check('is async function', mod.writerPipeline.constructor.name === 'AsyncFunction');

// 3. Dependency chain intact
console.log('\n\u25b6 3. Dependency chain intact');
var deps = [
  '../../src/pipelines/researchPipeline.js',
  '../../src/repositories/articleRepository.js',
  '../../src/providers/semrushProvider.js',
];
for (var i = 0; i < deps.length; i++) {
  var dep = deps[i];
  try {
    await import(dep);
    check('imports: ' + dep.split('/').pop(), true);
  } catch (e) {
    check('imports: ' + dep.split('/').pop(), false, e.message.slice(0, 60));
  }
}

// 4. articleRepository stable
console.log('\n\u25b6 4. articleRepository integration');
var { listArticles } = await import('../../src/repositories/articleRepository.js');
check('listArticles returns array', Array.isArray(listArticles()));

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
