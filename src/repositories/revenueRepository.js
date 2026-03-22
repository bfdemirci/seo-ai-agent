import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE   = path.resolve(__dirname, '..', '..', 'storage', 'revenue');
const FILE      = path.join(STORAGE, 'events.json');
const MAX_EVENTS = 5000;

function ensureFile() {
  if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]\n', 'utf8');
}

function readAll() {
  ensureFile();
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function writeAll(events) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(events, null, 2) + '\n', 'utf8');
}

export function saveRevenueEvent(event) {
  try {
    const events = readAll();
    events.unshift(event);
    if (events.length > MAX_EVENTS) events.splice(MAX_EVENTS);
    writeAll(events);
    return event;
  } catch { return null; }
}

export function listRevenueEvents({ limit = 100, offset = 0 } = {}) {
  try {
    const events = readAll();
    return { items: events.slice(offset, offset + limit), total: events.length };
  } catch { return { items: [], total: 0 }; }
}

export function summarizeRevenue({ siteId, articleId, keyword } = {}) {
  try {
    var events = readAll();
    if (siteId)   events = events.filter(function(e){ return e.siteId   === siteId; });
    if (articleId) events = events.filter(function(e){ return e.articleId === articleId; });
    if (keyword)  events = events.filter(function(e){ return e.keyword  === keyword; });

    var totalValue   = 0;
    var totalEvents  = events.length;
    var leads        = 0;
    var sales        = 0;
    var conversions  = 0;
    var latestEventAt = null;

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      totalValue += (ev.value || 0);
      if (ev.type === 'lead')          leads++;
      if (ev.type === 'sale')          sales++;
      if (ev.type === 'conversion')    conversions++;
      if (!latestEventAt || (ev.timestamp && ev.timestamp > latestEventAt)) latestEventAt = ev.timestamp;
    }

    return { totalValue: parseFloat(totalValue.toFixed(2)), totalEvents, leads, sales, conversions, latestEventAt };
  } catch { return { totalValue: 0, totalEvents: 0, leads: 0, sales: 0, conversions: 0, latestEventAt: null }; }
}

export function getTopByValue({ field = 'siteId', limit = 5 } = {}) {
  try {
    var events = readAll();
    var map = {};
    for (var i = 0; i < events.length; i++) {
      var key = events[i][field];
      if (!key) continue;
      map[key] = (map[key] || 0) + (events[i].value || 0);
    }
    return Object.entries(map)
      .sort(function(a, b){ return b[1] - a[1]; })
      .slice(0, limit)
      .map(function(e){ return { key: e[0], totalValue: parseFloat(e[1].toFixed(2)) }; });
  } catch { return []; }
}
