import type {
  Exercise,
  ParsedWorkout,
  WorkoutSession,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import { supabase } from './supabase'

export const database = {
  // Exercise operations
  exercises: {
    async getAll() {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name')

      if (error) throw error
      return data as Exercise[]
    },

    async findByName(name: string) {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .ilike('name', `%${name}%`)
        .limit(10)

      if (error) throw error
      return data as Exercise[]
    },

    async getOrCreate(name: string, userId: string) {
      // Try to find existing exercise (case-insensitive)
      const { data: existing } = await supabase
        .from('exercises')
        .select('*')
        .ilike('name', name)
        .single()

      if (existing) return existing as Exercise

      // Create new exercise
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          name,
          created_by: userId,
        })
        .select()
        .single()

      if (error) throw error
      return data as Exercise
    },
  },

  // Workout session operations
  workoutSessions: {
    async create(
      userId: string,
      parsedWorkout: ParsedWorkout,
      rawText: string,
    ) {
      // Create workout session
      const { data: session, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: userId,
          raw_text: rawText,
          notes: parsedWorkout.notes,
          type: parsedWorkout.type,
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // Validate exercises array
      if (!Array.isArray(parsedWorkout.exercises)) {
        throw new Error('Invalid workout data: exercises must be an array')
      }

      // Create workout exercises and sets
      for (const parsedExercise of parsedWorkout.exercises) {
        // Get or create exercise
        const exercise = await database.exercises.getOrCreate(
          parsedExercise.name,
          userId,
        )

        // Create workout exercise
        const { data: workoutExercise, error: weError } = await supabase
          .from('workout_exercises')
          .insert({
            session_id: session.id,
            exercise_id: exercise.id,
            order_index: parsedExercise.order_index, // Use AI-provided order
            type: parsedExercise.type,
            notes: parsedExercise.notes,
          })
          .select()
          .single()

        if (weError) throw weError

        // Create sets
        if (parsedExercise.sets && parsedExercise.sets.length > 0) {
          const setsToInsert = parsedExercise.sets.map((set) => ({
            workout_exercise_id: workoutExercise.id,
            set_number: set.set_number,
            reps: set.reps,
            weight: set.weight,
            rpe: set.rpe,
            notes: set.notes,
          }))

          const { error: setsError } = await supabase
            .from('sets')
            .insert(setsToInsert)

          if (setsError) throw setsError
        }
      }

      return session as WorkoutSession
    },

    async getRecent(userId: string, limit = 20) {
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

    async getById(id: string) {
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
        .eq('id', id)
        .single()

      if (error) throw error
      return data as WorkoutSessionWithDetails
    },
  },

  // Stats and analytics
  stats: {
    async getExerciseMaxWeight(
      userId: string,
      exerciseName: string,
      beforeDate?: string,
    ) {
      const query = supabase
        .from('workout_sessions')
        .select(
          `
          workout_exercises!inner (
            exercise:exercises!inner (name),
            sets!inner (reps, weight)
          )
        `,
        )
        .eq('user_id', userId)
        .eq('workout_exercises.exercise.name', exerciseName)
        .not('workout_exercises.sets.weight', 'is', null)

      if (beforeDate) {
        query.lt('date', beforeDate)
      }

      const { data, error } = await query

      if (error) throw error

      // Find max weight for each rep count
      const maxWeights: Record<number, number> = {}
      data?.forEach((session: any) => {
        session.workout_exercises?.forEach((we: any) => {
          we.sets?.forEach((set: any) => {
            if (set.reps && set.weight) {
              if (!maxWeights[set.reps] || set.weight > maxWeights[set.reps]) {
                maxWeights[set.reps] = set.weight
              }
            }
          })
        })
      })

      return maxWeights
    },

    async getExerciseHistory(userId: string, exerciseName: string) {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(
          `
          date,
          workout_exercises!inner (
            exercise:exercises!inner (name),
            sets (*)
          )
        `,
        )
        .eq('user_id', userId)
        .eq('workout_exercises.exercise.name', exerciseName)
        .order('date', { ascending: true })

      if (error) throw error
      return data
    },

    async getTotalVolume(userId: string, dateFrom?: Date) {
      const query = supabase
        .from('workout_sessions')
        .select(
          `
          workout_exercises (
            sets (reps, weight)
          )
        `,
        )
        .eq('user_id', userId)

      if (dateFrom) {
        query.gte('date', dateFrom.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      // Calculate total volume
      let totalVolume = 0
      data?.forEach((session: any) => {
        session.workout_exercises?.forEach((we: any) => {
          we.sets?.forEach((set: any) => {
            if (set.reps && set.weight) {
              totalVolume += set.reps * set.weight
            }
          })
        })
      })

      return totalVolume
    },
  },
}
