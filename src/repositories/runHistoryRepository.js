import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE   = path.resolve(__dirname, '..', '..', 'storage', 'run-history');
const FILE      = path.join(STORAGE, 'runs.json');
const MAX_RUNS  = 100;

function ensureFile() {
  if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]\n', 'utf8');
}

function readAll() {
  ensureFile();
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function writeAll(runs) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(runs, null, 2) + '\n', 'utf8');
}

export function saveRunHistory(run) {
  try {
    const runs = readAll();
    runs.unshift(run); // newest first
    if (runs.length > MAX_RUNS) runs.splice(MAX_RUNS);
    writeAll(runs);
    return run;
  } catch (_) { return null; }
}

export function listRunHistory({ limit = 20, offset = 0 } = {}) {
  try {
    const runs = readAll();
    const total = runs.length;
    const items = runs.slice(offset, offset + limit);
    return { items, total };
  } catch { return { items: [], total: 0 }; }
}

export function getRunHistoryById(runId) {
  try {
    const runs = readAll();
    return runs.find(r => r.runId === runId) || null;
  } catch { return null; }
}
