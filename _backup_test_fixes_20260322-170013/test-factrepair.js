import * as runner from '../lib/testRunner.js';
import * as log from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';

runner.run('Fact Repair Test', async ({keyword, loadStage}) => {

  const outline  = fixture.load(keyword, 'outline');
  const research = fixture.load(keyword, 'research');

  const useOptimized = fixture.exists(keyword, 'optimized');
  const inputArticle = useOptimized ? fixture.load(keyword,'optimized') : fixture.load(keyword,'article');
  log.info('source', useOptimized ? 'article_optimized.txt' : 'article.txt');
  runner.assertNonEmpty('input article', inputArticle);

  const hasV2 = fixture.exists(keyword, 'scoreV2');
  const baseScore = hasV2 ? fixture.load(keyword,'scoreV2') : fixture.load(keyword,'score');
  log.info('baseline', hasV2 ? 'score_v2.json' : 'score.json');
  log.info('baseline overallScore', baseScore.overallScore);

  const critic = fixture.load(keyword, 'critic');
  log.info('factualRiskFlags', critic.factualRiskFlags?.length ?? 0);

  log.section('Running factRepairAgent');
  const {factRepairAgent} = await runner.importAgent('agents/optimization/factRepairAgent.js');
  const {scoreAgent} = await runner.importAgent('agents/optimization/scoreAgent.js');

  let repaired;
  try {
    const _rep = await factRepairAgent({article: inputArticle, keyword, critic});
    repaired = (_rep && _rep.text) ? _rep.text : _rep;
  } catch(err) { runner.assert('factRepairAgent no error', false, err.message); return; }
  runner.assertNonEmpty('repaired article', repaired);
  log.info('repaired chars', repaired.length);
  runner.assert('length >= 80% of input', repaired.length/inputArticle.length >= 0.8, 'ratio='+(repaired.length/inputArticle.length).toFixed(2));

  log.section('Scoring repaired article');
  const scoreV3 = await scoreAgent({keyword, research, outline, article: repaired});
  log.info('scoreV3.overallScore', scoreV3.overallScore);
  runner.assertScoreNotDegraded('scoreV3 >= baseline', baseScore.overallScore, scoreV3.overallScore);
  for (const k of ['seoScore','intentScore','readabilityScore','structureScore','usefulnessScore']) {
    log.score(k, baseScore[k]??'?', scoreV3[k]??'?');
  }
  fixture.save(keyword, 'repaired', repaired);
  fixture.save(keyword, 'scoreV3', scoreV3);
});

process.exit(0);
