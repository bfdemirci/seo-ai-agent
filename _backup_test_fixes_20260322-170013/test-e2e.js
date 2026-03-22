import * as runner from '../lib/testRunner.js';
import * as log from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';

const FORCE_OPTIMIZE = process.env.FORCE_OPTIMIZE === 'true';

runner.run('End-to-End Pipeline Test', async ({keyword, loadStage}) => {

  log.section('Stage 1: Research');
  const research = await loadStage(keyword, 'research', async () => {
    const {researchPipeline} = await runner.importAgent('pipelines/researchPipeline.js');
    const r = await researchPipeline({keyword});
    return r.structured || r;
  });
  runner.assertHasKey('research.intent', research, 'intent');
  runner.assertHasKey('research.serp', research, 'serp');
  log.info('intent.primary', research.intent?.primary);

  log.section('Stage 2: Outline');
  const outline = await loadStage(keyword, 'outline', async () => {
    const {outlineAgent} = await runner.importAgent('agents/writing/outlineAgent.js');
    const r = await outlineAgent({keyword, research});
    return r.text || r;
  });
  runner.assertNonEmpty('outline generated', outline);
  runner.assert('outline has H1', /^#\s/m.test(outline));
  log.info('outline chars', outline.length);

  log.section('Stage 3: Article');
  const article = await loadStage(keyword, 'article', async () => {
    const {articleWriterAgent} = await runner.importAgent('agents/writing/articleWriterAgent.js');
    const r = await articleWriterAgent({keyword, outline});
    return r.text || r;
  });
  runner.assertNonEmpty('article generated', article);
  const wc = article.split(/\s+/).filter(Boolean).length;
  runner.assertGte('word count >= 800', wc, 800);
  log.info('word count', wc);

  log.section('Stage 4: Score V1');
  const scoreV1 = await loadStage(keyword, 'score', async () => {
    const {scoreAgent} = await runner.importAgent('agents/optimization/scoreAgent.js');
    const r = await scoreAgent({keyword, research, outline, article});
    return r.structured || r;
  });
  runner.assertHasKey('scoreV1 has overallScore', scoreV1, 'overallScore');
  log.info('overallScore', scoreV1.overallScore);
  log.info('seoScore', scoreV1.seoScore);
  log.info('intentScore', scoreV1.intentScore);
  log.info('readabilityScore', scoreV1.readabilityScore);

  log.section('Stage 5: Critic');
  const critic = await loadStage(keyword, 'critic', async () => {
    const {criticAgent} = await runner.importAgent('agents/optimization/criticAgent.js');
    const r = await criticAgent({keyword, outline, article, score: scoreV1});
    return r.structured || r;
  });
  runner.assertHasKey('critic has weaknesses', critic, 'weaknesses');
  runner.assertHasKey('critic has factualRiskFlags', critic, 'factualRiskFlags');
  log.info('weaknesses', critic.weaknesses?.length ?? 0);
  log.info('factualRiskFlags', critic.factualRiskFlags?.length ?? 0);

  log.section('Stage 6: Decision Engine');
  const {decisionEngine} = await runner.importAgent('agents/optimization/decisionEngine.js');
  const decision = decisionEngine({score: scoreV1, critic, keyword, article, outline});
  fixture.save(keyword, 'decision', decision);
  runner.assertHasKey('decision has action', decision, 'action');
  log.info('action', decision.action);
  log.info('shouldIterate', decision.shouldIterate);
  log.info('targets', (decision.targets||[]).join(', ')||'none');

  if (!decision.shouldIterate && !FORCE_OPTIMIZE) {
    runner.assert('pipeline reached PASS', decision.action === 'PASS');
    return;
  }

  log.section('Stage 7: Optimizer');
  const {targetedOptimizerAgent} = await runner.importAgent('agents/optimization/targetedOptimizerAgent.js');
  const {scoreAgent} = await runner.importAgent('agents/optimization/scoreAgent.js');
  let optimized;
  try {
    const _opt = await targetedOptimizerAgent({article, keyword, outline, score: scoreV1, critic, targets: decision.targets});
    optimized = _opt.text || _opt;
  } catch(err) { runner.assert('optimizer no error', false, err.message); return; }
  runner.assertNonEmpty('optimized article', optimized);

  const _sv2 = await scoreAgent({keyword, research, outline, article: optimized});
  const scoreV2 = _sv2.structured || _sv2;
  log.info('scoreV2.overallScore', scoreV2.overallScore);
  runner.assertScoreNotDegraded('scoreV2 >= scoreV1', scoreV1.overallScore, scoreV2.overallScore);
  const optimizerAccepted = scoreV2.overallScore >= scoreV1.overallScore;
  fixture.save(keyword, 'optimized', optimized);
  fixture.save(keyword, 'scoreV2', scoreV2);

  const factualInTargets = (decision.targets||[]).includes('factual');
  if (!optimizerAccepted || !factualInTargets) {
    log.info('factRepair skipped', !optimizerAccepted ? 'optimizer rolled back' : 'no factual target');
    return;
  }

  log.section('Stage 8: Fact Repair');
  const {factRepairAgent} = await runner.importAgent('agents/optimization/factRepairAgent.js');
  let repaired;
  try {
    const _rep = await factRepairAgent({article: optimized, keyword, critic});
    repaired = _rep.text || _rep;
  } catch(err) { runner.assert('factRepair no error', false, err.message); return; }
  runner.assertNonEmpty('repaired article', repaired);

  const _sv3 = await scoreAgent({keyword, research, outline, article: repaired});
  const scoreV3 = _sv3.structured || _sv3;
  log.info('scoreV3.overallScore', scoreV3.overallScore);
  runner.assertScoreNotDegraded('scoreV3 >= scoreV2', scoreV2.overallScore, scoreV3.overallScore);
  fixture.save(keyword, 'repaired', repaired);
  fixture.save(keyword, 'scoreV3', scoreV3);

  log.section('Score progression');
  log.score('v1 -> v2', scoreV1.overallScore, scoreV2.overallScore);
  if (scoreV3) log.score('v2 -> v3', scoreV2.overallScore, scoreV3.overallScore);
});

process.exit(0);
