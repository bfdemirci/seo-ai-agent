import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE   = path.resolve(__dirname, '..', '..', 'storage', 'sites');
const FILE      = path.join(STORAGE, 'sites.json');

function ensureFile() {
  if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]\n', 'utf8');
}

function readAll() {
  ensureFile();
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function writeAll(sites) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(sites, null, 2) + '\n', 'utf8');
}

// Backward compat: eski flat alanları publisher yapısına normalize et
function normalizePublisher(site) {
  // Zaten yeni format varsa dokunma
  if (site.publisherType) return site;

  const hasWp = !!(
    site.wpUsername ||
    site.wpAppPassword ||
    (site.wordpress && (site.wordpress.baseUrl || site.wordpress.username))
  );

  if (hasWp) {
    const cfg = site.publisherConfig || {};
    const wp  = site.wordpress || {};
    return {
      ...site,
      publisherType:   'wordpress',
      publisherConfig: {
        baseUrl:     cfg.baseUrl     || wp.baseUrl     || site.baseUrl     || '',
        username:    cfg.username    || wp.username    || site.wpUsername   || '',
        appPassword: cfg.appPassword || wp.appPassword || site.wpAppPassword || '',
      }
    };
  }

  return { ...site, publisherType: 'manual', publisherConfig: {} };
}

function redact(site) {
  if (!site) return site;
  var s = { ...site };
  if (s.publisherConfig && s.publisherConfig.appPassword) {
    s.publisherConfig = { ...s.publisherConfig, appPassword: '[REDACTED]' };
  }
  // Eski alan uyumu
  if (s.wordpress && s.wordpress.appPassword) {
    s.wordpress = { ...s.wordpress, appPassword: '[REDACTED]' };
  }
  return s;
}

function buildFull(input) {
  // Flat alanlardan publisherType/publisherConfig çıkar
  var wpBaseUrl    = input.wpBaseUrl    || (input.wordpress && input.wordpress.baseUrl)    || input.baseUrl    || '';
  var wpUsername   = input.wpUsername   || (input.wordpress && input.wordpress.username)   || '';
  var wpAppPass    = input.wpAppPassword || (input.wordpress && input.wordpress.appPassword) || '';

  // publisherType/publisherConfig öncelikli; flat fallback
  var pType = input.publisherType || (wpUsername ? 'wordpress' : 'manual');
  var pCfg  = input.publisherConfig || {};

  if (pType === 'wordpress' && !pCfg.baseUrl && wpBaseUrl) {
    pCfg = { baseUrl: wpBaseUrl, username: wpUsername, appPassword: wpAppPass };
  }

  var defaults = {
    enabled:           true,
    publishEnabled:    false,
    gscEnabled:        true,
    campaignEnabled:   false,
    safeMode:          true,
    dailyArticleLimit: 20,
    hourlyArticleLimit: 5,
    language:          'tr',
    niche:             null,
    publisherType:     'manual',
    publisherConfig:   {},
    metadata:          {}
  };

  var full = Object.assign(defaults, input, {
    publisherType:   pType,
    publisherConfig: pCfg,
  });

  return full;
}

export function listSites({ includeDisabled = true } = {}) {
  try {
    var sites = readAll().map(normalizePublisher);
    if (!includeDisabled) sites = sites.filter(s => s.enabled !== false);
    return sites.map(redact);
  } catch { return []; }
}

export function getSiteById(siteId) {
  try {
    var sites = readAll();
    var found = sites.find(s => s.siteId === siteId) || null;
    if (!found) return null;
    return redact(normalizePublisher(found));
  } catch { return null; }
}

export function getSiteByIdRaw(siteId) {
  try {
    var sites = readAll();
    var found = sites.find(s => s.siteId === siteId) || null;
    return found ? normalizePublisher(found) : null;
  } catch { return null; }
}

export function saveSite(site) {
  try {
    if (!site || !site.siteId) return null;
    var sites = readAll();
    var idx   = sites.findIndex(s => s.siteId === site.siteId);
    var full  = buildFull(site);
    if (idx >= 0) { sites[idx] = full; } else { sites.push(full); }
    writeAll(sites);
    return redact(full);
  } catch { return null; }
}

export function updateSite(siteId, patch) {
  try {
    var sites = readAll();
    var idx   = sites.findIndex(s => s.siteId === siteId);
    if (idx < 0) return null;
    var existing = normalizePublisher(sites[idx]);
    // publisherConfig deep merge
    var mergedCfg = Object.assign({}, existing.publisherConfig || {}, patch.publisherConfig || {});
    var merged    = Object.assign({}, existing, patch, {
      siteId:          siteId,
      publisherType:   patch.publisherType   || existing.publisherType,
      publisherConfig: mergedCfg,
    });
    sites[idx] = merged;
    writeAll(sites);
    return redact(merged);
  } catch { return null; }
}
