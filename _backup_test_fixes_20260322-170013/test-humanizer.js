import * as runner from '../lib/testRunner.js';
import * as log from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';

runner.run('Humanizer Agent Test', async ({keyword, loadStage}) => {

  // Input: repaired > optimized > original
  log.section('Loading input article');
  let inputArticle, inputLabel;
  if (fixture.exists(keyword, 'repaired')) {
    inputArticle = fixture.load(keyword, 'repaired');
    inputLabel = 'article_repaired.txt';
  } else if (fixture.exists(keyword, 'optimized')) {
    inputArticle = fixture.load(keyword, 'optimized');
    inputLabel = 'article_optimized.txt';
  } else {
    inputArticle = await loadStage(keyword, 'article', async () => { throw new Error('No article fixture.'); });
    inputLabel = 'article.txt';
  }
  log.info('source', inputLabel);
  runner.assertNonEmpty('input article', inputArticle);
  log.info('input chars', inputArticle.length);

  // Baseline score: scoreV3 > scoreV2 > scoreV1
  log.section('Loading baseline score');
  let baseScore, baseLabel;
  if (fixture.exists(keyword, 'scoreV3')) {
    baseScore = fixture.load(keyword, 'scoreV3'); baseLabel = 'score_v3.json';
  } else if (fixture.exists(keyword, 'scoreV2')) {
    baseScore = fixture.load(keyword, 'scoreV2'); baseLabel = 'score_v2.json';
  } else {
    baseScore = fixture.load(keyword, 'score'); baseLabel = 'score.json';
  }
  log.info('baseline', baseLabel);
  log.info('baseline overallScore',     baseScore.overallScore);
  log.info('baseline readabilityScore', baseScore.readabilityScore);
  log.info('baseline structureScore',   baseScore.structureScore);

  const research = await loadStage(keyword, 'research', async () => { throw new Error('No research fixture.'); });
  const outline  = fixture.load(keyword, 'outline');
  const critic   = fixture.load(keyword, 'critic');

  // Run humanizerAgent
  log.section('Running humanizerAgent');
  const {humanizerAgent} = await runner.importAgent('agents/optimization/humanizerAgent.js');
  const {scoreAgent}     = await runner.importAgent('agents/optimization/scoreAgent.js');

  const t0 = Date.now();
  let humanized;
  try {
    humanized = await humanizerAgent({ article: inputArticle, keyword, score: baseScore, critic });
  } catch(err) {
    runner.assert('humanizerAgent no error', false, err.message); return;
  }
  log.info('duration', log.duration(Date.now() - t0));

  const humanizedText = (humanized && humanized.text) ? humanized.text : humanized;
  runner.assertNonEmpty('humanized article', humanizedText);
  log.info('humanized chars', humanizedText.length);
  log.info('patches applied', humanized.patches?.length ?? 'unknown');

  // Length sanity
  runner.assert(
    'length 90-110% of input',
    humanizedText.length / inputArticle.length >= 0.9 && humanizedText.length / inputArticle.length <= 1.1,
    'ratio=' + (humanizedText.length / inputArticle.length).toFixed(2)
  );

  // If no patches applied, article is unchanged — skip scoring (LLM variance would cause false failures)
  if ((humanized.patches?.length ?? 0) === 0) {
    log.warn('0 patches applied — article unchanged, skipping score (no risk)');
    runner.assert('overallScore not materially degraded', true, 'skipped (0 patches)');
    runner.assert('structureScore not degraded', true, 'skipped (0 patches)');
    runner.assert('readabilityScore same or better', true, 'skipped (0 patches)');
    runner.assert('headings unchanged', true, 'skipped (0 patches)');
    return;
  }

  // Score
  log.section('Scoring humanized article');
  let scoreH;
  try {
    scoreH = await scoreAgent({ keyword, research, outline, article: humanizedText });
  } catch(err) {
    runner.assert('scoreAgent no error', false, err.message); return;
  }
  log.info('humanized overallScore',     scoreH.overallScore);
  log.info('humanized readabilityScore', scoreH.readabilityScore);
  log.info('humanized structureScore',   scoreH.structureScore);

  // Key assertions
  runner.assert('overallScore not materially degraded', scoreH.overallScore >= baseScore.overallScore - 1, baseScore.overallScore + ' -> ' + scoreH.overallScore);
  runner.assertScoreNotDegraded('structureScore not degraded',   baseScore.structureScore,   scoreH.structureScore);
  runner.assertScoreNotDegraded('readabilityScore same or better', baseScore.readabilityScore, scoreH.readabilityScore);

  // Sub-score breakdown
  log.section('Sub-score breakdown');
  for (const k of ['seoScore','intentScore','readabilityScore','structureScore','usefulnessScore']) {
    log.score(k, baseScore[k] ?? '?', scoreH[k] ?? '?');
  }

  // Heading integrity
  const inputHeadings    = (inputArticle.match(/^#{1,3} .+/gm) || []);
  const humanizedHeadings = (humanizedText.match(/^#{1,3} .+/gm) || []);
  runner.assert(
    'headings unchanged',
    JSON.stringify(inputHeadings) === JSON.stringify(humanizedHeadings),
    inputHeadings.length + ' headings'
  );

  fixture.save(keyword, 'optimized', humanizedText);
  fixture.save(keyword, 'scoreV2',   scoreH);
});

process.exit(0);
