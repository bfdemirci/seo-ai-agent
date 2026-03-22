export function decideAction(article) {
  try {
    const snapshots = safeArray(article?.gsc_snapshots).sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    const latest       = getLatest(snapshots);
    const ageDays      = getAgeDays(article?.created_at);
    const position     = safeNum(latest?.position, 999);
    const ctr          = safeNum(latest?.ctr, 0);
    const impressions  = safeNum(latest?.impressions, 0);
    const clicks       = safeNum(latest?.clicks, 0);
    const clicksTrend  = getTrend(snapshots, "clicks");
    const posTrend     = getTrend(snapshots, "position");
    const positionDrop = getPositionDrop(article?.initial_position, position);
    const snapshotCount = snapshots.length;
    const bootstrapMode = snapshotCount < 2;

    const signals = {
      hasData: snapshotCount > 0,
      ageDays, position, ctr, impressions, clicks,
      clicksTrend, posTrend, positionDrop, snapshotCount,
      bootstrapMode,
    };

    const confidence = calcConfidence(impressions, clicksTrend, posTrend, ageDays, snapshotCount);

    // ── Bootstrap mode (< 2 snapshots) ───────────────────────────────────────
    if (bootstrapMode) {
      return bootstrapDecision(signals, confidence);
    }

    // ── Hard gates ────────────────────────────────────────────────────────────
    if (impressions < 10)
      return result("NO_ACTION", "Insufficient impressions", confidence, signals);
    if (ageDays < 7)
      return result("NO_ACTION", "Article too new", confidence, signals);

    // ── KILL ──────────────────────────────────────────────────────────────────
    if (ageDays > 60 && position > 50 && impressions < 20)
      return result("KILL", `Buried at pos ${position.toFixed(0)}, ${ageDays}d old, nearly invisible`, confidence, signals);

    // ── Base action from position ─────────────────────────────────────────────
    let severityIdx = positionSeverity(position);

    if (isCtrLow(ctr, position))        severityIdx = escalate(severityIdx);
    if (clicksTrend === "DOWN")         severityIdx = escalate(severityIdx);
    if (posTrend === "DOWN")            severityIdx = escalate(severityIdx);
    if (positionDrop > 10)              severityIdx = escalate(severityIdx);
    if (clicksTrend === "UP" && posTrend === "UP") severityIdx = deescalate(severityIdx);

    const action = SEVERITY[Math.min(severityIdx, SEVERITY.length - 1)];
    const reason = buildReason(action, position, ctr, clicksTrend, posTrend, positionDrop, ageDays);

    return result(action, reason, confidence, signals);

  } catch (_) {
    return result("NO_ACTION", "Decision error — safe fallback", 0.1, {});
  }
}

// ── Bootstrap decision (single or no snapshot) ───────────────────────────────

function bootstrapDecision(signals, confidence) {
  const { impressions, position, ctr, ageDays } = signals;

  // CASE 1: old article with almost no impressions → delete
  if (impressions < 50 && ageDays > 30)
    return result("DELETE", "Low impressions after 30 days", confidence, signals);

  // CASE 2: low ranking but has impressions → optimize
  if (position > 20 && impressions > 100)
    return result("OPTIMIZE", "Low ranking but has impressions", confidence, signals);

  // CASE 3: good ranking but low CTR → optimize
  if (position <= 5 && ctr < 0.05)
    return result("OPTIMIZE", "Good ranking but low CTR", confidence, signals);

  // CASE 4: good ranking and good CTR → no action
  if (position <= 5 && ctr >= 0.05)
    return result("NO_ACTION", "Performing well", confidence, signals);

  // DEFAULT
  return result("NO_ACTION", "Insufficient data for decision", confidence, signals);
}

// ── Constants ────────────────────────────────────────────────────────────────

const SEVERITY = ["NO_ACTION", "OPTIMIZE", "REFRESH", "REWRITE"];

function positionSeverity(pos) {
  if (pos <= 5)  return 0;
  if (pos <= 15) return 1;
  if (pos <= 40) return 2;
  return 3;
}

function escalate(idx)   { return Math.min(idx + 1, SEVERITY.length - 1); }
function deescalate(idx) { return Math.max(idx - 1, 0); }

const CTR_BENCHMARK = [
  { maxPos: 1,  expected: 0.28 },
  { maxPos: 2,  expected: 0.15 },
  { maxPos: 3,  expected: 0.11 },
  { maxPos: 5,  expected: 0.07 },
  { maxPos: 10, expected: 0.03 },
  { maxPos: 20, expected: 0.01 },
  { maxPos: Infinity, expected: 0.005 },
];

function expectedCtr(position) {
  const bucket = CTR_BENCHMARK.find(b => position <= b.maxPos);
  return bucket ? bucket.expected : 0.005;
}

function isCtrLow(ctr, position) {
  return ctr < expectedCtr(position) * 0.5;
}

function getTrend(snapshots, field) {
  const last = snapshots.slice(-3);
  if (last.length < 3) return "INSUFFICIENT";
  const vals = last.map(s => safeNum(s?.[field], null)).filter(v => v !== null);
  if (vals.length < 3) return "INSUFFICIENT";
  const invert = field === "position";
  const [a, b, c] = vals;
  if (c > b && b > a) return invert ? "DOWN" : "UP";
  if (c < b && b < a) return invert ? "UP"   : "DOWN";
  const delta = c - a;
  const threshold = a * 0.15;
  if (Math.abs(delta) < threshold) return "FLAT";
  if (delta > 0) return invert ? "DOWN" : "UP";
  return invert ? "UP" : "DOWN";
}

function getPositionDrop(initialPosition, currentPosition) {
  const init = safeNum(initialPosition, null);
  if (init === null) return 0;
  return Math.max(0, currentPosition - init);
}

function getLatest(snapshots) {
  if (!snapshots.length) return null;
  return snapshots[snapshots.length - 1];
}

function calcConfidence(impressions, clicksTrend, posTrend, ageDays, snapshotCount) {
  let c = 0.5;
  if (impressions > 500)       c += 0.2;
  else if (impressions > 100)  c += 0.12;
  else if (impressions > 30)   c += 0.06;
  const trendClear = (clicksTrend === "UP" || clicksTrend === "DOWN") &&
                     (posTrend    === "UP" || posTrend    === "DOWN");
  if (trendClear) c += 0.2;
  else if (clicksTrend !== "INSUFFICIENT" || posTrend !== "INSUFFICIENT") c += 0.08;
  if (ageDays > 90)       c += 0.1;
  else if (ageDays > 30)  c += 0.05;
  if (snapshotCount >= 10)     c += 0.05;
  else if (snapshotCount >= 5) c += 0.02;
  return Math.min(parseFloat(c.toFixed(2)), 1.0);
}

function buildReason(action, position, ctr, clicksTrend, posTrend, positionDrop, ageDays) {
  const parts = [`Position ${position.toFixed(1)}`, `CTR ${(ctr * 100).toFixed(2)}%`];
  if (clicksTrend !== "INSUFFICIENT") parts.push(`clicks ${clicksTrend}`);
  if (posTrend    !== "INSUFFICIENT") parts.push(`rank ${posTrend}`);
  if (positionDrop > 10)              parts.push(`dropped ${positionDrop.toFixed(0)} spots`);
  if (ageDays > 30)                   parts.push(`${ageDays}d old`);
  const label = { NO_ACTION:"No action needed", OPTIMIZE:"Optimize meta/content", REFRESH:"Refresh content", REWRITE:"Rewrite required" }[action] ?? action;
  return `${label} — ${parts.join(", ")}`;
}

function result(action, reason, confidence, signals) {
  return { action, reason, confidence, signals };
}

function safeNum(val, fallback = 0) {
  if (val === null || val === undefined) return fallback;
  const n = parseFloat(val);
  return isFinite(n) ? n : fallback;
}

function safeArray(val) {
  return Array.isArray(val) ? val : [];
}

function getAgeDays(dateStr) {
  if (!dateStr) return 0;
  const ms = Date.now() - new Date(dateStr).getTime();
  return isFinite(ms) ? Math.max(0, Math.floor(ms / 86400000)) : 0;
}
