import type {
  Exercise,
  ParsedWorkout,
  Profile,
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
      const normalizedName = name.trim().toLowerCase()

      // Try to find existing exercise by exact name match (case-insensitive)
      const { data: exactMatch } = await supabase
        .from('exercises')
        .select('*')
        .ilike('name', name)
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

      // No match found, create new exercise with proper capitalization
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
  },

  // Set operations
  sets: {
    async create(
      workoutExerciseId: string,
      setData: { set_number: number; reps: number; weight?: number | null },
    ) {
      const { data, error } = await supabase
        .from('sets')
        .insert({
          workout_exercise_id: workoutExerciseId,
          set_number: setData.set_number,
          reps: setData.reps,
          weight: setData.weight || null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },

    async update(
      setId: string,
      updates: { reps?: number; weight?: number | null },
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
      'Squat',
      'Deadlift',
      'Overhead Press',
      'Dumbbell Shoulder Press',
      'Bent Over Row',
      'Pull-ups',
      'Dip',
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
            if (set.reps && set.weight) {
              const volume = set.reps * set.weight
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
        // Get user's max 1RM for this exercise
        const userMax1RMs = await this.getUserMax1RMs(userId)
        const userExercise = userMax1RMs.find(
          (ex) => ex.exerciseId === exerciseId,
        )

        if (!userExercise) {
          return null // User hasn't performed this exercise
        }

        // Get all users' max 1RMs for this exercise
        const allUserMax1RMs = await this.getAllUsersMax1RMs(exerciseId)

        if (allUserMax1RMs.length === 0) {
          return {
            percentile: 100,
            userMax1RM: userExercise.max1RM,
            totalUsers: 0,
          }
        }

        // If only one user (you), you're at 100th percentile
        if (allUserMax1RMs.length === 1) {
          return {
            percentile: 100,
            userMax1RM: userExercise.max1RM,
            totalUsers: 1,
            exerciseName: userExercise.exerciseName,
          }
        }

        // Calculate percentile: percentage of users with lower or equal 1RM
        const usersWithLowerOrEqual1RM = allUserMax1RMs.filter(
          (max1RM) => max1RM <= userExercise.max1RM,
        ).length

        const percentile = Math.round(
          (usersWithLowerOrEqual1RM / allUserMax1RMs.length) * 100,
        )

        return {
          percentile,
          userMax1RM: userExercise.max1RM,
          totalUsers: allUserMax1RMs.length,
          exerciseName: userExercise.exerciseName,
        }
      } catch (error) {
        console.error('Error calculating exercise percentile:', error)
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
    async create(userId: string, filePath: string) {
      const { data, error } = await supabase
        .from('body_log_images')
        .insert({
          user_id: userId,
          file_path: filePath,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },

    async update(
      imageId: string,
      metrics: {
        weight_kg?: number
        body_fat_percentage?: number
        bmi?: number
        muscle_mass_kg?: number
      },
    ) {
      const { data, error } = await supabase
        .from('body_log_images')
        .update(metrics)
        .eq('id', imageId)
        .select()
        .single()

      if (error) throw error
      return data
    },

    async getAll(userId: string) {
      const { data, error } = await supabase
        .from('body_log_images')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },

    async delete(imageId: string) {
      const { error } = await supabase
        .from('body_log_images')
        .delete()
        .eq('id', imageId)

      if (error) throw error
    },
  },
}
