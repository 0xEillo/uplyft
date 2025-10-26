import type { SupabaseClient } from './supabase.ts'

interface SetRow {
  reps: number | null
  weight: number | null
}

interface WorkoutExerciseRow {
  exercise_id?: string
  exercise?: {
    id?: string
    name?: string | null
    muscle_group?: string | null
  } | null
  sets?: SetRow[] | null
}

interface WorkoutSessionRow {
  id: string
  created_at: string
  date?: string | null
  workout_exercises?: WorkoutExerciseRow[] | null
}

export interface StrengthSeriesPoint {
  date: string
  est1RM: number
}

export interface StrengthSeries {
  exerciseId: string
  exerciseName: string
  series: StrengthSeriesPoint[]
}

export interface StrengthScorePoint {
  date: string
  strengthScore: number
}

export interface MuscleGroupDistributionItem {
  muscleGroup: string
  volume: number
  percentage: number
}

export interface MuscleGroupDistribution {
  distribution: MuscleGroupDistributionItem[]
  totalVolume: number
}

export interface ExercisePercentileResult {
  exerciseId: string
  exerciseName: string
  percentile: number | null
  totalUsers: number
  userMax1RM: number | null
  gender?: string | null
  genderPercentile?: number | null
  genderTotalUsers?: number
  weightBucketStart?: number | null
  weightBucketEnd?: number | null
  genderWeightPercentile?: number | null
  genderWeightTotalUsers?: number
}

const DEFAULT_MAX_SESSIONS = 250

function clampDaysBack(daysBack?: number): number | undefined {
  if (typeof daysBack !== 'number' || Number.isNaN(daysBack)) return undefined
  if (daysBack <= 0) return undefined
  return Math.min(Math.max(Math.floor(daysBack), 7), 365)
}

function calculateEpley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase()
}

export async function getExerciseStrengthProgressByName(
  supabase: SupabaseClient,
  userId: string,
  exerciseName: string,
  options: { daysBack?: number; maxSessions?: number } = {},
): Promise<StrengthSeries | null> {
  const trimmed = exerciseName?.trim()
  if (!trimmed) return null

  const daysBack = clampDaysBack(options.daysBack)
  const maxSessions = Math.min(
    Math.max(options.maxSessions ?? DEFAULT_MAX_SESSIONS, 20),
    DEFAULT_MAX_SESSIONS,
  )

  let query = supabase
    .from('workout_sessions')
    .select(
      `
        id,
        created_at,
        workout_exercises!inner (
          exercise_id,
          exercise:exercises!inner (id, name),
          sets!inner (reps, weight)
        )
      `,
    )
    .eq('user_id', userId)
    .ilike('workout_exercises.exercise.name', trimmed)
    .not('workout_exercises.sets.weight', 'is', null)
    .not('workout_exercises.sets.reps', 'is', null)
    .gt('workout_exercises.sets.reps', 0)
    .order('created_at', { ascending: true })
    .limit(maxSessions)

  if (daysBack) {
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - daysBack)
    query = query.gte('created_at', cutoff.toISOString())
  }

  const { data, error } = await query
  if (error) throw error
  const sessions = (data as WorkoutSessionRow[]) ?? []
  if (sessions.length === 0) return null

  const target = normaliseName(trimmed)

  let exerciseId = ''
  let displayName = trimmed
  let runningMax = 0

  const series: StrengthSeriesPoint[] = []

  sessions.forEach((session) => {
    session.workout_exercises?.forEach((we) => {
      const name = we.exercise?.name
      if (!name || normaliseName(name) !== target) return

      exerciseId = we.exercise?.id ?? we.exercise_id ?? exerciseId
      displayName = name

      we.sets?.forEach((set) => {
        if (typeof set.weight !== 'number' || typeof set.reps !== 'number') {
          return
        }

        const est1RM = calculateEpley1RM(set.weight, set.reps)
        if (est1RM > runningMax) {
          runningMax = est1RM
        }
      })
    })

    if (runningMax > 0) {
      series.push({
        date: session.created_at,
        est1RM: Math.round(runningMax * 10) / 10,
      })
    }
  })

  if (!exerciseId || series.length === 0) {
    return null
  }

  return {
    exerciseId,
    exerciseName: displayName,
    series,
  }
}

export async function getStrengthScoreProgress(
  supabase: SupabaseClient,
  userId: string,
  options: { daysBack?: number; maxSessions?: number } = {},
): Promise<StrengthScorePoint[]> {
  const daysBack = clampDaysBack(options.daysBack)
  const maxSessions = Math.min(
    Math.max(options.maxSessions ?? DEFAULT_MAX_SESSIONS, 20),
    DEFAULT_MAX_SESSIONS,
  )

  let query = supabase
    .from('workout_sessions')
    .select(
      `
        id,
        created_at,
        workout_exercises!inner (
          exercise_id,
          sets!inner (reps, weight)
        )
      `,
    )
    .eq('user_id', userId)
    .not('workout_exercises.sets.weight', 'is', null)
    .not('workout_exercises.sets.reps', 'is', null)
    .gt('workout_exercises.sets.reps', 0)
    .order('created_at', { ascending: true })
    .limit(maxSessions)

  if (daysBack) {
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - daysBack)
    query = query.gte('created_at', cutoff.toISOString())
  }

  const { data, error } = await query
  if (error) throw error

  const sessions = (data as WorkoutSessionRow[]) ?? []
  if (sessions.length === 0) return []

  const bestByExercise = new Map<string, number>()
  const series: StrengthScorePoint[] = []

  sessions.forEach((session) => {
    session.workout_exercises?.forEach((we) => {
      const exerciseId = we.exercise_id ?? we.exercise?.id
      if (!exerciseId) return

      we.sets?.forEach((set) => {
        if (typeof set.weight !== 'number' || typeof set.reps !== 'number') {
          return
        }
        const est1RM = calculateEpley1RM(set.weight, set.reps)
        const currentBest = bestByExercise.get(exerciseId) ?? 0
        if (est1RM > currentBest) {
          bestByExercise.set(exerciseId, est1RM)
        }
      })
    })

    if (bestByExercise.size > 0) {
      const strengthScore = Array.from(bestByExercise.values()).reduce(
        (sum, val) => sum + val,
        0,
      )
      series.push({
        date: session.created_at,
        strengthScore: Math.round(strengthScore),
      })
    }
  })

  return series
}

export async function getMuscleGroupDistribution(
  supabase: SupabaseClient,
  userId: string,
  options: { daysBack?: number; maxSessions?: number } = {},
): Promise<MuscleGroupDistribution> {
  const daysBack = clampDaysBack(options.daysBack)
  const maxSessions = Math.min(
    Math.max(options.maxSessions ?? DEFAULT_MAX_SESSIONS, 20),
    DEFAULT_MAX_SESSIONS,
  )

  let query = supabase
    .from('workout_sessions')
    .select(
      `
        id,
        created_at,
        workout_exercises!inner (
          exercise:exercises!inner (muscle_group),
          sets!inner (reps, weight)
        )
      `,
    )
    .eq('user_id', userId)
    .not('workout_exercises.exercise.muscle_group', 'is', null)
    .order('created_at', { ascending: false })
    .limit(maxSessions)

  if (daysBack) {
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - daysBack)
    query = query.gte('created_at', cutoff.toISOString())
  }

  const { data, error } = await query
  if (error) throw error

  const sessions = (data as WorkoutSessionRow[]) ?? []

  const volumeByGroup = new Map<string, number>()

  sessions.forEach((session) => {
    session.workout_exercises?.forEach((we) => {
      const muscleGroup = we.exercise?.muscle_group
      if (!muscleGroup) return

      we.sets?.forEach((set) => {
        if (typeof set.weight !== 'number' || typeof set.reps !== 'number') {
          return
        }
        const volume = set.weight * set.reps
        volumeByGroup.set(
          muscleGroup,
          (volumeByGroup.get(muscleGroup) ?? 0) + volume,
        )
      })
    })
  })

  const totalVolume = Array.from(volumeByGroup.values()).reduce(
    (sum, val) => sum + val,
    0,
  )

  const distribution = Array.from(volumeByGroup.entries())
    .map(([muscleGroup, volume]) => ({
      muscleGroup,
      volume: Math.round(volume),
      percentage:
        totalVolume > 0 ? Math.round((volume / totalVolume) * 100) : 0,
    }))
    .sort((a, b) => b.volume - a.volume)

  return { distribution, totalVolume: Math.round(totalVolume) }
}

export async function getTopExercisesByEstimated1RM(
  supabase: SupabaseClient,
  userId: string,
  options: { limit?: number; daysBack?: number } = {},
): Promise<StrengthSeries[]> {
  const limit = Math.min(Math.max(options.limit ?? 3, 1), 5)
  const daysBack = clampDaysBack(options.daysBack)
  const maxSessions = DEFAULT_MAX_SESSIONS

  let query = supabase
    .from('workout_sessions')
    .select(
      `
        id,
        created_at,
        workout_exercises!inner (
          exercise:exercises!inner (id, name),
          sets!inner (reps, weight)
        )
      `,
    )
    .eq('user_id', userId)
    .not('workout_exercises.exercise.id', 'is', null)
    .not('workout_exercises.sets.weight', 'is', null)
    .not('workout_exercises.sets.reps', 'is', null)
    .gt('workout_exercises.sets.reps', 0)
    .order('created_at', { ascending: true })
    .limit(maxSessions)

  if (daysBack) {
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - daysBack)
    query = query.gte('created_at', cutoff.toISOString())
  }

  const { data, error } = await query
  if (error) throw error

  const sessions = (data as WorkoutSessionRow[]) ?? []

  const bestByExercise = new Map<string, { name: string; best: number }>()
  const seriesByExercise = new Map<string, StrengthSeriesPoint[]>()
  const runningByExercise = new Map<string, number>()

  sessions.forEach((session) => {
    session.workout_exercises?.forEach((we) => {
      const exerciseId = we.exercise?.id
      const exerciseName = we.exercise?.name
      if (!exerciseId || !exerciseName) return

      let runningMax = runningByExercise.get(exerciseId) ?? 0

      we.sets?.forEach((set) => {
        if (typeof set.weight !== 'number' || typeof set.reps !== 'number') {
          return
        }

        const est1RM = calculateEpley1RM(set.weight, set.reps)
        if (est1RM > runningMax) {
          runningMax = est1RM
          runningByExercise.set(exerciseId, runningMax)
        }
      })

      if (runningMax > 0) {
        const series = seriesByExercise.get(exerciseId) ?? []
        series.push({
          date: session.created_at,
          est1RM: Math.round(runningMax * 10) / 10,
        })
        seriesByExercise.set(exerciseId, series)

        const best = bestByExercise.get(exerciseId)?.best ?? 0
        if (runningMax > best) {
          bestByExercise.set(exerciseId, {
            name: exerciseName,
            best: runningMax,
          })
        }
      }
    })
  })

  const sorted = Array.from(bestByExercise.entries())
    .sort((a, b) => (b[1].best ?? 0) - (a[1].best ?? 0))
    .slice(0, limit)

  return sorted.map(([exerciseId, meta]) => ({
    exerciseId,
    exerciseName: meta.name,
    series: seriesByExercise.get(exerciseId) ?? [],
  }))
}

export async function getExercisePercentile(
  supabase: SupabaseClient,
  userId: string,
  exerciseName: string,
): Promise<ExercisePercentileResult | null> {
  const trimmed = exerciseName?.trim()
  if (!trimmed) return null

  const { data: exercise, error: exerciseError } = await supabase
    .from('exercises')
    .select('id, name')
    .ilike('name', trimmed)
    .order('name')
    .limit(1)
    .maybeSingle()

  if (exerciseError) throw exerciseError
  if (!exercise) return null

  const { data: percentileData, error: percentileError } = await supabase.rpc(
    'get_exercise_percentiles',
    {
      p_exercise_id: exercise.id,
      p_user_id: userId,
    },
  )

  if (percentileError) throw percentileError

  const resultRow = Array.isArray(percentileData)
    ? percentileData[0]
    : percentileData

  if (!resultRow) {
    return {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      percentile: null,
      totalUsers: 0,
      userMax1RM: null,
      gender: null,
      genderPercentile: null,
      genderTotalUsers: 0,
      weightBucketStart: null,
      weightBucketEnd: null,
      genderWeightPercentile: null,
      genderWeightTotalUsers: 0,
    }
  }

  const userEst1RM =
    typeof resultRow.user_est_1rm === 'number'
      ? Number(resultRow.user_est_1rm)
      : null

  return {
    exerciseId: resultRow.exercise_id ?? exercise.id,
    exerciseName: resultRow.exercise_name ?? exercise.name,
    percentile:
      typeof resultRow.overall_percentile === 'number'
        ? Number(resultRow.overall_percentile)
        : null,
    totalUsers:
      typeof resultRow.overall_total_users === 'number'
        ? resultRow.overall_total_users
        : 0,
    userMax1RM:
      typeof userEst1RM === 'number' ? Math.round(userEst1RM * 10) / 10 : null,
    gender:
      typeof resultRow.gender === 'string' || resultRow.gender === null
        ? resultRow.gender
        : null,
    genderPercentile:
      typeof resultRow.gender_percentile === 'number'
        ? Number(resultRow.gender_percentile)
        : null,
    genderTotalUsers:
      typeof resultRow.gender_total_users === 'number'
        ? resultRow.gender_total_users
        : 0,
    weightBucketStart:
      typeof resultRow.weight_bucket_start === 'number'
        ? resultRow.weight_bucket_start
        : null,
    weightBucketEnd:
      typeof resultRow.weight_bucket_end === 'number'
        ? resultRow.weight_bucket_end
        : null,
    genderWeightPercentile:
      typeof resultRow.gender_weight_percentile === 'number'
        ? Number(resultRow.gender_weight_percentile)
        : null,
    genderWeightTotalUsers:
      typeof resultRow.gender_weight_total_users === 'number'
        ? resultRow.gender_weight_total_users
        : 0,
  }
}
