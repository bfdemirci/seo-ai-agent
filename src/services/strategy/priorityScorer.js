export function scoreKeywordOpportunity({ keyword, volume, keywordDifficulty, existingArticle }) {
  volume            = volume            || 0;
  keywordDifficulty = keywordDifficulty || 0;

  var base = (volume / 100) - (keywordDifficulty * 0.5);

  var type, recommendedAction, adjustment, reason;

  if (!existingArticle) {
    type               = 'new';
    recommendedAction  = 'create';
    adjustment         = 12;
    reason             = volume > 1000 ? 'high volume, no existing content' : 'keyword not yet covered';
  } else {
    type = 'existing';
    var pos = existingArticle.position || 99;
    if (pos > 10) {
      recommendedAction = 'refresh';
      adjustment        = 10;
      reason            = 'existing content underperforming beyond page 1 (pos ' + pos.toFixed(1) + ')';
    } else if (pos >= 5) {
      recommendedAction = 'expand';
      adjustment        = 5;
      reason            = 'already ranking, expansion potential (pos ' + pos.toFixed(1) + ')';
    } else {
      recommendedAction = 'monitor';
      adjustment        = -8;
      reason            = 'already performing well, lower urgency (pos ' + pos.toFixed(1) + ')';
    }
  }

  var priorityScore = parseFloat(Math.min(Math.max(base + adjustment, 0), 100).toFixed(2));

  return { keyword, type, priorityScore, reason, recommendedAction };
}
