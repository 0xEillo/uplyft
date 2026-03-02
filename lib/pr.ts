import { estimateOneRepMaxKg } from '@/lib/strength-progress'
import { supabase } from '@/lib/supabase'

// Types kept local to avoid circular deps; align with database.types.ts
type UUID = string

export interface PrContextSet {
  reps: number | null
  weight: number | null
  isWarmup?: boolean
  originalIndex?: number
}

export interface PrContextExercise {
  exerciseId: UUID
  exerciseName: string
  sets: PrContextSet[]
}

export interface SessionContext {
  sessionId: UUID
  userId: UUID
  createdAt: string
  date: string
  exercises: PrContextExercise[]
}

export interface PrDetail {
  kind: 'heaviest-weight' | 'best-1rm' | 'best-set-volume'
  label: string // e.g. "Heaviest Weight", "Best 1RM", "Best Set Volume"
  value: number // metric value for this PR (kg, estimated 1RM kg, or kg*reps)
  previousValue?: number
  weight: number // weight used in the set that triggered this PR
  previousReps?: number // legacy field for backwards compatibility in some UI paths
  currentReps: number // reps used in the set that triggered this PR
  setIndices?: number[] // which sets contributed to this PR
  isCurrent: boolean // true if this is still the all-time PR, false if it's been beaten since
}

export interface PrResult {
  totalPrs: number
  perExercise: {
    exerciseId: UUID
    exerciseName: string
    prs: PrDetail[]
    baseline1RM: number
  }[]
}

export class PrService {
  static async computePrsForSession(ctx: SessionContext): Promise<PrResult> {
    const perExerciseResults: PrResult['perExercise'] = []

    for (const exercise of ctx.exercises) {
      try {
        const { prs, baseline1RM } = await this.computePrsForExercise(
          ctx.userId,
          exercise.exerciseId,
          exercise.exerciseName,
          ctx.createdAt,
          ctx.date,
          exercise.sets,
        )
        // Always include the exercise in the result to provide baseline stats,
        // even if no PRs were achieved.
        perExerciseResults.push({
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          prs,
          baseline1RM,
        })
      } catch (error) {
        const normalizedError = this.normalizeSupabaseError(error)
        console.warn('PR compute skipped exercise due to upstream error:', {
          exerciseId: exercise.exerciseId,
          message: normalizedError.message,
        })
        perExerciseResults.push({
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          prs: [],
          baseline1RM: 0,
        })
      }
    }

    const totalPrs = perExerciseResults.reduce(
      (sum, e) => sum + e.prs.length,
      0,
    )

    return { totalPrs, perExercise: perExerciseResults }
  }

  // Computes PRs for Hevy-style categories:
  // 1) Heaviest Weight (absolute load)
  // 2) Best 1RM (highest estimated 1RM)
  // 3) Best Set Volume (weight * reps)
  static async computePrsForExercise(
    userId: UUID,
    exerciseId: UUID,
    exerciseName: string,
    beforeCreatedAtISO: string,
    logDate: string,
    currentSets: PrContextSet[],
  ): Promise<{
    prs: PrResult['perExercise'][number]['prs']
    baseline1RM: number
  }> {
    const historic = await this.fetchHistoricSets(
      userId,
      exerciseId,
      beforeCreatedAtISO,
      logDate,
    )

    // Fetch future sets to determine if PRs are still current
    const future = await this.fetchFutureSets(
      userId,
      exerciseId,
      beforeCreatedAtISO,
      logDate,
    )

    // Warm-up sets should never count toward PR calculations.
    const currentWorkingSets = currentSets.filter((s) => !s.isWarmup)
    const historicWorkingSets = historic.filter((s) => !s.isWarmup)
    const futureWorkingSets = future.filter((s) => !s.isWarmup)

    // Calculate Baseline Estimated 1RM from historic working sets.
    const historicBest1RM = this.maxEstimatedOneRepMax(historicWorkingSets)
    const baseline1RM = historicBest1RM?.value ?? 0

    const prs: PrDetail[] = []

    const currentHeaviest = this.maxWeight(currentWorkingSets)
    const historicHeaviest = this.maxWeight(historicWorkingSets)
    const futureHeaviest = this.maxWeight(futureWorkingSets)

    if (currentHeaviest && (!historicHeaviest || currentHeaviest.value > historicHeaviest.value)) {
      prs.push({
        kind: 'heaviest-weight',
        label: 'Heaviest Weight',
        value: currentHeaviest.value,
        previousValue: historicHeaviest?.value,
        weight: currentHeaviest.set.weight!,
        currentReps: currentHeaviest.set.reps!,
        setIndices: this.setIndicesFromSet(currentHeaviest.set),
        isCurrent:
          !futureHeaviest || currentHeaviest.value >= futureHeaviest.value,
      })
    }

    const currentBest1RM = this.maxEstimatedOneRepMax(currentWorkingSets)
    const futureBest1RM = this.maxEstimatedOneRepMax(futureWorkingSets)

    if (currentBest1RM && (!historicBest1RM || currentBest1RM.value > historicBest1RM.value)) {
      prs.push({
        kind: 'best-1rm',
        label: 'Best 1RM',
        value: currentBest1RM.value,
        previousValue: historicBest1RM?.value,
        weight: currentBest1RM.set.weight!,
        currentReps: currentBest1RM.set.reps!,
        setIndices: this.setIndicesFromSet(currentBest1RM.set),
        isCurrent: !futureBest1RM || currentBest1RM.value >= futureBest1RM.value,
      })
    }

    const currentBestSetVolume = this.maxSetVolume(currentWorkingSets)
    const historicBestSetVolume = this.maxSetVolume(historicWorkingSets)
    const futureBestSetVolume = this.maxSetVolume(futureWorkingSets)

    if (
      currentBestSetVolume &&
      (!historicBestSetVolume ||
        currentBestSetVolume.value > historicBestSetVolume.value)
    ) {
      prs.push({
        kind: 'best-set-volume',
        label: 'Best Set Volume',
        value: currentBestSetVolume.value,
        previousValue: historicBestSetVolume?.value,
        weight: currentBestSetVolume.set.weight!,
        currentReps: currentBestSetVolume.set.reps!,
        setIndices: this.setIndicesFromSet(currentBestSetVolume.set),
        isCurrent:
          !futureBestSetVolume ||
          currentBestSetVolume.value >= futureBestSetVolume.value,
      })
    }

    return { prs, baseline1RM }
  }

  private static async fetchHistoricSets(
    userId: UUID,
    exerciseId: UUID,
    beforeCreatedAtISO: string,
    logDate: string,
  ): Promise<PrContextSet[]> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(
        `
        created_at,
        date,
        workout_exercises!inner (
          exercise_id,
          sets!inner (reps, weight, is_warmup)
        )
      `,
      )
      .eq('user_id', userId)
      .eq('workout_exercises.exercise_id', exerciseId)
      // Logic: Date is strictly before OR (Date is same AND created_at is strictly before)
      .or(
        `date.lt.${logDate},and(date.eq.${logDate},created_at.lt.${beforeCreatedAtISO})`,
      )

    if (error) throw error

    interface HistoricSetsRow {
      workout_exercises?: {
        exercise_id: string
        sets?: {
          reps: number | null
          weight: number | null
          is_warmup?: boolean | null
        }[]
      }[]
    }

    const sets: PrContextSet[] = []
    ;(data as HistoricSetsRow[])?.forEach((session) => {
      session.workout_exercises?.forEach((we) => {
        if (we.exercise_id === exerciseId) {
          we.sets?.forEach((s) => {
            sets.push({
              reps: s.reps,
              weight: s.weight,
              isWarmup: s.is_warmup === true,
            })
          })
        }
      })
    })
    return sets
  }

  private static async fetchFutureSets(
    userId: UUID,
    exerciseId: UUID,
    afterCreatedAtISO: string,
    logDate: string,
  ): Promise<PrContextSet[]> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(
        `
        created_at,
        date,
        workout_exercises!inner (
          exercise_id,
          sets!inner (reps, weight, is_warmup)
        )
      `,
      )
      .eq('user_id', userId)
      .eq('workout_exercises.exercise_id', exerciseId)
      // Logic: Date is strictly after OR (Date is same AND created_at is strictly after)
      .or(
        `date.gt.${logDate},and(date.eq.${logDate},created_at.gt.${afterCreatedAtISO})`,
      )

    if (error) throw error

    interface FutureSetsRow {
      workout_exercises?: {
        exercise_id: string
        sets?: {
          reps: number | null
          weight: number | null
          is_warmup?: boolean | null
        }[]
      }[]
    }

    const sets: PrContextSet[] = []
    ;(data as FutureSetsRow[])?.forEach((session) => {
      session.workout_exercises?.forEach((we) => {
        if (we.exercise_id === exerciseId) {
          we.sets?.forEach((s) => {
            sets.push({
              reps: s.reps,
              weight: s.weight,
              isWarmup: s.is_warmup === true,
            })
          })
        }
      })
    })
    return sets
  }

  private static hasValidWeightAndReps(
    set: PrContextSet,
  ): set is PrContextSet & { weight: number; reps: number } {
    return (
      typeof set.weight === 'number' &&
      set.weight > 0 &&
      typeof set.reps === 'number' &&
      set.reps > 0
    )
  }

  private static maxWeight(sets: PrContextSet[]): {
    value: number
    set: PrContextSet & { weight: number; reps: number }
  } | null {
    let best: { value: number; set: PrContextSet & { weight: number; reps: number } } | null =
      null

    sets.forEach((set) => {
      if (!this.hasValidWeightAndReps(set)) return
      if (!best || set.weight > best.value) {
        best = { value: set.weight, set }
      }
    })

    return best
  }

  private static maxEstimatedOneRepMax(sets: PrContextSet[]): {
    value: number
    set: PrContextSet & { weight: number; reps: number }
  } | null {
    let best: { value: number; set: PrContextSet & { weight: number; reps: number } } | null =
      null

    sets.forEach((set) => {
      if (!this.hasValidWeightAndReps(set)) return
      const estimated = estimateOneRepMaxKg(set.weight, set.reps)
      if (!best || estimated > best.value) {
        best = { value: estimated, set }
      }
    })

    return best
  }

  private static maxSetVolume(sets: PrContextSet[]): {
    value: number
    set: PrContextSet & { weight: number; reps: number }
  } | null {
    let best: { value: number; set: PrContextSet & { weight: number; reps: number } } | null =
      null

    sets.forEach((set) => {
      if (!this.hasValidWeightAndReps(set)) return
      const volume = set.weight * set.reps
      if (!best || volume > best.value) {
        best = { value: volume, set }
      }
    })

    return best
  }

  private static setIndicesFromSet(set: PrContextSet): number[] {
    return typeof set.originalIndex === 'number' ? [set.originalIndex] : []
  }

  private static normalizeSupabaseError(error: unknown): { message: string } {
    const fallbackMessage = 'Unknown PR service error'
    if (!error || typeof error !== 'object') return { message: fallbackMessage }

    const message = 'message' in error && typeof error.message === 'string'
      ? error.message
      : fallbackMessage

    // Supabase can occasionally return a full Cloudflare HTML page in message.
    // Avoid logging full HTML blobs; keep diagnostics compact and actionable.
    if (
      message.includes('<!DOCTYPE html>') &&
      message.toLowerCase().includes('bad gateway')
    ) {
      return { message: 'Upstream service returned 502 Bad Gateway' }
    }

    return { message }
  }
}
