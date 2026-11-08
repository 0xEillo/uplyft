import { coerceBodyweightKg } from '@/lib/bodyweight'
import { loadStrengthInputs } from '@/lib/strength-inputs'
import {
  calculateOverallStrengthScoreDeltaForSession,
  getLatestStrengthIncreaseSession,
  type OverallStrengthBest1RMSnapshot,
  type OverallStrengthExerciseInput,
  type OverallStrengthScoreDeltaForSessionResult,
  type StrengthHistorySession,
} from '@/lib/overall-strength-score'
import type { StrengthGender } from '@/lib/strength-progress'
import type { Profile } from '@/types/database.types'

export const STRENGTH_SCORE_DELTA_SEMANTICS = {
  postedWorkoutSession: 'postedWorkoutSession',
  latestIncreaseSession: 'latestIncreaseSession',
} as const

export type StrengthScoreDeltaSemantics =
  (typeof STRENGTH_SCORE_DELTA_SEMANTICS)[keyof typeof STRENGTH_SCORE_DELTA_SEMANTICS]

export interface StrengthScoreDeltaContext<
  TExercise extends OverallStrengthExerciseInput = OverallStrengthExerciseInput,
> {
  profile: Profile | null
  strengthGender: StrengthGender | null
  exercises: TExercise[]
  best1RMSnapshotByExerciseId: Record<string, OverallStrengthBest1RMSnapshot>
  /** Per-workout history used to replay the displayed score. */
  sessions?: StrengthHistorySession[]
}

export interface StrengthScoreDeltaResult
  extends OverallStrengthScoreDeltaForSessionResult {
  semantics: StrengthScoreDeltaSemantics
  baselineSessionId: string | null
  lastIncreaseAt: string | null
}

interface ResolveBaselineSessionInput {
  semantics: StrengthScoreDeltaSemantics
  postedWorkoutSessionId?: string | null
  exercises: OverallStrengthExerciseInput[]
  best1RMSnapshotByExerciseId: Record<string, OverallStrengthBest1RMSnapshot>
}

function findLatestIncreaseAtForSession(
  snapshots: Record<string, OverallStrengthBest1RMSnapshot>,
  sessionId: string | null,
): string | null {
  if (!sessionId) return null

  let latest: string | null = null
  let latestTime = Number.NEGATIVE_INFINITY

  Object.values(snapshots).forEach((snapshot) => {
    if (
      snapshot.lastIncreaseSessionId !== sessionId ||
      !snapshot.lastIncreaseAt
    ) {
      return
    }

    const parsedTime = new Date(snapshot.lastIncreaseAt).getTime()
    if (!Number.isFinite(parsedTime)) return

    if (parsedTime > latestTime) {
      latestTime = parsedTime
      latest = snapshot.lastIncreaseAt
    }
  })

  return latest
}

function resolveBaselineSession({
  semantics,
  postedWorkoutSessionId,
  exercises,
  best1RMSnapshotByExerciseId,
}: ResolveBaselineSessionInput): { baselineSessionId: string | null; lastIncreaseAt: string | null } {
  if (semantics === STRENGTH_SCORE_DELTA_SEMANTICS.postedWorkoutSession) {
    const baselineSessionId = postedWorkoutSessionId ?? null
    return {
      baselineSessionId,
      lastIncreaseAt: findLatestIncreaseAtForSession(
        best1RMSnapshotByExerciseId,
        baselineSessionId,
      ),
    }
  }

  const latest = getLatestStrengthIncreaseSession({
    exercises,
    best1RMSnapshotByExerciseId,
  })

  return {
    baselineSessionId: latest.sessionId,
    lastIncreaseAt: latest.lastIncreaseAt,
  }
}

export function calculateStrengthScoreDelta(
  input: {
    semantics: StrengthScoreDeltaSemantics
    context: StrengthScoreDeltaContext
    postedWorkoutSessionId?: string | null
    now?: Date
  },
): StrengthScoreDeltaResult | null {
  const { semantics, context, postedWorkoutSessionId, now } = input
  const {
    profile,
    strengthGender,
    exercises,
    best1RMSnapshotByExerciseId,
    sessions,
  } = context
  const bodyweightKg = coerceBodyweightKg(profile?.weight_kg)

  if (
    !strengthGender ||
    !bodyweightKg ||
    exercises.length === 0
  ) {
    return null
  }

  if (
    semantics === STRENGTH_SCORE_DELTA_SEMANTICS.postedWorkoutSession &&
    !postedWorkoutSessionId
  ) {
    return null
  }

  const { baselineSessionId, lastIncreaseAt } = resolveBaselineSession({
    semantics,
    postedWorkoutSessionId,
    exercises,
    best1RMSnapshotByExerciseId,
  })

  const scoreDelta = calculateOverallStrengthScoreDeltaForSession({
    gender: strengthGender,
    bodyweightKg,
    exercises,
    best1RMSnapshotByExerciseId,
    baselineSessionId,
    sessions,
    now,
  })

  if (scoreDelta.currentResult.liftsTracked === 0) {
    return null
  }

  return {
    ...scoreDelta,
    semantics,
    baselineSessionId,
    lastIncreaseAt,
  }
}

/**
 * Loads the strength score inputs (see lib/strength-inputs.ts). Every app
 * screen that shows a strength score loads through here, so they all count
 * the onboarding lift and use the same bodyweight.
 */
export async function loadStrengthScoreDeltaContext<
  TExercise extends OverallStrengthExerciseInput = OverallStrengthExerciseInput,
>(
  userId: string,
  options?: {
    profileOverride?: Profile
  },
): Promise<StrengthScoreDeltaContext<TExercise>> {
  const inputs = await loadStrengthInputs(
    userId,
    options?.profileOverride === undefined
      ? undefined
      : { profileOverride: options.profileOverride },
  )

  return {
    profile: inputs.profile,
    strengthGender: inputs.strengthGender,
    exercises: inputs.exercises as unknown as TExercise[],
    best1RMSnapshotByExerciseId: inputs.best1RMSnapshotByExerciseId,
    sessions: inputs.sessions,
  }
}

export async function loadAndCalculateStrengthScoreDelta(
  input: {
    userId: string
    semantics: StrengthScoreDeltaSemantics
    postedWorkoutSessionId?: string | null
    profileOverride?: Profile
    now?: Date
  },
): Promise<StrengthScoreDeltaResult | null> {
  const {
    userId,
    semantics,
    postedWorkoutSessionId,
    profileOverride,
    now,
  } = input

  const context =
    profileOverride === undefined
      ? await loadStrengthScoreDeltaContext(userId)
      : await loadStrengthScoreDeltaContext(userId, { profileOverride })

  return calculateStrengthScoreDelta({
    semantics,
    context,
    postedWorkoutSessionId,
    now,
  })
}
