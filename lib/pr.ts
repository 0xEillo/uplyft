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
  kind: 'single-rep-max' | 'rep-max'
  label: string // e.g. "1RM", "5-rep max"
  previous?: number
  current: number
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

  // Computes PRs for: single (1RM) and rep-specific maxes (e.g., best 5-rep, best 8-rep)
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

    // Single 1RM: max weight at reps === 1
    const hist1Rm = this.maxWeightForReps(historic, 1)
    const cur1Rm = this.maxWeightForReps(currentSets, 1)
    const future1Rm = this.maxWeightForReps(future, 1)

    const prs: PrDetail[] = []

    // Track which sets achieved 1RM PR
    const oneRmSetIndices: number[] = []
    if (cur1Rm && (!hist1Rm || cur1Rm > hist1Rm)) {
      currentSets.forEach((s, idx) => {
        if (s.reps === 1 && s.weight === cur1Rm) {
          oneRmSetIndices.push(idx)
        }
      })
      prs.push({
        kind: 'single-rep-max',
        label: '1RM',
        previous: hist1Rm ?? undefined,
        current: cur1Rm,
        setIndices: oneRmSetIndices,
        isCurrent: !future1Rm || cur1Rm >= future1Rm,
      })
    }

    // Rep-specific maxes: for each reps count present in current sets
    const repsSet = new Set<number>()
    currentSets.forEach((s) => {
      if (s.reps && s.weight) repsSet.add(s.reps)
    })
    for (const reps of repsSet) {
      const cur = this.maxWeightForReps(currentSets, reps)
      if (cur && this.isTrueRepMaxPr(historic, cur, reps)) {
        const hist = this.maxWeightForReps(historic, reps)
        const futureRepMax = this.maxWeightForReps(future, reps)
        const repMaxSetIndices: number[] = []
        currentSets.forEach((s, idx) => {
          if (s.reps === reps && s.weight === cur) {
            repMaxSetIndices.push(idx)
          }
        })
        prs.push({
          kind: 'rep-max',
          label: `${reps}-rep max`,
          previous: hist ?? undefined,
          current: cur,
          setIndices: repMaxSetIndices,
          isCurrent: !futureRepMax || cur >= futureRepMax,
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

  // Check if weight/reps is a true PR: no historical set with weight >= current weight AND reps >= current reps
  private static isTrueRepMaxPr(
    historic: PrContextSet[],
    currentWeight: number,
    currentReps: number,
  ): boolean {
    for (const h of historic) {
      if (h.weight && h.weight >= currentWeight && h.reps >= currentReps) {
        return false // Found a historical set that is equal or better
      }
    }
    return true
  }
}
