/**
 * Manual publisher — no-op adapter.
 * Sistemin akışını kırmaz; publish edilmez ama hata da vermez.
 */
export async function manualPublish({ article, site } = {}) {
  return {
    ok:        true,
    mode:      'manual',
    published: false,
    skipped:   true,
    reason:    `publisherType=${site?.publisherType || 'manual'} — no publish configured`,
  };
}
