/**
 * The app's single loader for strength score inputs. The Progress screen,
 * the profile level, the post-workout celebration, the mini body view and the
 * cached profile score all load through loadStrengthInputs, and the row
 * shaping is shared with the edge functions (strength-inputs.ts there).
 *
 * Imports only the Supabase client and pure modules, so lib/database.ts can
 * use it without an import cycle.
 */
import { supabase } from './supabase'
import {
  getStrengthGender,
  type StrengthGender,
} from './strength-progress'
import {
  buildStrengthInputsFromRows,
  ONBOARDING_STRENGTH_SNAPSHOT_SELECT,
  parseOnboardingStrengthSnapshotRow,
  resolveStrengthBodyweightKg,
  STRENGTH_SESSIONS_SELECT,
  type OnboardingStrengthSnapshot,
  type OnboardingStrengthSnapshotRow,
  type StrengthInputs,
  type StrengthSessionRow,
} from '../supabase/functions/_shared/strength-inputs'
import type { Profile } from '@/types/database.types'

export interface AppStrengthInputs extends StrengthInputs {
  /** The profile, with weight_kg set to the bodyweight used for scoring. */
  profile: Profile | null
  strengthGender: StrengthGender | null
  bodyweightKg: number | null
}

export async function getOnboardingStrengthSnapshot(
  userId: string,
): Promise<OnboardingStrengthSnapshot | null> {
  if (!userId) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('onboarding_strength_snapshots')
      .select(ONBOARDING_STRENGTH_SNAPSHOT_SELECT)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return parseOnboardingStrengthSnapshotRow(
      data as OnboardingStrengthSnapshotRow | null,
    )
  } catch (error) {
    console.warn(
      '[OnboardingStrength] Failed to load onboarding strength snapshot:',
      error,
    )
    return null
  }
}

async function getLatestDailyWeightKg(userId: string): Promise<unknown> {
  const { data, error } = await supabase
    .from('daily_log_entries')
    .select('weight_kg')
    .eq('user_id', userId)
    .not('weight_kg', 'is', null)
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as { weight_kg: unknown } | null)?.weight_kg ?? null
}

async function getStrengthSessionRows(
  userId: string,
): Promise<StrengthSessionRow[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(STRENGTH_SESSIONS_SELECT)
    .eq('user_id', userId)
    .not('workout_exercises.sets.reps', 'is', null)
    .gt('workout_exercises.sets.reps', 0)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data as unknown as StrengthSessionRow[] | null) ?? []
}

async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return (data as Profile | null) ?? null
}

/**
 * Loads everything the strength score needs for a user: profile, bodyweight
 * (latest daily-log weight, else profiles.weight_kg), logged lifts, workout
 * history, before/after bests and the onboarding lift.
 *
 * The onboarding lift is only readable by its owner (RLS on
 * onboarding_strength_snapshots), so loading another user's inputs leaves it
 * out and their score here can be lower than the one they see themselves and
 * the cached leaderboard score (written by the server, which can read it).
 */
export async function loadStrengthInputs(
  userId: string,
  options?: {
    /** Use this profile instead of fetching it (null means no profile). */
    profileOverride?: Profile | null
  },
): Promise<AppStrengthInputs> {
  const hasProfileOverride = options?.profileOverride !== undefined

  const [rawProfile, latestDailyWeightKg, sessionRows, onboarding] =
    await Promise.all([
      hasProfileOverride
        ? Promise.resolve(options?.profileOverride ?? null)
        : getProfile(userId),
      getLatestDailyWeightKg(userId).catch(() => null),
      getStrengthSessionRows(userId),
      getOnboardingStrengthSnapshot(userId),
    ])

  const bodyweightKg = resolveStrengthBodyweightKg({
    latestDailyWeightKg,
    profileWeightKg: rawProfile?.weight_kg,
  })
  const profile =
    rawProfile && bodyweightKg !== null && bodyweightKg !== rawProfile.weight_kg
      ? { ...rawProfile, weight_kg: bodyweightKg }
      : rawProfile

  return {
    profile,
    strengthGender: getStrengthGender(profile?.gender ?? null),
    bodyweightKg,
    ...buildStrengthInputsFromRows({ sessionRows, onboarding }),
  }
}
