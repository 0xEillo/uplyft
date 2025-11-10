import { generateExerciseMetadata } from '@/lib/exercise-metadata'
import type {
  Exercise,
  ParsedWorkout,
  Profile,
  WorkoutRoutine,
  WorkoutRoutineWithDetails,
  WorkoutSession,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import { supabase } from './supabase'

/**
 * Type for nested Supabase query results
 */
interface SessionWithExercises {
  workout_exercises: {
    exercise: Exercise
  }[]
}

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

      // Ensure max 27 chars (room for 3-digit suffix like Twitter)
      if (userTag.length > 27) {
        userTag = userTag.substring(0, 27)
      }

      // Try to create with base tag, add numbers (1-999) if collision
      for (let counter = 0; counter <= 999; counter++) {
        const tryTag = counter === 0 ? userTag : `${userTag}${counter}`

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

    async generateUniqueUserTag(displayName: string): Promise<string> {
      // Normalize the display name to a valid user tag format
      const baseTag = displayName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 27) // Leave room for up to 3 digits

      // Ensure minimum length
      if (baseTag.length < 3) {
        throw new Error(
          'Display name must contain at least 3 alphanumeric characters',
        )
      }

      // Try the base tag first, then add numbers (1-999) like Twitter
      for (let counter = 0; counter <= 999; counter++) {
        const tryTag = counter === 0 ? baseTag : `${baseTag}${counter}`

        // Check if this tag is available
        const { data, error } = await supabase
          .from('profiles')
          .select('user_tag')
          .eq('user_tag', tryTag)
          .maybeSingle()

        // If no error and no data, the tag is available
        if (!error && !data) {
          return tryTag
        }
      }

      throw new Error('Could not generate unique user tag')
    },

    async scheduleTrialNotification(
      userId: string,
      notificationId: string,
      scheduledAt: Date,
      trialStartDate: Date,
    ) {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          trial_notification_id: notificationId,
          trial_notification_scheduled_at: scheduledAt.toISOString(),
          trial_start_date: trialStartDate.toISOString(),
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return data as Profile
    },

    async getTrialNotificationStatus(userId: string) {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'trial_notification_id, trial_notification_scheduled_at, trial_start_date',
        )
        .eq('id', userId)
        .single()

      if (error) throw error
      return data as {
        trial_notification_id: string | null
        trial_notification_scheduled_at: string | null
        trial_start_date: string | null
      }
    },

    async cancelTrialNotification(userId: string) {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          trial_notification_id: null,
          trial_notification_scheduled_at: null,
        })
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
        const typedSessions = sessions as any
        typedSessions?.forEach((session: any) => {
          session.workout_exercises?.forEach((we: any) => {
            const exercise = we.exercise
            if (exercise && !exerciseMap.has(exercise.id)) {
              exerciseMap.set(exercise.id, exercise)
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
        // Return first match (system exercises are prioritized in seed order)
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
    },
  },

  // Workout session operations
  workoutSessions: {
    async create(
      userId: string,
      parsedWorkout: ParsedWorkout,
      rawText: string,
      imageUrl?: string | null,
    ) {
      // Create workout session
      const { data: session, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: userId,
          raw_text: rawText,
          notes: parsedWorkout.notes,
          type: parsedWorkout.type,
          image_url: imageUrl || null,
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
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            rpe: set.rpe ?? null,
            notes: set.notes ?? null,
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

    async getRecent(userId: string, limit = 10, offset = 0) {
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
        .range(offset, offset + limit - 1)

      if (error) throw error
      return data as WorkoutSessionWithDetails[]
    },

    async getThisWeekCount(userId: string, startOfWeek: Date) {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('user_id', userId)
        .gte('date', startOfWeek.toISOString())
        .order('date', { ascending: true })

      if (error) throw error
      return data?.length || 0
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

    async update(
      sessionId: string,
      updates: { type?: string; notes?: string; image_url?: string | null },
    ) {
      const { data, error } = await supabase
        .from('workout_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()
        .single()

      if (error) throw error
      return data as WorkoutSession
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

    async getLastForRoutine(
      userId: string,
      routineId: string,
    ): Promise<WorkoutSessionWithDetails | null> {
      console.log('[database.getLastForRoutine] Querying:', {
        userId,
        routineId,
      })

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
        .eq('routine_id', routineId)
        .order('date', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        console.log('[database.getLastForRoutine] Error:', {
          code: error.code,
          message: error.message,
        })
        // If no workout found, return null instead of throwing
        if (error.code === 'PGRST116') {
          console.log(
            '[database.getLastForRoutine] No workout found for this routine',
          )
          return null
        }
        throw error
      }

      console.log('[database.getLastForRoutine] Found workout:', {
        id: data?.id,
        exercises: data?.workout_exercises?.length,
      })

      return data as WorkoutSessionWithDetails
    },
  },

  // Set operations
  sets: {
    async create(
      workoutExerciseId: string,
      setData: {
        set_number: number
        reps?: number | null
        weight?: number | null
      },
    ) {
      const { data, error } = await supabase
        .from('sets')
        .insert({
          workout_exercise_id: workoutExerciseId,
          set_number: setData.set_number,
          reps: setData.reps ?? null,
          weight: setData.weight ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },

    async update(
      setId: string,
      updates: { reps?: number | null; weight?: number | null },
    ) {
      const { data, error } = await supabase
        .from('sets')
        .update(updates)
        .eq('id', setId)
        .select()
        .single()

      if (error) throw error
      return data
    },

    async delete(setId: string) {
      const { error } = await supabase.from('sets').delete().eq('id', setId)

      if (error) throw error
    },
  },

  // Workout Exercise operations
  workoutExercises: {
    async update(workoutExerciseId: string, exerciseId: string) {
      const { data, error } = await supabase
        .from('workout_exercises')
        .update({ exercise_id: exerciseId })
        .eq('id', workoutExerciseId)
        .select()
        .single()

      if (error) throw error
      return data
    },

    async delete(workoutExerciseId: string) {
      const { error } = await supabase
        .from('workout_exercises')
        .delete()
        .eq('id', workoutExerciseId)

      if (error) throw error
    },
  },

  // Stats and analytics
  stats: {
    // Key exercises for leaderboard rankings (main compound lifts only)
    LEADERBOARD_EXERCISES: [
      'Bench Press',
      'Incline Bench Press',
      'Dumbbell Bench Press',
      'Incline Dumbbell Press',
      'Squat',
      'Deadlift',
      'Overhead Press',
      'Dumbbell Shoulder Press',
      'Bent Over Row',
      'Pull-ups',
      'Weighted Pull-Ups',
      'Dips',
      'Weighted Dips',
    ] as string[],

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
        .not('workout_exercises.sets.reps', 'is', null)
        .gt('workout_exercises.sets.reps', 0)
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

      // Transform data to show running personal best estimated 1RM over time
      let runningMax = 0
      const progressData = (data as WeightProgressRow[])?.map((session) => {
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

        return {
          date: session.created_at,
          maxWeight: runningMax, // Show cumulative PR estimated 1RM
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
        .not('workout_exercises.sets.reps', 'is', null)
        .gt('workout_exercises.sets.reps', 0)
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

    async getMuscleGroupDistribution(userId: string, daysBack?: number) {
      let query = supabase
        .from('workout_sessions')
        .select(
          `
          workout_exercises!inner (
            exercise:exercises!inner (muscle_group),
            sets!inner (reps, weight)
          )
        `,
        )
        .eq('user_id', userId)
        .not('workout_exercises.exercise.muscle_group', 'is', null)

      // Filter by date range if specified
      if (daysBack) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysBack)
        query = query.gte('created_at', cutoffDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      // Calculate volume per muscle group
      const muscleGroupVolumes = new Map<string, number>()

      ;(data as any)?.forEach((session: any) => {
        session.workout_exercises?.forEach((we: any) => {
          const muscleGroup = we.exercise?.muscle_group
          if (!muscleGroup) return

          we.sets?.forEach((set: any) => {
            if (set.reps) {
              const volume = set.reps
              const currentVolume = muscleGroupVolumes.get(muscleGroup) || 0
              muscleGroupVolumes.set(muscleGroup, currentVolume + volume)
            }
          })
        })
      })

      // Calculate total volume
      const totalVolume = Array.from(muscleGroupVolumes.values()).reduce(
        (sum, vol) => sum + vol,
        0,
      )

      // Convert to array with percentages
      const distribution = Array.from(muscleGroupVolumes.entries())
        .map(([muscleGroup, volume]) => ({
          muscleGroup,
          volume: Math.round(volume),
          percentage:
            totalVolume > 0 ? Math.round((volume / totalVolume) * 100) : 0,
        }))
        .sort((a, b) => b.volume - a.volume) // Sort by volume descending

      return distribution
    },

    async getUserMax1RMs(userId: string) {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(
          `
          workout_exercises!inner (
            exercise_id,
            exercise:exercises!inner (id, name),
            sets!inner (reps, weight)
          )
        `,
        )
        .eq('user_id', userId)
        .not('workout_exercises.sets.weight', 'is', null)

      if (error) throw error

      // Calculate max 1RM for each exercise
      const exerciseMax1RMs = new Map<
        string,
        { name: string; max1RM: number }
      >()

      ;(data as any)?.forEach((session: any) => {
        session.workout_exercises?.forEach((we: any) => {
          if (!we.exercise) return

          we.sets?.forEach((set: any) => {
            if (set.reps && set.weight) {
              // Calculate estimated 1RM using Epley formula: weight × (1 + reps/30)
              const estimated1RM = set.weight * (1 + set.reps / 30)

              const current = exerciseMax1RMs.get(we.exercise_id)
              if (!current || estimated1RM > current.max1RM) {
                exerciseMax1RMs.set(we.exercise_id, {
                  name: we.exercise.name,
                  max1RM: Math.round(estimated1RM),
                })
              }
            }
          })
        })
      })

      return Array.from(exerciseMax1RMs.entries()).map(
        ([exerciseId, data]) => ({
          exerciseId,
          exerciseName: data.name,
          max1RM: data.max1RM,
        }),
      )
    },

    async getAllUsersMax1RMs(exerciseId: string) {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(
          `
          user_id,
          workout_exercises!inner (
            exercise_id,
            sets!inner (reps, weight)
          )
        `,
        )
        .eq('workout_exercises.exercise_id', exerciseId)
        .not('workout_exercises.sets.weight', 'is', null)

      if (error) throw error

      interface AllUsers1RMRow {
        user_id: string
        workout_exercises?: {
          sets?: {
            reps: number
            weight: number | null
          }[]
        }[]
      }

      // Calculate max 1RM for each user for this exercise
      const userMax1RMs = new Map<string, number>()

      ;(data as AllUsers1RMRow[])?.forEach((session) => {
        session.workout_exercises?.forEach((we) => {
          we.sets?.forEach((set) => {
            if (set.reps && set.weight) {
              // Calculate estimated 1RM using Epley formula: weight × (1 + reps/30)
              const estimated1RM = set.weight * (1 + set.reps / 30)

              const currentMax = userMax1RMs.get(session.user_id) || 0
              if (estimated1RM > currentMax) {
                userMax1RMs.set(session.user_id, estimated1RM)
              }
            }
          })
        })
      })

      // Return array of all max 1RMs (without user IDs for privacy)
      return Array.from(userMax1RMs.values())
    },

    async getExercisePercentile(userId: string, exerciseId: string) {
      try {
        const { data, error } = await supabase.rpc('get_exercise_percentiles', {
          p_exercise_id: exerciseId,
          p_user_id: userId,
        })

        if (error) throw error

        const row = Array.isArray(data) ? data[0] : data

        if (!row) return null

        const percentile =
          typeof row.overall_percentile === 'number'
            ? Math.round(row.overall_percentile)
            : null

        const userMax1RM =
          typeof row.user_est_1rm === 'number'
            ? Math.round(row.user_est_1rm)
            : null

        return {
          percentile,
          userMax1RM,
          totalUsers:
            typeof row.overall_total_users === 'number'
              ? row.overall_total_users
              : 0,
          exerciseName: row.exercise_name,
          gender: typeof row.gender === 'string' ? row.gender : null,
          genderPercentile:
            typeof row.gender_percentile === 'number'
              ? Math.round(row.gender_percentile)
              : null,
          genderWeightPercentile:
            typeof row.gender_weight_percentile === 'number'
              ? Math.round(row.gender_weight_percentile)
              : null,
          weightBucketStart:
            typeof row.weight_bucket_start === 'number'
              ? row.weight_bucket_start
              : null,
          weightBucketEnd:
            typeof row.weight_bucket_end === 'number'
              ? row.weight_bucket_end
              : null,
        }
      } catch (error) {
        console.error('Error calculating exercise percentile:', error)
        return null
      }
    },

    async getWeightForNextPercentile(
      exerciseId: string,
      currentPercentile: number,
      targetPercentile: number,
      filterGender?: string | null,
      weightBucketStart?: number | null,
      weightBucketEnd?: number | null,
    ) {
      try {
        const { data, error } = await supabase.rpc('get_weight_for_percentile', {
          p_exercise_id: exerciseId,
          p_target_percentile: targetPercentile,
          p_filter_gender: filterGender ?? null,
          p_bucket_start: weightBucketStart ?? null,
          p_bucket_end: weightBucketEnd ?? null,
        })

        if (error) throw error

        return typeof data === 'number' ? Math.round(data) : null
      } catch (error) {
        console.error('Error getting weight for next percentile:', error)
        return null
      }
    },

    async getUserLeaderboardRankings(userId: string) {
      try {
        const userMax1RMs = await this.getUserMax1RMs(userId)

        // Filter to only include key compound exercises
        const keyExercises = userMax1RMs.filter((exercise) =>
          this.LEADERBOARD_EXERCISES.includes(exercise.exerciseName),
        )

        if (keyExercises.length === 0) {
          return []
        }

        // Get percentiles for key exercises only
        const rankings = await Promise.all(
          keyExercises.map(async (exercise) => {
            const percentile = await this.getExercisePercentile(
              userId,
              exercise.exerciseId,
            )
            return {
              exerciseId: exercise.exerciseId,
              exerciseName: exercise.exerciseName,
              userMax1RM: exercise.max1RM,
              percentile: percentile?.percentile || 0,
              totalUsers: percentile?.totalUsers || 0,
              gender: percentile?.gender ?? null,
              genderPercentile: percentile?.genderPercentile ?? null,
              genderWeightPercentile:
                percentile?.genderWeightPercentile ?? null,
              weightBucketStart: percentile?.weightBucketStart ?? null,
              weightBucketEnd: percentile?.weightBucketEnd ?? null,
            }
          }),
        )

        // Sort by percentile (highest first) and return top exercises
        return rankings
          .filter((r) => r.totalUsers > 0) // Only include exercises with multiple users
          .sort((a, b) => b.percentile - a.percentile)
      } catch (error) {
        console.error('Error getting user leaderboard rankings:', error)
        return []
      }
    },
  },

  // Body log operations
  bodyLog: {
    /**
     * Create a new body log entry
     */
    async createEntry(userId: string) {
      console.log('[BODY_LOG] 🗄️ Database: Creating entry', {
        userId: userId.substring(0, 8),
      })

      const { data, error } = await supabase
        .from('body_log_entries')
        .insert({
          user_id: userId,
        })
        .select()
        .single()

      if (error) {
        console.error('[BODY_LOG] ❌ Database: Failed to create entry', error)
        throw error
      }

      console.log('[BODY_LOG] ✅ Database: Entry created successfully', {
        entryId: data?.id?.substring(0, 8),
      })
      return data
    },

    /**
     * Add an image to an existing entry
     */
    async addImage(
      entryId: string,
      userId: string,
      filePath: string,
      sequence: number,
    ) {
      console.log('[BODY_LOG] 🗄️ Database: Adding image to entry', {
        entryId: entryId.substring(0, 8),
        sequence,
        filePath: filePath.substring(0, 40) + '...',
      })

      const { data, error } = await supabase
        .from('body_log_images')
        .insert({
          entry_id: entryId,
          user_id: userId,
          file_path: filePath,
          sequence,
        })
        .select()
        .single()

      if (error) {
        console.error('[BODY_LOG] ❌ Database: Failed to add image', error)
        throw error
      }

      console.log('[BODY_LOG] ✅ Database: Image added successfully', {
        imageId: data?.id?.substring(0, 8),
        sequence,
      })
      return data
    },

    /**
     * Get an entry with all its images
     */
    async getEntry(entryId: string) {
      const { data, error } = await supabase
        .from('body_log_entries')
        .select(
          `
          id,
          user_id,
          created_at,
          weight_kg,
          body_fat_percentage,
          bmi,
          muscle_mass_kg,
          analysis_summary,
          body_log_images (
            id,
            entry_id,
            user_id,
            file_path,
            sequence,
            created_at
          )
        `,
        )
        .eq('id', entryId)
        .single()

      if (error) throw error

      // Transform body_log_images to images for consistency
      return {
        ...data,
        images: data?.body_log_images || [],
      }
    },

    /**
     * Get all entries for a user with their images
     */
    async getAllEntries(userId: string) {
      const { data, error } = await supabase
        .from('body_log_entries')
        .select(
          `
          id,
          user_id,
          created_at,
          weight_kg,
          body_fat_percentage,
          bmi,
          muscle_mass_kg,
          analysis_summary,
          body_log_images (
            id,
            entry_id,
            user_id,
            file_path,
            sequence,
            created_at
          )
        `,
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform body_log_images to images for consistency
      const transformedData = data?.map((entry: any) => ({
        ...entry,
        images: entry.body_log_images || [],
      }))

      return transformedData
    },

    /**
     * Update entry metrics (weight, body fat %, BMI)
     */
    async updateEntryMetrics(
      entryId: string,
      metrics: {
        weight_kg?: number | null
        body_fat_percentage?: number | null
        bmi?: number | null
        muscle_mass_kg?: number | null
      },
    ) {
      console.log('[BODY_LOG] 🗄️ Database: Updating entry metrics', {
        entryId: entryId.substring(0, 8),
        metrics,
      })

      const { data, error } = await supabase
        .from('body_log_entries')
        .update(metrics)
        .eq('id', entryId)
        .select()
        .single()

      if (error) {
        console.error('[BODY_LOG] ❌ Database: Failed to update metrics', error)
        throw error
      }

      console.log(
        '[BODY_LOG] ✅ Database: Entry metrics updated successfully',
        {
          entryId: entryId.substring(0, 8),
        },
      )
      return data
    },

    /**
     * Delete an entry and all its images
     */
    async deleteEntry(entryId: string) {
      // CASCADE delete will handle removing images
      const { error } = await supabase
        .from('body_log_entries')
        .delete()
        .eq('id', entryId)

      if (error) throw error
    },
  },

  // Workout Routine operations
  workoutRoutines: {
    /**
     * Create a new workout routine from scratch
     */
    async create(userId: string, name: string, notes?: string) {
      const { data, error } = await supabase
        .from('workout_routines')
        .insert({
          user_id: userId,
          name,
          notes: notes ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return data as WorkoutRoutine
    },

    /**
     * Create a routine from an existing workout session
     * Copies exercises and set counts, but not weight/reps/RPE (template only)
     */
    async createFromWorkout(workoutId: string, userId: string) {
      // Get the workout with all details
      const workout = await database.workoutSessions.getById(workoutId)

      // Create the routine using workout notes/type as the name
      const routineName = workout.notes || workout.type || 'New Routine'
      const { data: routine, error: routineError } = await supabase
        .from('workout_routines')
        .insert({
          user_id: userId,
          name: routineName,
          notes: workout.notes,
        })
        .select()
        .single()

      if (routineError) throw routineError

      const workoutExercises = workout.workout_exercises || []

      // Insert routine exercises
      const routineExercises = workoutExercises.map((we, index) => {
        const orderIndex =
          typeof we.order_index === 'number' && !Number.isNaN(we.order_index)
            ? we.order_index
            : index

        return {
          routine_id: routine.id,
          exercise_id: we.exercise_id,
          order_index: orderIndex,
          notes: we.notes,
        }
      })

      const {
        data: insertedExercises,
        error: exercisesError,
      } = await supabase
        .from('workout_routine_exercises')
        .insert(routineExercises)
        .select()

      if (exercisesError) throw exercisesError

      const insertedExerciseByOrder = new Map<number, string>()
      insertedExercises?.forEach((exercise: any) => {
        if (
          typeof exercise.order_index === 'number' &&
          !Number.isNaN(exercise.order_index)
        ) {
          insertedExerciseByOrder.set(exercise.order_index, exercise.id)
        }
      })

      // Insert routine sets (template only - no reps/weight)
      const routineSets = workoutExercises.flatMap((we, weIndex) => {
        const orderIndex =
          typeof we.order_index === 'number' && !Number.isNaN(we.order_index)
            ? we.order_index
            : weIndex
        const routineExerciseId = insertedExerciseByOrder.get(orderIndex)
        if (!routineExerciseId) {
          console.warn(
            '[database.workoutRoutines.createFromWorkout] Missing inserted exercise for order index',
            {
              routineId: routine.id,
              orderIndex,
              workoutExerciseId: we.id,
            },
          )
          return []
        }

        const sets = we.sets || []

        return sets.map((set) => ({
          routine_exercise_id: routineExerciseId,
          set_number: set.set_number,
          reps_min: null,
          reps_max: null,
        }))
      })

      if (routineSets.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_routine_sets')
          .insert(routineSets)

        if (setsError) throw setsError
      }

      return routine as WorkoutRoutine
    },

    /**
     * Get a routine by ID with all details
     */
    async getById(routineId: string) {
      const { data, error } = await supabase
        .from('workout_routines')
        .select(
          `
          *,
          workout_routine_exercises (
            *,
            exercise:exercises (*),
            sets:workout_routine_sets (*)
          )
        `,
        )
        .eq('id', routineId)
        .single()

      if (error) throw error
      return data as WorkoutRoutineWithDetails
    },

    /**
     * Get all routines for a user
     */
    async getAll(userId: string) {
      const { data, error } = await supabase
        .from('workout_routines')
        .select(
          `
          *,
          workout_routine_exercises (
            *,
            exercise:exercises (*),
            sets:workout_routine_sets (*)
          )
        `,
        )
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data as WorkoutRoutineWithDetails[]
    },

    /**
     * Update routine details
     */
    async update(
      routineId: string,
      updates: { name?: string; notes?: string; is_archived?: boolean },
    ) {
      const { data, error } = await supabase
        .from('workout_routines')
        .update(updates)
        .eq('id', routineId)
        .select()
        .single()

      if (error) throw error
      return data as WorkoutRoutine
    },

    /**
     * Delete a routine
     */
    async delete(routineId: string) {
      const { error } = await supabase
        .from('workout_routines')
        .delete()
        .eq('id', routineId)

      if (error) throw error
    },
  },
}
