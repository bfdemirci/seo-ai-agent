import { manualPublish } from './manualPublisher.js';

/**
 * Publisher adapter resolver.
 * publisherType'a göre doğru adapter'ı döner.
 */
export function resolvePublisher(site) {
  var type = (site && site.publisherType) || 'manual';

  switch (type) {
    case 'wordpress':
      return null; // mevcut WP akışı devam etsin

    case 'api':
      // Stub — ileride webhook/external endpoint buraya gelir
      return async ({ article }) => ({
        ok: false, skipped: true, reason: 'api publisher not implemented yet'
      });

    case 'none':
      return async () => ({
        ok: true, mode: 'none', published: false, skipped: true, reason: 'publisherType=none'
      });

    case 'manual':
    default:
      return manualPublish;
  }
}

export function isWordPressPublisher(site) {
  return (site && site.publisherType) === 'wordpress';
}
