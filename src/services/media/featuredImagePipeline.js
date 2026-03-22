
import { generateFeaturedImage } from './imageGenerationService.js';
import { uploadImageToWordpress } from '../../integrations/wordpress/wordpressMedia.js';

export async function generateAndUploadFeaturedImage(article) {
  var result = {
    ok:       false,
    attempted: true,
    mediaId:  null,
    url:      null,
    error:    null,
  };

  try {
    var meta    = (article && article.meta) || article || {};
    var keyword = meta.keyword || '';
    var title   = (meta.finalization && meta.finalization.title) || keyword;

    // Step 1: generate
    var gen = await generateFeaturedImage({ keyword: keyword, title: title });
    if (!gen || !gen.ok || !gen.buffer) {
      result.error = 'image generation failed: ' + (gen && gen.error || 'unknown');
      return result;
    }

    // Step 2: upload
    var upload = await uploadImageToWordpress({
      filename: gen.filename,
      mimeType: gen.mimeType,
      buffer:   gen.buffer,
      altText:  gen.altText || keyword,
    });

    if (!upload || !upload.ok) {
      result.error = 'wordpress upload failed: ' + (upload && upload.error || 'unknown');
      return result;
    }

    result.ok      = true;
    result.mediaId = upload.mediaId || null;
    result.url     = upload.url     || null;
    result.error   = null;
    return result;

  } catch (err) {
    result.error = err.message || 'featured image pipeline error';
    return result;
  }
}
