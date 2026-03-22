import * as runner from '../lib/testRunner.js';
import * as log from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';

runner.run('Decision Engine Test', async ({keyword, loadStage}) => {

  const article  = fixture.load(keyword, 'article');
  const outline  = fixture.load(keyword, 'outline');
  const research = fixture.load(keyword, 'research');

  log.section('Loading scoreV1');
  const score = await loadStage(keyword, 'score', async () => {
    const {scoreAgent} = await runner.importAgent('agents/optimization/scoreAgent.js');
    return scoreAgent({keyword, research, outline, article});
  });
  runner.assertHasKey('score has overallScore', score, 'overallScore');
  runner.assertHasKey('score has seoScore', score, 'seoScore');
  runner.assertHasKey('score has intentScore', score, 'intentScore');
  log.info('overallScore', score.overallScore);

  log.section('Loading critic');
  const critic = await loadStage(keyword, 'critic', async () => {
    const {criticAgent} = await runner.importAgent('agents/optimization/criticAgent.js');
    return criticAgent({keyword, outline, article, score});
  });
  runner.assertHasKey('critic has weaknesses', critic, 'weaknesses');
  runner.assertHasKey('critic has factualRiskFlags', critic, 'factualRiskFlags');
  runner.assertHasKey('critic has improvementActions', critic, 'improvementActions');
  log.info('factualRiskFlags', critic.factualRiskFlags?.length ?? 0);

  log.section('Running decisionEngine (pure function)');
  const {decisionEngine} = await runner.importAgent('agents/optimization/decisionEngine.js');
  const decision = decisionEngine({score, critic, keyword, article, outline});
  fixture.save(keyword, 'decision', decision);

  runner.assertHasKey('decision has action', decision, 'action');
  runner.assertHasKey('decision has shouldIterate', decision, 'shouldIterate');
  runner.assert('action is valid', ['PASS','OPTIMIZE','REWRITE'].includes(decision.action), decision.action);
  log.info('action', decision.action);
  log.info('shouldIterate', decision.shouldIterate);
  log.info('targets', (decision.targets||[]).join(', ')||'none');

  log.section('Boundary: score=90 no blockers');
  const passDecision = decisionEngine({
    score: {...score, overallScore: 90},
    critic: {...critic, factualRiskFlags: [], improvementActions: [], repeatedSections: []},
    keyword, article, outline
  });
  runner.assert('score=90 → PASS', passDecision.action === 'PASS', 'got: '+passDecision.action);
  runner.assert('score=90 → shouldIterate=false', !passDecision.shouldIterate);
});

process.exit(0);
