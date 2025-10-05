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
  kind: 'single-rep-max' | 'rep-max' | 'scheme-max'
  label: string // e.g. "1RM", "5-rep max", "5x5 max"
  previous?: number
  current: number
  setIndices?: number[] // which sets contributed to this PR
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

  // Computes PRs for: single (1RM), rep-specific maxes (e.g., best 5-rep), and scheme (e.g., best 5x5 total weight)
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

    // Single 1RM: max weight at reps === 1
    const hist1Rm = this.maxWeightForReps(historic, 1)
    const cur1Rm = this.maxWeightForReps(currentSets, 1)

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
      })
    }

    // Rep-specific maxes: for each reps count present in current sets
    const repsSet = new Set<number>()
    currentSets.forEach((s) => {
      if (s.reps && s.weight) repsSet.add(s.reps)
    })
    for (const reps of repsSet) {
      const hist = this.maxWeightForReps(historic, reps)
      const cur = this.maxWeightForReps(currentSets, reps)
      if (cur && (!hist || cur > hist)) {
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
        })
      }
    }

    // Scheme PR example: 5x5 best total weight (sum of 5 top sets at 5 reps)
    // Only compute if there are at least five 5-rep sets in current
    const cur5s = currentSets.filter((s) => s.weight && s.reps === 5)
    if (cur5s.length >= 5) {
      const curTop5 = this.sumTopN(
        cur5s.map((s) => s.weight! * s.reps),
        5,
      )
      // Historic: find historic top-5 of five-rep sets
      const hist5s = historic.filter((s) => s.weight && s.reps === 5)
      const histTop5 =
        hist5s.length >= 5
          ? this.sumTopN(
              hist5s.map((s) => s.weight! * s.reps),
              5,
            )
          : undefined
      if (curTop5 && (!histTop5 || curTop5 > histTop5)) {
        prs.push({
          kind: 'scheme-max',
          label: 'Best 5x5 total',
          previous: histTop5 ?? undefined,
          current: curTop5,
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

  private static sumTopN(values: number[], n: number): number | undefined {
    if (values.length < n) return undefined
    const sorted = [...values].sort((a, b) => b - a)
    return sorted.slice(0, n).reduce((a, b) => a + b, 0)
  }
}
