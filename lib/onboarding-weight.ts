import { database } from '@/lib/database'

const isValidWeightKg = (weightKg: number | null | undefined): weightKg is number =>
  typeof weightKg === 'number' && Number.isFinite(weightKg) && weightKg > 0

export async function persistOnboardingWeight(
  userId: string,
  weightKg: number | null | undefined,
) {
  if (!userId || !isValidWeightKg(weightKg)) {
    return
  }

  try {
    await database.dailyLog.updateDay(userId, { weightKg })
  } catch (error) {
    console.warn('[OnboardingWeight] Failed to save onboarding weight to daily log:', error)
  }
}
