export interface BodyLogMetrics {
  weight_kg: number | null
  body_fat_percentage: number | null
  bmi: number | null
  muscle_mass_kg: number | null
}

export interface BodyLogRecord {
  id: string
  user_id: string
  file_path: string
  created_at: string
  weight_kg: number | null
  body_fat_percentage: number | null
  bmi: number | null
  muscle_mass_kg: number | null
}

/**
 * Format body fat percentage for display
 */
export function formatBodyFat(percentage: number | null): string {
  if (percentage === null || percentage === undefined) {
    return '--'
  }
  return `${percentage.toFixed(1)}%`
}

/**
 * Format BMI for display
 */
export function formatBMI(bmi: number | null): string {
  if (bmi === null || bmi === undefined) {
    return '--'
  }
  return bmi.toFixed(1)
}

/**
 * Format date for body log display
 */
export function formatBodyLogDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
