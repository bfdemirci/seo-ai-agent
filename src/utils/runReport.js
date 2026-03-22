export function makeReport(mode) {
  return {
    mode,
    startedAt:   new Date().toISOString(),
    finishedAt:  null,
    durationMs:  0,
    summary: {
      totalKeywordsInput:    0,
      totalCandidates:       0,
      totalExistingArticles: 0,
      totalArticlesChecked:  0,
      totalDecaying:         0,
      totalHealthy:          0,
      totalWatch:            0,
      totalRecommendations:  0,
    },
    candidates:  [],
    maintenance: [],
    errors:      [],
    meta: {
      safeMode:       true,
      executedWrites: [],
      skippedWrites:  [],
    },
  };
}

export function finishReport(report, t0) {
  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - t0;
  return report;
}
