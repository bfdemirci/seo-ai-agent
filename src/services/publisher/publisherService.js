import { generateAndUploadFeaturedImage } from '../media/featuredImagePipeline.js';

/**
 * publisherService.js
 * Orchestrates: decision → wordpress publish → metadata update → event append.
 */

import { getArticleById, updateArticleMetadata, appendArticleEvent } from '../../repositories/articleRepository.js';
import { shouldPublishArticle } from './publishDecisionService.js';
import { publishToWordpress } from '../../integrations/wordpress/wordpressPublisher.js';

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * publishArticle(articleId)
 * returns: { ok, skipped, reason?, wordpressPostId?, url?, error? }
 */
export async function publishArticle(articleId) {
  var article = getArticleById(articleId);
  if (!article) {
    return { ok: false, skipped: false, error: 'Article not found: ' + articleId };
  }

  var decision = shouldPublishArticle(article);
  if (!decision.shouldPublish) {
    return { ok: false, skipped: true, reason: decision.reason };
  }

  var meta    = article.meta;
  var keyword = meta.keyword || '';
  var title   = keyword;
  var content = article.currentArticle || '';
  var slug    = slugify(keyword);

  if (!content) {
    return { ok: false, skipped: false, error: 'currentArticle content is empty' };
  }

  var result = await publishToWordpress({ title: title, content: content, slug: slug, status: 'draft' });

  if (!result.ok) {
    return { ok: false, skipped: false, error: result.error };
  }

  // metadata update
  var now = new Date().toISOString();
  updateArticleMetadata(articleId, {
    publishedUrl: result.url || '',
    publishedAt:  now,
  });

  // event append
  appendArticleEvent(articleId, {
    type:            'published_to_wordpress',
    wordpressPostId: result.postId,
    url:             result.url,
    status:          'draft',
  });

  return {
    ok:              true,
    skipped:         false,
    wordpressPostId: result.postId,
    url:             result.url,
  };
}
