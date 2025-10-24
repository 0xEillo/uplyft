import { supabase } from '@/lib/supabase'

// Types kept local to avoid circular deps; align with database.types.ts
type UUID = string

export interface PrContextSet {
  reps: number
  weight: number | null
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
  exercises: PrContextExercise[]
}

export interface PrDetail {
  kind: 'single-rep-max' | 'weight-max'
  label: string // e.g. "1RM", "11 reps @ 65kg"
  weight: number // the weight for this PR
  previousReps?: number // previous max reps at this weight
  currentReps: number // current max reps at this weight
  setIndices?: number[] // which sets contributed to this PR
  isCurrent: boolean // true if this is still the all-time PR, false if it's been beaten since
}

export interface PrResult {
  totalPrs: number
  perExercise: {
    exerciseId: UUID
    exerciseName: string
    prs: PrDetail[]
  }[]
}

export class PrService {
  static async computePrsForSession(ctx: SessionContext): Promise<PrResult> {
    const perExerciseResults: PrResult['perExercise'] = []

    for (const exercise of ctx.exercises) {
      const { prs } = await this.computePrsForExercise(
        ctx.userId,
        exercise.exerciseId,
        exercise.exerciseName,
        ctx.createdAt,
        exercise.sets,
      )
      if (prs.length > 0) {
        perExerciseResults.push({
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          prs,
        })
      }
    }

    const totalPrs = perExerciseResults.reduce(
      (sum, e) => sum + e.prs.length,
      0,
    )

    return { totalPrs, perExercise: perExerciseResults }
  }

  // Computes PRs for: single (1RM) and weight-based rep maxes (e.g., most reps at 65kg)
  static async computePrsForExercise(
    userId: UUID,
    exerciseId: UUID,
    exerciseName: string,
    beforeDateISO: string,
    currentSets: PrContextSet[],
  ): Promise<{ prs: PrResult['perExercise'][number]['prs'] }> {
    const historic = await this.fetchHistoricSets(
      userId,
      exerciseId,
      beforeDateISO,
    )

    // Fetch future sets to determine if PRs are still current
    const future = await this.fetchFutureSets(
      userId,
      exerciseId,
      beforeDateISO,
    )

    const prs: PrDetail[] = []

    // Special case: 1RM (max weight at reps === 1)
    const hist1Rm = this.maxWeightForReps(historic, 1)
    const cur1Rm = this.maxWeightForReps(currentSets, 1)
    const future1Rm = this.maxWeightForReps(future, 1)

    if (cur1Rm && (!hist1Rm || cur1Rm > hist1Rm)) {
      const firstOneRmSetIndex = currentSets.findIndex(
        (s) => s.reps === 1 && s.weight === cur1Rm
      )
      const oneRmSetIndices = firstOneRmSetIndex !== -1 ? [firstOneRmSetIndex] : []
      prs.push({
        kind: 'single-rep-max',
        label: '1RM',
        weight: cur1Rm,
        previousReps: hist1Rm ? 1 : undefined,
        currentReps: 1,
        setIndices: oneRmSetIndices,
        isCurrent: !future1Rm || cur1Rm > future1Rm,
      })
    }

    // Weight-based rep maxes: for each unique weight in current sets (excluding 1-rep sets)
    const weightsMap = new Map<number, number>() // weight -> max reps
    currentSets.forEach((s) => {
      if (s.weight && s.reps > 1) {
        const currentMax = weightsMap.get(s.weight) || 0
        if (s.reps > currentMax) {
          weightsMap.set(s.weight, s.reps)
        }
      }
    })

    for (const [weight, currentReps] of weightsMap) {
      // Check historical max reps at this weight
      const historicalReps = this.maxRepsForWeight(historic, weight)

      // Is this a PR? (more reps than historical max at this weight)
      if (!historicalReps || currentReps > historicalReps) {
        // Check if this PR is still current (not beaten by future workouts)
        const futureReps = this.maxRepsForWeight(future, weight)
        const isCurrent = !futureReps || currentReps > futureReps

        // Find the first set that achieved this PR
        const firstPrSetIndex = currentSets.findIndex(
          (s) => s.weight === weight && s.reps === currentReps
        )
        const setIndices = firstPrSetIndex !== -1 ? [firstPrSetIndex] : []

        prs.push({
          kind: 'weight-max',
          label: `${weight}kg for ${currentReps} ${currentReps === 1 ? 'rep' : 'reps'}`,
          weight,
          previousReps: historicalReps,
          currentReps,
          setIndices,
          isCurrent,
        })
      }
    }

    return { prs }
  }

  private static async fetchHistoricSets(
    userId: UUID,
    exerciseId: UUID,
    beforeDateISO: string,
  ): Promise<PrContextSet[]> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(
        `
        created_at,
        workout_exercises!inner (
          exercise_id,
          sets!inner (reps, weight)
        )
      `,
      )
      .eq('user_id', userId)
      .eq('workout_exercises.exercise_id', exerciseId)
      .lt('created_at', beforeDateISO)

    if (error) throw error

    interface HistoricSetsRow {
      workout_exercises?: Array<{
        exercise_id: string
        sets?: Array<{
          reps: number
          weight: number | null
        }>
      }>
    }

    const sets: PrContextSet[] = []
    ;(data as HistoricSetsRow[])?.forEach((session) => {
      session.workout_exercises?.forEach((we) => {
        if (we.exercise_id === exerciseId) {
          we.sets?.forEach((s) => {
            sets.push({ reps: s.reps, weight: s.weight })
          })
        }
      })
    })
    return sets
  }

  private static async fetchFutureSets(
    userId: UUID,
    exerciseId: UUID,
    afterDateISO: string,
  ): Promise<PrContextSet[]> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(
        `
        created_at,
        workout_exercises!inner (
          exercise_id,
          sets!inner (reps, weight)
        )
      `,
      )
      .eq('user_id', userId)
      .eq('workout_exercises.exercise_id', exerciseId)
      .gt('created_at', afterDateISO)

    if (error) throw error

    interface FutureSetsRow {
      workout_exercises?: Array<{
        exercise_id: string
        sets?: Array<{
          reps: number
          weight: number | null
        }>
      }>
    }

    const sets: PrContextSet[] = []
    ;(data as FutureSetsRow[])?.forEach((session) => {
      session.workout_exercises?.forEach((we) => {
        if (we.exercise_id === exerciseId) {
          we.sets?.forEach((s) => {
            sets.push({ reps: s.reps, weight: s.weight })
          })
        }
      })
    })
    return sets
  }

  private static maxWeightForReps(
    sets: PrContextSet[],
    reps: number,
  ): number | undefined {
    let max: number | undefined
    sets.forEach((s) => {
      if (s.weight && s.reps === reps) {
        if (!max || s.weight > max) max = s.weight
      }
    })
    return max
  }

  // Get the maximum reps achieved at a specific weight
  private static maxRepsForWeight(
    sets: PrContextSet[],
    weight: number,
  ): number | undefined {
    let max: number | undefined
    sets.forEach((s) => {
      if (s.weight === weight) {
        if (!max || s.reps > max) max = s.reps
      }
    })
    return max
  }
}
