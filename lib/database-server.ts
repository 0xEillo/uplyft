import type {
  Exercise,
  Profile,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import { createServerSupabaseClient } from './supabase-server'

export function createServerDatabase(accessToken?: string) {
  const supabase = createServerSupabaseClient(accessToken)

  return {
    profiles: {
      async getById(userId: string) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (error) throw error
        return data as Profile
      },
    },

    workoutSessions: {
      async getRecent(userId: string, limit = 50) {
        const { data, error } = await supabase
          .from('workout_sessions')
          .select(
            `
            *,
            workout_exercises (
              *,
              exercise:exercises (*),
              sets (*)
            )
          `,
          )
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(limit)
        if (error) throw error
        return data as WorkoutSessionWithDetails[]
      },
    },

    stats: {
      async getTotalVolume(userId: string) {
        const { data, error } = await supabase
          .from('workout_sessions')
          .select(
            `
            workout_exercises (
              sets (reps, weight)
            )
          `,
          )
          .eq('user_id', userId)
        if (error) throw error
        let total = 0
        ;(data as any[])?.forEach((session) => {
          session.workout_exercises?.forEach((we: any) => {
            we.sets?.forEach((s: any) => {
              if (s.reps && s.weight) total += s.reps * s.weight
            })
          })
        })
        return total
      },

      async getExerciseWeightProgress(
        userId: string,
        exerciseId: string,
        daysBack?: number,
      ) {
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
          .eq('workout_exercises.exercise_id', exerciseId)
          .not('workout_exercises.sets.weight', 'is', null)
          .order('created_at', { ascending: true })

        if (daysBack) {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - daysBack)
          query = query.gte('created_at', cutoffDate.toISOString())
        }

        const { data, error } = await query
        if (error) throw error

        return (data as any[]).map((session) => {
          let maxWeight = 0
          session.workout_exercises?.forEach((we: any) => {
            we.sets?.forEach((set: any) => {
              if (set.weight && set.weight > maxWeight) maxWeight = set.weight
            })
          })
          return { date: session.created_at, maxWeight }
        })
      },
    },

    exercises: {
      async findByName(name: string) {
        const { data, error } = await supabase
          .from('exercises')
          .select('*')
          .ilike('name', `%${name}%`)
          .limit(10)
        if (error) throw error
        return data as Exercise[]
      },
    },
  }
}
