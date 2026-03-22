import * as runner from '../lib/testRunner.js';
import * as log from '../lib/logger.js';
import * as fixture from '../lib/fixtureManager.js';

runner.run('Finalization Agent Test', async ({keyword, loadStage}) => {

  log.section('Loading article');
  const article = fixture.exists(keyword,'repaired') ? fixture.load(keyword,'repaired')
    : fixture.exists(keyword,'optimized')             ? fixture.load(keyword,'optimized')
    : await loadStage(keyword,'article', async()=>{ throw new Error('No article fixture.'); });
  runner.assertNonEmpty('article loaded', article);
  log.info('article chars', article.length);

  const outline = fixture.load(keyword, 'outline');
  const scoreV1 = fixture.load(keyword, 'score');
  const scoreV2 = fixture.exists(keyword,'scoreV2') ? fixture.load(keyword,'scoreV2') : null;
  const scoreV3 = fixture.exists(keyword,'scoreV3') ? fixture.load(keyword,'scoreV3') : null;

  log.section('Running finalizationAgent');
  const {finalizationAgent} = await runner.importAgent('agents/finalization/finalizationAgent.js');

  const t0 = Date.now();
  let result;
  try {
    result = await finalizationAgent({ keyword, article, outline, evaluation: {scoreV1, scoreV2, scoreV3} });
  } catch(err) {
    runner.assert('finalizationAgent no error', false, err.message); return;
  }
  log.info('duration', log.duration(Date.now() - t0));

  // ── Assertions ────────────────────────────────────────────────────────────
  runner.assertHasKey('has metaTitle',       result, 'metaTitle');
  runner.assertHasKey('has metaDescription', result, 'metaDescription');
  runner.assertHasKey('has slugSuggestion',  result, 'slugSuggestion');

  log.info('metaTitle',       result.metaTitle);
  log.info('metaDescription', result.metaDescription);
  log.info('slugSuggestion',  result.slugSuggestion);

  const titleLen = result.metaTitle.length;
  const descLen  = result.metaDescription.length;

  log.info('metaTitle length',       titleLen);
  log.info('metaDescription length', descLen);

  runner.assert('metaTitle 40-65 chars',       titleLen >= 40 && titleLen <= 65,  titleLen + ' chars');
  runner.assert('metaDescription 100-165 chars', descLen >= 100 && descLen <= 165, descLen + ' chars');

  // Slug: lowercase ASCII hyphenated, no special chars
  runner.assert('slug is lowercase ASCII',
    /^[a-z0-9-]+$/.test(result.slugSuggestion),
    result.slugSuggestion
  );
  runner.assert('slug has no double hyphens', !result.slugSuggestion.includes('--'), result.slugSuggestion);
  runner.assert('slug does not start/end with hyphen',
    !result.slugSuggestion.startsWith('-') && !result.slugSuggestion.endsWith('-'),
    result.slugSuggestion
  );
  runner.assert('slug min 3 chars', result.slugSuggestion.length >= 3, result.slugSuggestion.length + ' chars');

  // Keyword presence (loose check — should appear somewhere)
  const kw = keyword.toLowerCase().split(' ')[0];
  const titleLower = result.metaTitle.toLowerCase();
  const descLower  = result.metaDescription.toLowerCase();
  runner.assert('keyword in metaTitle or metaDescription',
    titleLower.includes(kw) || descLower.includes(kw),
    'keyword: ' + kw
  );

  // Save fixture
  fixture.save(keyword, 'finalization', {
    metaTitle:       result.metaTitle,
    metaDescription: result.metaDescription,
    slugSuggestion:  result.slugSuggestion,
  });
  log.info('fixture saved', 'finalization.json');
});

process.exit(0);
