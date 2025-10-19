export interface BodyLogAnalysisSnapshot {
  date: string
  weight: string
  bodyfat: string
  bmi: string
}

const PLACEHOLDER_SNAPSHOT: BodyLogAnalysisSnapshot = {
  date: 'July 12, 2025',
  weight: '182 lb',
  bodyfat: '18.4%',
  bmi: '25.1',
}

export function getPlaceholderBodyLogAnalysis(): BodyLogAnalysisSnapshot {
  return { ...PLACEHOLDER_SNAPSHOT }
}
