import * as runner from '../lib/testRunner.js';
import * as log from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';

const ITERATIONS = parseInt(process.env.ITERATIONS || '1', 10);

runner.run('Targeted Optimizer Test', async ({keyword, loadStage}) => {

  const article  = fixture.load(keyword, 'article');
  const outline  = fixture.load(keyword, 'outline');
  const research = fixture.load(keyword, 'research');
  runner.assertNonEmpty('article loaded', article);
  log.info('article chars', article.length);

  const scoreV1 = await loadStage(keyword, 'score', async () => {
    const {scoreAgent} = await runner.importAgent('agents/optimization/scoreAgent.js');
    return scoreAgent({keyword, research, outline, article});
  });
  log.info('scoreV1.overallScore', scoreV1.overallScore);

  const critic = await loadStage(keyword, 'critic', async () => {
    const {criticAgent} = await runner.importAgent('agents/optimization/criticAgent.js');
    return criticAgent({keyword, outline, article, score: scoreV1});
  });

  const decision = await loadStage(keyword, 'decision', async () => {
    const {decisionEngine} = await runner.importAgent('agents/optimization/decisionEngine.js');
    return decisionEngine({score: scoreV1, critic, keyword, article, outline});
  });
  log.info('targets', (decision.targets||[]).join(', ')||'none');

  const {targetedOptimizerAgent} = await runner.importAgent('agents/optimization/targetedOptimizerAgent.js');
  const {scoreAgent} = await runner.importAgent('agents/optimization/scoreAgent.js');
  const iterResults = [];

  for (let i = 1; i <= ITERATIONS; i++) {
    log.section('Optimizer run '+i+'/'+ITERATIONS);
    const t0 = Date.now();
    let optimized;
    try {
      optimized = await targetedOptimizerAgent({article, keyword, outline, score: scoreV1, critic, targets: decision.targets});
    } catch(err) { runner.assert('optimizer run '+i+' no error', false, err.message); continue; }
    log.info('duration', log.duration(Date.now()-t0));
    log.info('optimized chars', optimized.length);
    runner.assertNonEmpty('optimized article ('+i+')', optimized);
    runner.assert('length >= 70% of original', optimized.length/article.length >= 0.7, 'ratio='+(optimized.length/article.length).toFixed(2));

    let scoreV2;
    try {
      scoreV2 = await scoreAgent({keyword, research, outline, article: optimized});
    } catch(err) { runner.assert('scoreV2 no error', false, err.message); continue; }

    runner.assertScoreNotDegraded('overallScore not degraded ('+i+')', scoreV1.overallScore, scoreV2.overallScore);
    runner.assertScoreImproved('overallScore improved ('+i+')', scoreV1.overallScore, scoreV2.overallScore);

    log.section('Sub-score breakdown');
    for (const k of ['seoScore','intentScore','readabilityScore','structureScore','usefulnessScore']) {
      log.score(k, scoreV1[k]??'?', scoreV2[k]??'?');
    }
    if (i===1) { fixture.save(keyword,'optimized',optimized); fixture.save(keyword,'scoreV2',scoreV2); }
    iterResults.push({i, v1:scoreV1.overallScore, v2:scoreV2.overallScore, delta:scoreV2.overallScore-scoreV1.overallScore, ok:scoreV2.overallScore>scoreV1.overallScore});
  }

  if (ITERATIONS > 1) {
    log.section('Multi-iteration summary');
    iterResults.forEach(r => {
      const icon = r.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.log('  '+icon+' iter '+r.i+': '+r.v1+' -> '+r.v2+' ('+(r.delta>=0?'+':'')+r.delta+')');
    });
    runner.assert('all iterations improved', iterResults.filter(r=>r.ok).length===ITERATIONS, iterResults.filter(r=>r.ok).length+'/'+ITERATIONS);
  }
});
