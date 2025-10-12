import type {
  Exercise,
  ParsedWorkout,
  Profile,
  WorkoutSession,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import { generateExerciseMetadata } from './exercise-metadata'
import { createServerSupabaseClient } from './supabase-server'

export function createServerDatabase(accessToken?: string) {
  const supabase = createServerSupabaseClient(accessToken)

  // Helper function to get or create exercise with AI-generated metadata
  const getOrCreateExerciseWithMetadata = async (
    name: string,
    userId: string,
  ): Promise<Exercise> => {
    // Security: Validate and sanitize exercise name
    const trimmedName = name.trim()

    // Reject empty names
    if (!trimmedName) {
      throw new Error('Exercise name cannot be empty')
    }

    // Reject names that are too long (prevent abuse)
    if (trimmedName.length > 100) {
      throw new Error('Exercise name too long (max 100 characters)')
    }

    // Reject names with suspicious patterns (basic XSS prevention)
    if (/<script|javascript:|on\w+=/i.test(trimmedName)) {
      throw new Error('Invalid exercise name')
    }

    const normalizedName = trimmedName.toLowerCase()

    // Try to find existing exercise by exact name match (case-insensitive)
    const { data: exactMatch } = await supabase
      .from('exercises')
      .select('*')
      .ilike('name', trimmedName)
      .single()

    if (exactMatch) return exactMatch as Exercise

    // Try to find by alias match
    const { data: aliasMatches } = await supabase
      .from('exercises')
      .select('*')
      .contains('aliases', [normalizedName])

    if (aliasMatches && aliasMatches.length > 0) {
      return aliasMatches[0] as Exercise
    }

    // No match found - create new exercise with AI-generated metadata
    // This uses AI to infer muscle_group, type (compound/isolation), and equipment
    const metadata = await generateExerciseMetadata(trimmedName)

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        name: trimmedName,
        created_by: userId,
        muscle_group: metadata.muscle_group,
        type: metadata.type,
        equipment: metadata.equipment,
      })
      .select()
      .single()

    if (error) throw error
    return data as Exercise
  }

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

        // Get or create exercises with AI-generated metadata in parallel
        // This ensures all exercises have muscle_group, type, and equipment metadata
        // Processing in parallel significantly reduces total time for multiple new exercises

        // Deduplicate exercise names (case-insensitive) to avoid parallel conflicts
        const uniqueExerciseNames = [
          ...new Set(
            parsedWorkout.exercises.map((ex) => ex.name.toLowerCase()),
          ),
        ]

        // Process unique exercises in parallel
        const exercisePromises = uniqueExerciseNames.map((name) => {
          // Find the original casing from the parsed workout
          const originalName =
            parsedWorkout.exercises.find(
              (ex) => ex.name.toLowerCase() === name,
            )?.name || name
          return getOrCreateExerciseWithMetadata(originalName, userId)
        })

        const exercises = await Promise.all(exercisePromises)

        // Create a map for quick lookup
        const exerciseMap = new Map<string, Exercise>()
        uniqueExerciseNames.forEach((name, index) => {
          exerciseMap.set(name, exercises[index])
        })

        // Create workout exercises (links exercises to this session)
        const workoutExercisesToInsert = parsedWorkout.exercises.map(
          (parsedEx) => {
            const exercise = exerciseMap.get(parsedEx.name.toLowerCase())
            if (!exercise) {
              throw new Error(`Exercise not found: ${parsedEx.name}`)
            }

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

        // Create all sets for the workout
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
          .not('workout_exercises.sets.reps', 'is', null)
          .gt('workout_exercises.sets.reps', 0)
          .order('created_at', { ascending: true })

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

        // Transform data to show running personal best estimated 1RM over time
        let runningMax = 0
        return (data as WeightProgressRow[]).map((session) => {
          // Find max estimated 1RM in this session using Epley formula
          session.workout_exercises?.forEach((we) => {
            we.sets?.forEach((set) => {
              if (set.weight && set.reps) {
                // Calculate estimated 1RM using Epley formula: weight × (1 + reps/30)
                const estimated1RM = set.weight * (1 + set.reps / 30)
                if (estimated1RM > runningMax) {
                  runningMax = estimated1RM
                }
              }
            })
          })
          return { date: session.created_at, maxWeight: runningMax }
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
