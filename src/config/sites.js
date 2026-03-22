import 'dotenv/config';

export const SITES = [
  {
    siteId:   process.env.SITE1_ID   || 'site1',
    baseUrl:  process.env.SITE1_URL  || process.env.WORDPRESS_BASE_URL || '',
    niche:    process.env.SITE1_NICHE || 'general',
    language: process.env.SITE1_LANG  || 'tr',
    wpCredentials: {
      baseUrl:  process.env.SITE1_URL      || process.env.WORDPRESS_BASE_URL || '',
      username: process.env.SITE1_WP_USER  || process.env.WORDPRESS_USERNAME || '',
      password: process.env.SITE1_WP_PASS  || process.env.WORDPRESS_APP_PASSWORD || '',
    },
    campaignDefaults: {
      baseKeyword: process.env.SITE1_BASE_KEYWORD || '',
      locations:   (process.env.SITE1_LOCATIONS   || '').split(',').map(s => s.trim()).filter(Boolean),
      modifiers:   (process.env.SITE1_MODIFIERS   || '').split(',').map(s => s.trim()).filter(Boolean),
      limit:       parseInt(process.env.SITE1_CAMPAIGN_LIMIT || '10', 10),
      safeMode:    process.env.SITE1_SAFE_MODE !== 'false',
    },
  },
];

export function getSiteById(siteId) {
  return SITES.find(s => s.siteId === siteId) || null;
}
