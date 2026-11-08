/**
 * The strength score lives in supabase/functions/_shared/strength-core.ts so
 * the app and the edge functions run the same code. This module keeps the
 * app's import path stable.
 */
export {
  LEGACY_STRENGTH_SCORE_SCALE,
  LEVEL_POINT_ANCHORS,
  OVERALL_STRENGTH_SCORE_CAP,
  STRENGTH_SCORE_MAX_AHEAD,
  applyStrengthScoreRounding,
  calculateExerciseStrengthPoints,
  calculateOverallStrengthScore,
  calculateOverallStrengthScoreDeltaForSession,
  calculateStrengthScoreHistory,
  calculateStrengthScoreProjectionForExerciseLevel,
  calculateStrengthScoreProjectionForExerciseTarget,
  getLatestStrengthIncreaseSession,
  getOverallStrengthGroupLevelProgress,
  getStrengthLevelTargetPerformance,
  getTrainingFrequencyWeight,
  resolveCachedStrengthPoints,
  scoreToOverallLevelProgress,
  toLegacyStrengthScore,
} from '../supabase/functions/_shared/strength-core'
export type {
  LatestStrengthIncreaseSession,
  OverallStrengthBest1RMSnapshot,
  OverallStrengthExerciseInput,
  OverallStrengthGroup,
  OverallStrengthGroupBreakdown,
  OverallStrengthScoreDeltaForSessionResult,
  OverallStrengthScoreResult,
  StrengthHistorySession,
  StrengthScoreHistoryResult,
  StrengthScoreHistoryStep,
  StrengthScoreProjectionResult,
} from '../supabase/functions/_shared/strength-core'
