/**
 * Turns a user's raw rows (logged sets, onboarding lift, bodyweight) into the
 * strength score's inputs. Shared by the app loader (lib/strength-inputs.ts)
 * and the edge-function loader (strength.ts) so both score the same data.
 *
 * Pure TypeScript, like strength-core.ts: no Deno, Supabase or npm imports.
 */
import {
  estimateOneRepMaxKg,
  getStrengthStandardsConfig,
  hasStrengthStandards,
  isRepBasedStrengthExercise,
  type OverallStrengthBest1RMSnapshot,
  type StrengthHistorySession,
} from './strength-core.ts'

// ---------------------------------------------------------------------------
// Row shapes and selects
// ---------------------------------------------------------------------------

export interface StrengthSetRow {
  reps: number | null
  weight: number | null
}

export interface StrengthExerciseRow {
  id?: string | null
  name?: string | null
  muscle_group?: string | null
  gif_url?: string | null
}

export interface StrengthWorkoutExerciseRow {
  exercise_id?: string | null
  exercise?: StrengthExerciseRow | StrengthExerciseRow[] | null
  sets?: StrengthSetRow[] | null
}

export interface StrengthSessionRow {
  id?: string | null
  date?: string | null
  created_at: string
  workout_exercises?: StrengthWorkoutExerciseRow[] | null
}

/**
 * workout_sessions select for buildStrengthInputsFromRows. Callers also filter
 * `.eq('user_id', id).not('workout_exercises.sets.reps', 'is', null)
 * .gt('workout_exercises.sets.reps', 0)`.
 */
export const STRENGTH_SESSIONS_SELECT = `
  id,
  date,
  created_at,
  workout_exercises!inner (
    exercise_id,
    exercise:exercises!inner (id, name, muscle_group, gif_url),
    sets!inner (reps, weight)
  )
`

export interface OnboardingStrengthSnapshotRow {
  exercise_id: string
  working_weight_kg: number | string | null
  reps: number | null
  estimated_1rm_kg: number | string | null
  created_at: string
  updated_at: string | null
  exercise?: StrengthExerciseRow | StrengthExerciseRow[] | null
}

/** onboarding_strength_snapshots select for parseOnboardingStrengthSnapshotRow. */
export const ONBOARDING_STRENGTH_SNAPSHOT_SELECT = `
  exercise_id,
  working_weight_kg,
  reps,
  estimated_1rm_kg,
  created_at,
  updated_at,
  exercise:exercises!inner (
    id,
    name,
    muscle_group,
    gif_url
  )
`

/** The lift a user entered during onboarding. */
export interface OnboardingStrengthSnapshot {
  exerciseId: string
  exerciseName: string
  muscleGroup: string | null
  gifUrl: string | null
  workingWeightKg: number
  reps: number
  estimated1RMKg: number
  recordedAt: string
}

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------

export interface StrengthRecordShape {
  weight: number
  maxReps: number
  date: string
  estimated1RM: number
}

export interface StrengthExerciseDataShape {
  exerciseId: string
  exerciseName: string
  muscleGroup: string | null
  max1RM: number
  lastTrainedAt?: string | null
  gifUrl?: string | null
  records: StrengthRecordShape[]
  /** Workouts this lift was logged in; absent for an onboarding-only lift. */
  sessionCount?: number | null
}

export interface StrengthInputExercise extends StrengthExerciseDataShape {
  lastTrainedAt: string | null
  gifUrl: string | null
}

export interface StrengthInputs {
  /** Standards lifts with a best above zero, plus the onboarding lift. */
  exercises: StrengthInputExercise[]
  /** Per-workout bests in chronological order, for the history replay. */
  sessions: StrengthHistorySession[]
  /** Current and previous best per exercise (every logged exercise). */
  best1RMSnapshotByExerciseId: Record<string, OverallStrengthBest1RMSnapshot>
}

// ---------------------------------------------------------------------------
// Bodyweight
// ---------------------------------------------------------------------------

export function coerceBodyweightKg(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  return null
}

/** Bodyweight for scoring: latest daily-log weight, else the profile weight. */
export function resolveStrengthBodyweightKg(input: {
  latestDailyWeightKg: unknown
  profileWeightKg: unknown
}): number | null {
  return (
    coerceBodyweightKg(input.latestDailyWeightKg) ??
    coerceBodyweightKg(input.profileWeightKg)
  )
}

// ---------------------------------------------------------------------------
// Onboarding lift
// ---------------------------------------------------------------------------

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function parseOnboardingStrengthSnapshotRow(
  row: OnboardingStrengthSnapshotRow | null | undefined,
): OnboardingStrengthSnapshot | null {
  if (!row) return null
  const exercise = firstRelation(row.exercise)
  if (!exercise?.name) return null

  return {
    exerciseId: row.exercise_id,
    exerciseName: exercise.name,
    muscleGroup: exercise.muscle_group ?? null,
    gifUrl: exercise.gif_url ?? null,
    workingWeightKg: Number(row.working_weight_kg),
    reps: Number(row.reps),
    estimated1RMKg: Number(row.estimated_1rm_kg),
    recordedAt: row.updated_at ?? row.created_at,
  }
}

function resolveLaterTimestamp(
  left: string | null | undefined,
  right: string | null | undefined,
): string | null {
  if (!left) return right ?? null
  if (!right) return left

  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()

  if (!Number.isFinite(leftTime)) return right
  if (!Number.isFinite(rightTime)) return left

  return rightTime > leftTime ? right : left
}

function mergeRecords(
  records: StrengthRecordShape[],
  onboardingRecord: StrengthRecordShape,
): StrengthRecordShape[] {
  const existingIndex = records.findIndex(
    (record) =>
      record.weight === onboardingRecord.weight &&
      record.date === onboardingRecord.date,
  )

  if (existingIndex === -1) {
    return [...records, onboardingRecord].sort((a, b) => b.weight - a.weight)
  }

  return records.map((record, index) => {
    if (index !== existingIndex) {
      return record
    }

    return {
      ...record,
      maxReps: Math.max(record.maxReps, onboardingRecord.maxReps),
      estimated1RM: Math.max(record.estimated1RM, onboardingRecord.estimated1RM),
    }
  })
}

/**
 * Counts the onboarding lift: it raises an existing lift's best, or adds the
 * lift (with no session count, so it counts as established).
 */
export function mergeOnboardingStrengthSnapshotIntoExerciseData<
  TExercise extends StrengthExerciseDataShape,
>(input: {
  exercises: TExercise[]
  best1RMSnapshotByExerciseId: Record<string, OverallStrengthBest1RMSnapshot>
  snapshot: OnboardingStrengthSnapshot | null
}): {
  exercises: TExercise[]
  best1RMSnapshotByExerciseId: Record<string, OverallStrengthBest1RMSnapshot>
} {
  const { exercises, best1RMSnapshotByExerciseId, snapshot } = input
  const estimated1RM = snapshot ? Math.round(snapshot.estimated1RMKg) : 0

  if (
    !snapshot ||
    !(estimated1RM > 0) ||
    !hasStrengthStandards(snapshot.exerciseName)
  ) {
    return {
      exercises,
      best1RMSnapshotByExerciseId,
    }
  }

  const onboardingRecord: StrengthRecordShape = {
    weight: snapshot.workingWeightKg,
    maxReps: snapshot.reps,
    date: snapshot.recordedAt,
    estimated1RM,
  }

  const existingIndex = exercises.findIndex(
    (exercise) => exercise.exerciseId === snapshot.exerciseId,
  )

  const nextExercises: TExercise[] =
    existingIndex === -1
      ? [
          ...exercises,
          {
            exerciseId: snapshot.exerciseId,
            exerciseName: snapshot.exerciseName,
            muscleGroup: snapshot.muscleGroup,
            max1RM: estimated1RM,
            lastTrainedAt: snapshot.recordedAt,
            gifUrl: snapshot.gifUrl,
            records: [onboardingRecord],
          } as TExercise,
        ]
      : exercises.map((exercise, index) => {
          if (index !== existingIndex) {
            return exercise
          }

          return {
            ...exercise,
            max1RM: Math.max(exercise.max1RM, estimated1RM),
            lastTrainedAt: resolveLaterTimestamp(
              exercise.lastTrainedAt,
              snapshot.recordedAt,
            ),
            gifUrl: exercise.gifUrl ?? snapshot.gifUrl,
            records: mergeRecords(exercise.records, onboardingRecord),
          }
        })

  const existingBest = best1RMSnapshotByExerciseId[snapshot.exerciseId]
  const nextBest1RMSnapshotByExerciseId = {
    ...best1RMSnapshotByExerciseId,
  }
  const mergedExerciseMax1RM =
    nextExercises.find((exercise) => exercise.exerciseId === snapshot.exerciseId)
      ?.max1RM ?? estimated1RM

  if (!existingBest) {
    nextBest1RMSnapshotByExerciseId[snapshot.exerciseId] = {
      currentBest1RM: mergedExerciseMax1RM,
      previousBest1RM: 0,
      lastIncreaseAt: snapshot.recordedAt,
      lastIncreaseSessionId: null,
    }
  } else if (estimated1RM > existingBest.currentBest1RM) {
    nextBest1RMSnapshotByExerciseId[snapshot.exerciseId] = {
      currentBest1RM: estimated1RM,
      previousBest1RM: existingBest.currentBest1RM,
      lastIncreaseAt: snapshot.recordedAt,
      lastIncreaseSessionId: null,
    }
  }

  return {
    exercises: nextExercises,
    best1RMSnapshotByExerciseId: nextBest1RMSnapshotByExerciseId,
  }
}

// ---------------------------------------------------------------------------
// Logged workouts
// ---------------------------------------------------------------------------

interface ParsedLift {
  exerciseId: string
  name: string
  muscleGroup: string | null
  gifUrl: string | null
  /** Valid sets with their performance (kg e1RM, or reps for rep-based lifts). */
  sets: { weight: number | null; reps: number; performance: number }[]
}

interface ParsedSession {
  sessionId: string | null
  createdAt: string
  createdTime: number
  performedTime: number
  recordDate: string
  lifts: ParsedLift[]
}

function toTime(value: string | null | undefined): number {
  return value ? new Date(value).getTime() : Number.NaN
}

function getSetPerformance(
  exerciseName: string,
  set: StrengthSetRow,
): number | null {
  const reps = set.reps
  if (typeof reps !== 'number' || !Number.isFinite(reps) || reps <= 0) {
    return null
  }
  if (isRepBasedStrengthExercise(exerciseName)) return reps

  const weight = set.weight
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    return null
  }
  return estimateOneRepMaxKg(weight, reps)
}

function parseSession(row: StrengthSessionRow): ParsedSession {
  const lifts: ParsedLift[] = []
  row.workout_exercises?.forEach((workoutExercise) => {
    const exercise = firstRelation(workoutExercise.exercise)
    const exerciseId = workoutExercise.exercise_id ?? exercise?.id
    if (!exerciseId || !exercise?.name) return

    const name = exercise.name
    const sets: ParsedLift['sets'] = []
    workoutExercise.sets?.forEach((set) => {
      const performance = getSetPerformance(name, set)
      if (performance === null) return
      sets.push({ weight: set.weight, reps: set.reps as number, performance })
    })

    lifts.push({
      exerciseId,
      name,
      muscleGroup: exercise.muscle_group ?? null,
      gifUrl: exercise.gif_url ?? null,
      sets,
    })
  })

  const createdTime = toTime(row.created_at)
  const performedTime = toTime(row.date || row.created_at)
  return {
    sessionId: row.id ?? null,
    createdAt: row.created_at,
    createdTime,
    performedTime: Number.isFinite(performedTime) ? performedTime : createdTime,
    recordDate: row.date || row.created_at,
    lifts,
  }
}

/**
 * Builds the strength score inputs from workout_sessions rows (selected with
 * STRENGTH_SESSIONS_SELECT) and the onboarding lift. Every best is the rounded
 * estimated 1RM (or reps), so the replay, the per-lift levels and the
 * before/after bests all compare the same numbers.
 */
export function buildStrengthInputsFromRows(input: {
  sessionRows: StrengthSessionRow[]
  onboarding?: OnboardingStrengthSnapshot | null
}): StrengthInputs {
  const parsed = input.sessionRows.map(parseSession)

  // Lift totals and per-weight records, in the order the workouts were saved.
  const byCreated = [...parsed].sort((a, b) => a.createdTime - b.createdTime)
  const exerciseById = new Map<
    string,
    StrengthInputExercise & { recordsByWeight: Map<number, StrengthRecordShape> }
  >()

  byCreated.forEach((session) => {
    const loggedThisSession = new Set<string>()

    session.lifts.forEach((lift) => {
      if (!hasStrengthStandards(lift.name)) return

      let current = exerciseById.get(lift.exerciseId)
      if (!current) {
        current = {
          exerciseId: lift.exerciseId,
          exerciseName: lift.name,
          muscleGroup: lift.muscleGroup,
          max1RM: 0,
          lastTrainedAt: session.createdAt,
          sessionCount: 0,
          gifUrl: lift.gifUrl || getStrengthStandardsConfig(lift.name)?.gifUrl || null,
          records: [],
          recordsByWeight: new Map(),
        }
        exerciseById.set(lift.exerciseId, current)
      }

      if (
        !current.lastTrainedAt ||
        session.createdTime > new Date(current.lastTrainedAt).getTime()
      ) {
        current.lastTrainedAt = session.createdAt
      }

      const isRepBased = isRepBasedStrengthExercise(lift.name)
      lift.sets.forEach((set) => {
        const rounded = Math.round(set.performance)
        if (rounded > current.max1RM) current.max1RM = rounded
        loggedThisSession.add(lift.exerciseId)

        const weightKey = isRepBased ? 0 : (set.weight as number)
        const existingRecord = current.recordsByWeight.get(weightKey)
        if (!existingRecord || set.reps > existingRecord.maxReps) {
          current.recordsByWeight.set(weightKey, {
            weight: weightKey,
            maxReps: set.reps,
            date: session.recordDate,
            estimated1RM: rounded,
          })
        }
      })
    })

    loggedThisSession.forEach((exerciseId) => {
      const tracked = exerciseById.get(exerciseId)
      if (tracked) tracked.sessionCount = (tracked.sessionCount ?? 0) + 1
    })
  })

  // History and before/after bests, in the order the workouts were performed.
  const byPerformed = [...parsed].sort(
    (a, b) => a.performedTime - b.performedTime || a.createdTime - b.createdTime,
  )
  const sessions: StrengthHistorySession[] = []
  const best1RMSnapshotByExerciseId: Record<string, OverallStrengthBest1RMSnapshot> = {}

  byPerformed.forEach((session) => {
    const sessionBests: Record<string, number> = {}
    const scoredBests: Record<string, number> = {}

    session.lifts.forEach((lift) => {
      const isScored = hasStrengthStandards(lift.name)
      lift.sets.forEach((set) => {
        const rounded = Math.round(set.performance)
        if (rounded > (sessionBests[lift.exerciseId] ?? 0)) {
          sessionBests[lift.exerciseId] = rounded
        }
        if (isScored && rounded > (scoredBests[lift.exerciseId] ?? 0)) {
          scoredBests[lift.exerciseId] = rounded
        }
      })
    })

    Object.entries(sessionBests).forEach(([exerciseId, sessionBest]) => {
      const current = (best1RMSnapshotByExerciseId[exerciseId] ??= {
        currentBest1RM: 0,
        previousBest1RM: 0,
        lastIncreaseAt: null,
        lastIncreaseSessionId: null,
      })
      if (sessionBest > current.currentBest1RM) {
        current.previousBest1RM = current.currentBest1RM
        current.currentBest1RM = sessionBest
        current.lastIncreaseAt = session.createdAt
        current.lastIncreaseSessionId = session.sessionId
      }
    })

    if (Object.keys(scoredBests).length > 0) {
      sessions.push({ sessionId: session.sessionId, exerciseBests: scoredBests })
    }
  })

  const exercises: StrengthInputExercise[] = Array.from(exerciseById.values())
    .filter((exercise) => exercise.max1RM > 0)
    .map(({ recordsByWeight, ...exercise }) => ({
      ...exercise,
      records: Array.from(recordsByWeight.values()).sort(
        (a, b) => b.weight - a.weight,
      ),
    }))

  const merged = mergeOnboardingStrengthSnapshotIntoExerciseData({
    exercises,
    best1RMSnapshotByExerciseId,
    snapshot: input.onboarding ?? null,
  })

  return {
    exercises: merged.exercises,
    sessions,
    best1RMSnapshotByExerciseId: merged.best1RMSnapshotByExerciseId,
  }
}

/**
 * The set behind a lift's best: the heaviest record whose estimate equals the
 * best. Weight is null for rep-based lifts.
 */
export function getBestSetFromRecords(
  exercise: Pick<StrengthExerciseDataShape, 'exerciseName' | 'max1RM' | 'records'>,
): { weightKg: number | null; reps: number | null } {
  const record = exercise.records.find(
    (candidate) => candidate.estimated1RM === exercise.max1RM,
  )
  if (!record) return { weightKg: null, reps: null }
  return {
    weightKg: isRepBasedStrengthExercise(exercise.exerciseName)
      ? null
      : record.weight,
    reps: record.maxReps,
  }
}
