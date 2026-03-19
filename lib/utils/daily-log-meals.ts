import type { DailyLogMeal } from '@/types/database.types'

export const DAILY_LOG_MEAL_IMAGE_PATH_KEY = 'meal_image_path'

type DailyLogMealMetadata = Record<string, unknown> | null | undefined

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getMetadataValue(
  mealOrMetadata: DailyLogMeal | DailyLogMealMetadata,
): DailyLogMealMetadata {
  if (isRecord(mealOrMetadata) && 'metadata' in mealOrMetadata) {
    return isRecord(mealOrMetadata.metadata) ? mealOrMetadata.metadata : null
  }

  return isRecord(mealOrMetadata) ? mealOrMetadata : null
}

export function getDailyLogMealImagePath(
  mealOrMetadata: DailyLogMeal | DailyLogMealMetadata,
): string | null {
  const metadata = getMetadataValue(mealOrMetadata)
  const value = metadata?.[DAILY_LOG_MEAL_IMAGE_PATH_KEY]

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function withDailyLogMealImagePath(
  metadata: DailyLogMealMetadata,
  imagePath: string | null,
): Record<string, unknown> {
  const nextMetadata = isRecord(metadata) ? { ...metadata } : {}

  if (!imagePath) {
    delete nextMetadata[DAILY_LOG_MEAL_IMAGE_PATH_KEY]
    return nextMetadata
  }

  nextMetadata[DAILY_LOG_MEAL_IMAGE_PATH_KEY] = imagePath
  return nextMetadata
}
