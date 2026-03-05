import { database } from '@/lib/database'
import {
  calculateOverallStrengthScoreDeltaForSession,
  getLatestStrengthIncreaseSession,
  type OverallStrengthBest1RMSnapshot,
  type OverallStrengthExerciseInput,
  type OverallStrengthScoreDeltaForSessionResult,
} from '@/lib/overall-strength-score'
import {
  getStrengthGender,
  type StrengthGender,
} from '@/lib/strength-progress'
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
  const { profile, strengthGender, exercises, best1RMSnapshotByExerciseId } =
    context

  if (
    !strengthGender ||
    !profile?.weight_kg ||
    !Number.isFinite(profile.weight_kg) ||
    profile.weight_kg <= 0 ||
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
    bodyweightKg: profile.weight_kg,
    exercises,
    best1RMSnapshotByExerciseId,
    baselineSessionId,
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

export async function loadStrengthScoreDeltaContext<
  TExercise extends OverallStrengthExerciseInput = OverallStrengthExerciseInput,
>(
  userId: string,
  options?: {
    profileOverride?: Profile
  },
): Promise<StrengthScoreDeltaContext<TExercise>> {
  const hasProfileOverride = options?.profileOverride !== undefined
  const profilePromise = hasProfileOverride
    ? Promise.resolve(options?.profileOverride ?? null)
    : database.profiles.getByIdOrNull(userId)

  const [profile, exercises, snapshots] = await Promise.all([
    profilePromise,
    database.stats.getMajorCompoundLiftsData(userId),
    database.stats.getExerciseCurrentAndPreviousBest1RMs(userId),
  ])

  return {
    profile: profile ?? null,
    strengthGender: getStrengthGender(profile?.gender ?? null),
    exercises: exercises as unknown as TExercise[],
    best1RMSnapshotByExerciseId: snapshots,
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
