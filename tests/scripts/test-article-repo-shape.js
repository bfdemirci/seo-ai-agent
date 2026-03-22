
import {
  createArticleRecord,
  getArticleById,
  listArticles,
  updateArticleMetadata,
  appendArticleEvent,
  saveArticleVersion,
} from '../../src/repositories/articleRepository.js';

var pass = 0; var fail = 0;
function check(label, val, info) {
  if (val) { console.log('  \u2713 PASS', label, info ? ' ' + info : ''); pass++; }
  else      { console.log('  \u2717 FAIL', label, info ? ' ' + info : ''); fail++; }
}

console.log('\n' + '\u2500'.repeat(60));
console.log('  Article Repository Shape Test');
console.log('\u2500'.repeat(60));

// 1. createArticleRecord
console.log('\n\u25b6 1. createArticleRecord');
var artId = createArticleRecord({
  keyword: 'repo-shape-test',
  article: '<h1>Test</h1>',
  outline: '# Outline',
  research: { topic: 'test' },
  evaluation: { scoreV1: { overallScore: 80 }, scoreV2: null, scoreV3: null, decision: null },
  finalization: { metaTitle: 'Test', metaDescription: 'Desc', slugSuggestion: 'test' },
});
check('returns string id',   typeof artId === 'string');
check('id starts with art_', artId.startsWith('art_'));

// 2. getArticleById shape
console.log('\n\u25b6 2. getArticleById — shape');
var rec = getArticleById(artId);
check('returns object',             typeof rec === 'object' && rec !== null);
check('has meta key',               typeof rec.meta === 'object' && rec.meta !== null);
check('meta.id matches',            rec.meta.id === artId);
check('meta.keyword matches',       rec.meta.keyword === 'repo-shape-test');
check('meta.status string',         typeof rec.meta.status === 'string');
check('meta.createdAt string',      typeof rec.meta.createdAt === 'string');
check('meta.updatedAt string',      typeof rec.meta.updatedAt === 'string');
check('meta.currentVersion is v1',  rec.meta.currentVersion === 'v1');
check('meta.events array',          Array.isArray(rec.meta.events));
check('meta.publishHistory array',  Array.isArray(rec.meta.publishHistory));
check('meta.site is null',          rec.meta.site === null);
check('meta.publishedUrl is null',  rec.meta.publishedUrl === null);
check('has versionCount number',    typeof rec.versionCount === 'number');

// 3. listArticles — flat array
console.log('\n\u25b6 3. listArticles — flat array');
var list = listArticles();
check('returns array',              Array.isArray(list));
check('length >= 1',               list.length >= 1);
var found = list.find(function(a) { return a.id === artId; });
check('new article in list',       !!found);
check('list item has id',          found && typeof found.id === 'string');
check('list item has keyword',     found && typeof found.keyword === 'string');
check('list item has status',      found && typeof found.status === 'string');
check('list item NO meta wrapper', found && found.meta === undefined);

// 4. updateArticleMetadata
console.log('\n\u25b6 4. updateArticleMetadata');
var oldUpdatedAt = rec.meta.updatedAt;
updateArticleMetadata(artId, { site: 'https://example.com', publishedUrl: 'https://example.com/test' });
var updated = getArticleById(artId);
check('site updated',         updated.meta.site === 'https://example.com');
check('publishedUrl updated', updated.meta.publishedUrl === 'https://example.com/test');
check('updatedAt changed',    updated.meta.updatedAt !== oldUpdatedAt);

// 5. appendArticleEvent
console.log('\n\u25b6 5. appendArticleEvent');
var beforeCount = getArticleById(artId).meta.events.length;
appendArticleEvent(artId, { type: 'test_event', payload: 'hello' });
var afterRec = getArticleById(artId);
check('events grew by 1',    afterRec.meta.events.length === beforeCount + 1);
var ev = afterRec.meta.events[afterRec.meta.events.length - 1];
check('event has type',      ev.type === 'test_event');
check('event has timestamp', typeof ev.timestamp === 'string');
check('event has payload',   ev.payload === 'hello');

// 6. saveArticleVersion
console.log('\n\u25b6 6. saveArticleVersion');
var v2 = saveArticleVersion(artId, {
  article: '<h1>V2</h1>',
  outline: '# V2 Outline',
  label: 'refresh',
});
check('returns version string',  typeof v2 === 'string');
check('version is v2',           v2 === 'v2');
var afterV2 = getArticleById(artId);
check('currentVersion updated',  afterV2.meta.currentVersion === 'v2');
check('versionCount is 2',       afterV2.versionCount === 2);

// 7. unknown id returns null
console.log('\n\u25b6 7. unknown id');
var missing = getArticleById('art_nonexistent_000');
check('returns null for unknown', missing === null);

console.log('\n' + '\u2500'.repeat(60));
console.log('  SUMMARY');
console.log('\u2500'.repeat(60));
console.log('  ' + pass + ' passed  ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
