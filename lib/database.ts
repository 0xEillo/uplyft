import type {
  Exercise,
  ParsedWorkout,
  Profile,
  WorkoutSession,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import { supabase } from './supabase'

export const database = {
  // Profile operations
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

    async getOrCreate(userId: string, email: string) {
      // Try to get existing profile
      const { data: existing, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (existing && !fetchError) {
        return existing as Profile
      }

      // Profile doesn't exist, create it
      const baseTag = email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
      const displayName = email.split('@')[0]

      // Ensure baseTag is at least 3 chars
      let userTag = baseTag.length >= 3 ? baseTag : `user${userId.slice(0, 6)}`

      // Ensure max 30 chars
      if (userTag.length > 30) {
        userTag = userTag.substring(0, 30)
      }

      // Try to create with base tag, add numbers if collision
      let counter = 0
      while (counter < 100) {
        const tryTag =
          counter === 0 ? userTag : `${userTag.substring(0, 25)}${counter}`

        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            user_tag: tryTag,
            display_name: displayName,
          })
          .select()
          .single()

        if (!createError && created) {
          return created as Profile
        }

        // If unique constraint violation, try next number
        if (createError?.code === '23505') {
          counter++
          continue
        }

        // Other error, throw it
        if (createError) throw createError
      }

      throw new Error('Could not generate unique user tag')
    },

    async update(userId: string, updates: Partial<Profile>) {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return data as Profile
    },
  },

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

    async getExercisesWithData(userId: string) {
      const { data, error } = await supabase
        .from('exercises')
        .select(
          `
          *,
          workout_exercises!inner (
            id,
            session_id
          )
        `,
        )
        .eq('workout_exercises.session_id', 'workout_sessions.id')

      if (error) {
        // If the query fails, try a different approach
        const { data: sessions, error: sessionsError } = await supabase
          .from('workout_sessions')
          .select(
            `
            workout_exercises!inner (
              exercise:exercises!inner (*)
            )
          `,
          )
          .eq('user_id', userId)

        if (sessionsError) throw sessionsError

        // Extract unique exercises
        const exerciseMap = new Map<string, Exercise>()
        sessions?.forEach((session: any) => {
          session.workout_exercises?.forEach((we: any) => {
            if (we.exercise && !exerciseMap.has(we.exercise.id)) {
              exerciseMap.set(we.exercise.id, we.exercise)
            }
          })
        })

        const exercises = Array.from(exerciseMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        )
        return exercises as Exercise[]
      }

      // Remove duplicates and sort
      const uniqueExercises = data
        .filter(
          (ex, index, self) => index === self.findIndex((e) => e.id === ex.id),
        )
        .sort((a, b) => a.name.localeCompare(b.name))

      return uniqueExercises as Exercise[]
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

      // Process exercises one by one to avoid duplicate key violations
      const exerciseMap = new Map<string, Exercise>()

      for (const parsedEx of parsedWorkout.exercises) {
        const exercise = await database.exercises.getOrCreate(
          parsedEx.name,
          userId,
        )
        exerciseMap.set(parsedEx.name.toLowerCase(), exercise)
      }

      // Batch create workout exercises
      const workoutExercisesToInsert = parsedWorkout.exercises.map(
        (parsedEx) => {
          const exercise = exerciseMap.get(parsedEx.name.toLowerCase())
          if (!exercise) throw new Error(`Exercise not found: ${parsedEx.name}`)

          return {
            session_id: session.id,
            exercise_id: exercise.id,
            order_index: parsedEx.order_index,
            notes: parsedEx.notes,
          }
        },
      )

      const { data: workoutExercises, error: weError } = await supabase
        .from('workout_exercises')
        .insert(workoutExercisesToInsert)
        .select()

      if (weError) throw weError

      // Batch create all sets
      const allSetsToInsert = parsedWorkout.exercises.flatMap(
        (parsedEx, index) => {
          const workoutExercise = workoutExercises[index]
          return (parsedEx.sets || []).map((set) => ({
            workout_exercise_id: workoutExercise.id,
            set_number: set.set_number,
            reps: set.reps,
            weight: set.weight,
            rpe: set.rpe,
            notes: set.notes,
          }))
        },
      )

      if (allSetsToInsert.length > 0) {
        const { error: setsError } = await supabase
          .from('sets')
          .insert(allSetsToInsert)

        if (setsError) throw setsError
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

    async delete(sessionId: string) {
      // Delete sets first (cascaded by workout_exercises deletion)
      // Then delete workout_exercises (cascaded by session deletion)
      // Finally delete the session
      const { error } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('id', sessionId)

      if (error) throw error
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

      interface ExerciseMaxWeightRow {
        workout_exercises?: {
          sets?: {
            reps: number
            weight: number | null
          }[]
        }[]
      }

      // Find max weight for each rep count
      const maxWeights: Record<number, number> = {}
      ;(data as ExerciseMaxWeightRow[])?.forEach((session) => {
        session.workout_exercises?.forEach((we) => {
          we.sets?.forEach((set) => {
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

      // Filter by date range if specified
      if (daysBack) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysBack)
        query = query.gte('created_at', cutoffDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      interface WeightProgressRow {
        id: string
        created_at: string
        workout_exercises?: {
          sets?: {
            reps: number
            weight: number | null
          }[]
        }[]
      }

      // Transform data to show running personal best over time
      let runningMax = 0
      const progressData = (data as WeightProgressRow[])?.map((session) => {
        // Find max weight in this session
        session.workout_exercises?.forEach((we) => {
          we.sets?.forEach((set) => {
            if (set.weight && set.weight > runningMax) {
              runningMax = set.weight
            }
          })
        })

        return {
          date: session.created_at,
          maxWeight: runningMax, // Show cumulative PR, not just this session
        }
      })

      return progressData || []
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

      interface TotalVolumeRow {
        workout_exercises?: {
          sets?: {
            reps: number
            weight: number | null
          }[]
        }[]
      }

      // Calculate total volume
      let totalVolume = 0
      ;(data as TotalVolumeRow[])?.forEach((session) => {
        session.workout_exercises?.forEach((we) => {
          we.sets?.forEach((set) => {
            if (set.reps && set.weight) {
              totalVolume += set.reps * set.weight
            }
          })
        })
      })

      return totalVolume
    },

    async getStrengthScoreProgress(userId: string, daysBack?: number) {
      let query = supabase
        .from('workout_sessions')
        .select(
          `
          id,
          created_at,
          workout_exercises!inner (
            exercise_id,
            exercise:exercises (name),
            sets!inner (reps, weight)
          )
        `,
        )
        .eq('user_id', userId)
        .not('workout_exercises.sets.weight', 'is', null)
        .order('created_at', { ascending: true })

      // Filter by date range if specified
      if (daysBack) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysBack)
        query = query.gte('created_at', cutoffDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      interface StrengthScoreRow {
        id: string
        created_at: string
        workout_exercises?: {
          exercise_id: string
          sets?: {
            reps: number
            weight: number | null
          }[]
        }[]
      }

      // Calculate strength score for each workout
      // Strength Score = sum of all-time best estimated 1RMs across all exercises
      // Maintains running personal bests as we iterate through workouts chronologically
      const allTimeBests = new Map<string, number>()
      const progressData = (data as StrengthScoreRow[])?.map((session) => {
        // Update personal bests based on this session's performance
        session.workout_exercises?.forEach((we) => {
          we.sets?.forEach((set) => {
            if (set.weight && set.reps) {
              // Calculate estimated 1RM using Epley formula: weight × (1 + reps/30)
              const estimated1RM = set.weight * (1 + set.reps / 30)

              const currentBest = allTimeBests.get(we.exercise_id) || 0
              if (estimated1RM > currentBest) {
                allTimeBests.set(we.exercise_id, estimated1RM)
              }
            }
          })
        })

        // Sum all personal bests to get cumulative strength score
        const strengthScore = Array.from(allTimeBests.values()).reduce(
          (sum, val) => sum + val,
          0,
        )

        return {
          date: session.created_at,
          strengthScore: Math.round(strengthScore), // Round to whole number
        }
      })

      return progressData || []
    },
  },
}
