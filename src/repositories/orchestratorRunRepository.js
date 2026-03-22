import fs from 'fs';
import path from 'path';

var RUNS_DIR = path.join(process.cwd(), 'storage', 'orchestrator-runs');

function ensureDir() {
  if (!fs.existsSync(RUNS_DIR)) {
    fs.mkdirSync(RUNS_DIR, { recursive: true });
  }
}

export function saveRun(run) {
  ensureDir();
  var filePath = path.join(RUNS_DIR, run.runId + '.json');
  fs.writeFileSync(filePath, JSON.stringify(run, null, 2), 'utf8');
  return run;
}

export function getRunById(runId) {
  ensureDir();
  var filePath = path.join(RUNS_DIR, runId + '.json');
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

export function listRuns(opts) {
  var limit = (opts && opts.limit) || 50;
  var offset = (opts && opts.offset) || 0;
  ensureDir();
  var files = fs.readdirSync(RUNS_DIR)
    .filter(function(f) { return f.endsWith('.json'); })
    .sort()
    .reverse();
  var total = files.length;
  var items = files.slice(offset, offset + limit).map(function(f) {
    try { return JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), 'utf8')); }
    catch (e) { return null; }
  }).filter(function(r) { return r !== null; });
  return { items: items, total: total };
}
