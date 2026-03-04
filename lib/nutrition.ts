import type { Profile } from '@/types/database.types'

/**
 * Calculates maintenance (TDEE) calories using the Mifflin-St Jeor BMR formula
 * with a lightly-active multiplier (1.375), which suits a gym-going user.
 *
 * Returns null when the profile is missing key stats.
 */
export function calculateMaintenanceCalories(profile: Profile | null): number | null {
  if (
    !profile?.weight_kg ||
    !profile?.height_cm ||
    !profile?.age ||
    !profile?.gender
  ) {
    return null
  }

  const { weight_kg, height_cm, age, gender } = profile

  // Mifflin-St Jeor BMR
  let bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age
  bmr += gender === 'male' ? 5 : -161

  // Lightly active (1–3 days/week exercise) — sensible default for a fitness app user
  return Math.round(bmr * 1.375)
}

/**
 * Returns the effective calorie goal: the stored goal if set, otherwise
 * the user's maintenance calories, or a generic fallback of 2000.
 */
export function resolveCalorieGoal(
  storedGoal: number | null | undefined,
  profile: Profile | null,
): number {
  if (storedGoal != null && storedGoal > 0) return storedGoal
  const maintenance = calculateMaintenanceCalories(profile)
  return maintenance ?? 2000
}
