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

function redact(site) {
  if (!site) return site;
  var s = Object.assign({}, site);
  if (s.wordpress) {
    s.wordpress = Object.assign({}, s.wordpress);
    if (s.wordpress.appPassword) s.wordpress.appPassword = '[REDACTED]';
  }
  return s;
}

export function listSites({ includeDisabled = true } = {}) {
  try {
    var sites = readAll();
    if (!includeDisabled) sites = sites.filter(function(s){ return s.enabled !== false; });
    return sites.map(redact);
  } catch { return []; }
}

export function getSiteById(siteId) {
  try {
    var sites = readAll();
    var found = sites.find(function(s){ return s.siteId === siteId; }) || null;
    return redact(found);
  } catch { return null; }
}

export function getSiteByIdRaw(siteId) {
  try {
    var sites = readAll();
    return sites.find(function(s){ return s.siteId === siteId; }) || null;
  } catch { return null; }
}

export function saveSite(site) {
  try {
    if (!site || !site.siteId) return null;
    var sites = readAll();
    var idx = sites.findIndex(function(s){ return s.siteId === site.siteId; });
    var full = Object.assign({
      enabled: true,
      publishEnabled: false,
      gscEnabled: true,
      campaignEnabled: false,
      safeMode: true,
      dailyArticleLimit: 20,
      hourlyArticleLimit: 5,
      language: 'tr',
      niche: null,
      wordpress: { baseUrl: null, username: null, appPassword: null },
      metadata: {}
    }, site);
    if (idx >= 0) { sites[idx] = full; } else { sites.push(full); }
    writeAll(sites);
    return redact(full);
  } catch { return null; }
}

export function updateSite(siteId, patch) {
  try {
    var sites = readAll();
    var idx = sites.findIndex(function(s){ return s.siteId === siteId; });
    if (idx < 0) return null;
    sites[idx] = Object.assign({}, sites[idx], patch);
    if (patch.wordpress) sites[idx].wordpress = Object.assign({}, sites[idx].wordpress, patch.wordpress);
    writeAll(sites);
    return redact(sites[idx]);
  } catch { return null; }
}
