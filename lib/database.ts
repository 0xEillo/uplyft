import type {
    BodyLogEntryWithImages,
    BodyLogImage,
} from '@/lib/body-log/metadata'
import { generateExerciseMetadata } from '@/lib/exercise-metadata'
import { getLeaderboardExercises } from '@/lib/exercise-standards-config'
import { normalizeExerciseName } from '@/lib/utils/formatters'
import type {
    Exercise,
    ExploreProgram,
    ExploreProgramRoutine,
    ExploreRoutine,
    ExploreRoutineExercise,
    Follow,
    FollowRelationshipStatus,
    FollowRequest,
    ParsedWorkout,
    Profile,
    Set,
    WorkoutComment,
    WorkoutLike,
    WorkoutRoutine,
    WorkoutRoutineExercise,
    WorkoutRoutineWithDetails,
    WorkoutSession,
    WorkoutSessionWithDetails,
    WorkoutSocialStats,
} from '@/types/database.types'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Local types for Supabase query results
type WorkoutExerciseQueryResult = {
  exercise: Exercise | null
  sets?: Set[]
}

type SessionWithExercisesQueryResult = {
  id: string
  created_at: string
  workout_exercises?: WorkoutExerciseQueryResult[]
}

type ExploreProgramQueryResult = ExploreProgram & {
  explore_program_routines?: { routine_id: string }[]
}

type ExploreProgramRoutineQueryResult = ExploreProgramRoutine & {
  routine:
    | (ExploreRoutine & {
        explore_routine_exercises?: (ExploreRoutineExercise & {
          exercise: Pick<Exercise, 'id' | 'name' | 'target_muscles' | 'gif_url'>
        })[]
      })
    | null
}

type ExploreRoutineQueryResult = ExploreRoutine & {
  explore_routine_exercises?: (ExploreRoutineExercise & {
    exercise: Exercise
  })[]
}

// Body log entry from Supabase before transformation
type BodyLogEntryQueryResult = {
  id: string
  user_id: string
  created_at: string
  weight_kg: number | null
  body_fat_percentage: number | null
  bmi: number | null
  muscle_mass_kg?: number | null
  analysis_summary: string | null
  body_log_images?: BodyLogImage[]
}

type FollowActionStatus = 'following' | 'request_pending' | 'already_following'
type FollowRequestDecision = 'approve' | 'decline'

export interface FollowActionResult {
  status: FollowActionStatus
  requestId?: string | null
}

type FollowRequestWithFollower = FollowRequest & {
  follower?: Pick<Profile, 'id' | 'display_name' | 'user_tag' | 'avatar_url'>
}

type FollowRequestWithFollowee = FollowRequest & {
  followee?: Pick<Profile, 'id' | 'display_name' | 'user_tag' | 'avatar_url'>
}

const PRIVACY_ERROR_CODES = new Set(['PGRST301', '42501'])

const isPrivacyViolation = (error?: PostgrestError | null) => {
  if (!error) return false
  if (PRIVACY_ERROR_CODES.has(error.code)) return true
  return /rls|permission denied|not authorized/i.test(error.message ?? '')
}

const throwIfPrivacyViolation = (error?: PostgrestError | null) => {
  if (!error) return
  if (isPrivacyViolation(error)) {
    throw new PrivacyError()
  }
  throw error
}

export class PrivacyError extends Error {
  constructor(
    message = 'This athlete only shares workouts with approved followers.',
  ) {
    super(message)
    this.name = 'PrivacyError'
  }
}

const sanitizeProfileUpdates = (updates: Partial<Profile>) => {
  if (!updates) return updates
  const sanitized = { ...updates }

  if ('profile_description' in sanitized) {
    const raw = sanitized.profile_description
    if (raw === undefined) {
      // leave as undefined so Supabase ignores it
    } else if (raw === null) {
      sanitized.profile_description = null
    } else {
      const trimmed = raw.trim()
      sanitized.profile_description = trimmed.length > 0 ? trimmed : null
    }
  }

  return sanitized
}

export const database = {
  // Profile operations
  profiles: {
    async getById(userId: string) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) throw error
      if (!data) {
        throw new Error(`Profile not found for user ${userId}`)
      }
      return data as Profile
    },

    async getByIdOrNull(userId: string) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) throw error
      return data as Profile | null
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
      const sanitizedUpdates = sanitizeProfileUpdates(updates)
      const { data, error } = await supabase
        .from('profiles')
        .update(sanitizedUpdates)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return data as Profile
    },

    async searchByUserTag(userTag: string) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('user_tag', `${userTag}%`)
        .limit(10)

      if (error) throw error
      return (data || []) as Profile[]
    },

    async getByUserTag(userTag: string) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_tag', userTag)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data as Profile | null
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
        .maybeSingle()

      if (error) throw error

      // Return nulls if profile doesn't exist yet (e.g., for new anonymous users)
      if (!data) {
        return {
          trial_notification_id: null,
          trial_notification_scheduled_at: null,
          trial_start_date: null,
        }
      }

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

  // Follow operations
  follows: {
    async follow(
      followerId: string,
      followeeId: string,
    ): Promise<FollowActionResult> {
      if (followerId === followeeId) {
        throw new Error('Users cannot follow themselves')
      }

      const { data, error } = await supabase.rpc('request_follow', {
        follower: followerId,
        followee: followeeId,
      })

      if (error) throw error

      const status = (data?.status ?? 'following') as FollowActionStatus
      const requestId =
        data && typeof data === 'object' && 'request_id' in data
          ? (data as { request_id?: string | null }).request_id ?? null
          : null

      return {
        status,
        requestId,
      }
    },

    async unfollow(followerId: string, followeeId: string) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('followee_id', followeeId)

      if (error) throw error
    },

    async listFollowers(userId: string, limit = 50, offset = 0) {
      const { data, error } = await supabase
        .from('follows')
        .select(
          `
          *,
          follower:profiles!follows_follower_id_fkey (
            id,
            display_name,
            user_tag,
            avatar_url
          )
        `,
        )
        .eq('followee_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error
      return (data || []) as (Follow & {
        follower: Pick<
          Profile,
          'id' | 'display_name' | 'user_tag' | 'avatar_url'
        >
      })[]
    },

    async listFollowing(userId: string, limit = 50, offset = 0) {
      const { data, error } = await supabase
        .from('follows')
        .select(
          `
          *,
          followee:profiles!follows_followee_id_fkey (
            id,
            display_name,
            user_tag,
            avatar_url
          )
        `,
        )
        .eq('follower_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error
      return (data || []) as (Follow & {
        followee: Pick<
          Profile,
          'id' | 'display_name' | 'user_tag' | 'avatar_url'
        >
      })[]
    },

    async isFollowing(followerId: string, followeeId: string) {
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', followerId)
        .eq('followee_id', followeeId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      return !!data
    },

    async getCounts(userId: string) {
      const [followerRes, followingRes] = await Promise.all([
        supabase.rpc('follower_count', { target_user: userId }),
        supabase.rpc('following_count', { target_user: userId }),
      ])

      if (followerRes.error) throw followerRes.error
      if (followingRes.error) throw followingRes.error

      return {
        followers: followerRes.data ?? 0,
        following: followingRes.data ?? 0,
      }
    },
  },

  followRequests: {
    async listIncoming(userId: string) {
      const { data, error } = await supabase
        .from('follow_requests')
        .select(
          `
          *,
          follower:profiles!follow_requests_follower_id_fkey (
            id,
            display_name,
            user_tag,
            avatar_url
          )
        `,
        )
        .eq('followee_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as FollowRequestWithFollower[]
    },

    async listOutgoing(userId: string) {
      const { data, error } = await supabase
        .from('follow_requests')
        .select(
          `
          *,
          followee:profiles!follow_requests_followee_id_fkey (
            id,
            display_name,
            user_tag,
            avatar_url
          )
        `,
        )
        .eq('follower_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as FollowRequestWithFollowee[]
    },

    async respond(requestId: string, decision: FollowRequestDecision) {
      const { data, error } = await supabase.rpc('respond_follow_request', {
        request_id: requestId,
        decision,
      })

      if (error) throw error
      return data as { status: string }
    },

    async cancel(requestId: string, followerId: string) {
      const { error } = await supabase
        .from('follow_requests')
        .update({
          status: 'cancelled',
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('follower_id', followerId)
        .eq('status', 'pending')

      if (error) throw error
    },

    async countIncomingPending(userId: string) {
      const { count, error } = await supabase
        .from('follow_requests')
        .select('id', { count: 'exact', head: true })
        .eq('followee_id', userId)
        .eq('status', 'pending')

      if (error) throw error
      return count ?? 0
    },
  },

  relationships: {
    async getStatuses(
      viewerId: string,
      targetIds: string[],
    ): Promise<FollowRelationshipStatus[]> {
      if (!viewerId || targetIds.length === 0) {
        return []
      }

      const { data, error } = await supabase.rpc('get_relationship_statuses', {
        viewer: viewerId,
        target_ids: targetIds,
      })

      if (error) throw error
      return (data || []) as FollowRelationshipStatus[]
    },
  },

  // Workout like operations
  workoutLikes: {
    async like(workoutId: string, userId: string) {
      const { data, error } = await supabase
        .from('workout_likes')
        .insert({
          workout_id: workoutId,
          user_id: userId,
        })
        .select()
        .single()

      if (error) throw error
      return data as WorkoutLike
    },

    async unlike(workoutId: string, userId: string) {
      const { error } = await supabase
        .from('workout_likes')
        .delete()
        .eq('workout_id', workoutId)
        .eq('user_id', userId)

      if (error) throw error
    },

    async listByWorkout(workoutId: string) {
      const { data, error } = await supabase
        .from('workout_likes')
        .select('*')
        .eq('workout_id', workoutId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as WorkoutLike[]
    },

    async listByUser(userId: string, limit = 50, offset = 0) {
      const { data, error } = await supabase
        .from('workout_likes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error
      return (data || []) as WorkoutLike[]
    },

    async hasLiked(workoutId: string, userId: string) {
      const { data, error } = await supabase
        .from('workout_likes')
        .select('workout_id')
        .eq('workout_id', workoutId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      return !!data
    },

    async getCount(workoutId: string) {
      const { count, error } = await supabase
        .from('workout_likes')
        .select('*', { count: 'exact', head: true })
        .eq('workout_id', workoutId)

      if (error) throw error
      return count ?? 0
    },
  },

  // Workout comment operations
  workoutComments: {
    async add(workoutId: string, userId: string, content: string) {
      const trimmed = content.trim()
      if (!trimmed) {
        throw new Error('Comment content cannot be empty')
      }

      const { data, error } = await supabase
        .from('workout_comments')
        .insert({
          workout_id: workoutId,
          user_id: userId,
          content: trimmed,
        })
        .select()
        .single()

      if (error) throw error
      return data as WorkoutComment
    },

    async update(commentId: string, userId: string, content: string) {
      const trimmed = content.trim()
      if (!trimmed) {
        throw new Error('Comment content cannot be empty')
      }

      const { data, error } = await supabase
        .from('workout_comments')
        .update({
          content: trimmed,
        })
        .eq('id', commentId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data as WorkoutComment
    },

    async delete(commentId: string) {
      const { error } = await supabase
        .from('workout_comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error
    },

    async listByWorkout(workoutId: string, limit = 50, offset = 0) {
      const { data, error } = await supabase
        .from('workout_comments')
        .select('*')
        .eq('workout_id', workoutId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1)

      if (error) throw error
      return (data || []) as WorkoutComment[]
    },

    async getCount(workoutId: string) {
      const { count, error } = await supabase
        .from('workout_comments')
        .select('*', { count: 'exact', head: true })
        .eq('workout_id', workoutId)

      if (error) throw error
      return count ?? 0
    },
  },

  // Aggregated social metadata
  workoutSocial: {
    async getStatsForWorkout(workoutId: string) {
      const { data, error } = await supabase
        .from('workout_social_stats')
        .select('*')
        .eq('workout_id', workoutId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error

      if (!data) {
        return {
          workout_id: workoutId,
          like_count: 0,
          comment_count: 0,
        } as WorkoutSocialStats
      }

      return data as WorkoutSocialStats
    },

    async getStatsForWorkouts(workoutIds: string[]) {
      if (workoutIds.length === 0) {
        return [] as WorkoutSocialStats[]
      }

      const { data, error } = await supabase
        .from('workout_social_stats')
        .select('*')
        .in('workout_id', workoutIds)

      if (error) throw error

      // Ensure we return zeros for workouts missing from the view
      const statsMap = new Map<string, WorkoutSocialStats>()
      ;(data as WorkoutSocialStats[] | null)?.forEach((row) => {
        statsMap.set(row.workout_id, row)
      })

      return workoutIds.map((id) => {
        const stat = statsMap.get(id)
        if (stat) return stat
        return {
          workout_id: id,
          like_count: 0,
          comment_count: 0,
        } as WorkoutSocialStats
      })
    },
  },

  // Exercise operations
  exercises: {
    async getById(id: string) {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Exercise
    },

    async findByNames(names: string[]) {
      if (!names || names.length === 0) return []
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .in('name', names)

      if (error) throw error
      return data as Exercise[]
    },

    async getAll() {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name')

      if (error) throw error
      return data as Exercise[]
    },

    async getMuscleGroups() {
      const { data, error } = await supabase
        .from('exercises')
        .select('muscle_group')
        .not('muscle_group', 'is', null)
        .order('muscle_group', { ascending: true })

      if (error) throw error
      const groups = Array.from(
        new Set(
          (data || [])
            .map((row) => row.muscle_group)
            .filter((group): group is string => Boolean(group)),
        ),
      )
      return groups
    },

    async getEquipment() {
      const { data, error } = await supabase
        .from('exercises')
        .select('equipment')
        .not('equipment', 'is', null)
        .order('equipment', { ascending: true })

      if (error) throw error
      const equipment = Array.from(
        new Set(
          (data || [])
            .map((row) => row.equipment)
            .filter((item): item is string => Boolean(item)),
        ),
      )
      return equipment
    },

    async getRecent(userId: string, limit = 15) {
      // Get recent workout sessions for the user
      const { data: sessions, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select(
          `
          workout_exercises!inner (
            exercise_id,
            created_at,
            exercise:exercises!inner (*)
          )
        `,
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(40) // Fetch last 40 workouts to get a good spread (ensure we find unique exercises)

      if (sessionsError) throw sessionsError

      // Flatten and extract unique exercises
      const exerciseMap = new Map<string, Exercise>()
      const recentExercises: Exercise[] = []

      // Iterate through sessions (newest first)
      type SessionResult = { workout_exercises?: { exercise?: Exercise }[] }
      ;((sessions as unknown) as SessionResult[])?.forEach((session) => {
        // Sort exercises in session by created_at (though usually consistent)
        const sessionExercises = session.workout_exercises || []

        sessionExercises.forEach((we) => {
          if (we.exercise && !exerciseMap.has(we.exercise.id)) {
            exerciseMap.set(we.exercise.id, we.exercise)
            recentExercises.push(we.exercise)
          }
        })
      })

      // Sort by recency (already sorted by session date)
      return recentExercises.slice(0, limit)
    },

    async getMostFrequentMuscleGroups(userId: string, limit = 4) {
      // Get recent workout sessions for the user to analyze muscle usage
      const { data: sessions, error } = await supabase
        .from('workout_sessions')
        .select(
          `
          workout_exercises!inner (
            exercise:exercises!inner (
              muscle_group
            )
          )
        `,
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20) // Analyze last 20 workouts

      if (error) throw error

      const muscleCounts = new Map<string, number>()

      type MuscleQueryResult = {
        workout_exercises?: { exercise?: { muscle_group: string } }[]
      }
      ;((sessions as unknown) as MuscleQueryResult[])?.forEach((session) => {
        session.workout_exercises?.forEach((we) => {
          const muscle = we.exercise?.muscle_group
          if (muscle) {
            muscleCounts.set(muscle, (muscleCounts.get(muscle) || 0) + 1)
          }
        })
      })

      // Sort by frequency
      return Array.from(muscleCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([muscle]) => muscle)
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
        type ExerciseSessionResult = {
          workout_exercises?: { exercise?: Exercise }[]
        }
        ;((sessions as unknown) as ExerciseSessionResult[])?.forEach(
          (session) => {
            session.workout_exercises?.forEach((we) => {
              const exercise = we.exercise
              if (exercise && !exerciseMap.has(exercise.id)) {
                exerciseMap.set(exercise.id, exercise)
              }
            })
          },
        )

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

      // Normalize to title case (e.g., "leg press" -> "Leg Press")
      const normalizedName = normalizeExerciseName(trimmedName)
      const searchName = normalizedName.toLowerCase()

      // Try to find existing exercise by exact name match (case-insensitive)
      const { data: exactMatch } = await supabase
        .from('exercises')
        .select('*')
        .ilike('name', normalizedName)
        .single()

      if (exactMatch) return exactMatch as Exercise

      // Try to find by alias match
      const { data: aliasMatches } = await supabase
        .from('exercises')
        .select('*')
        .contains('aliases', [searchName])

      if (aliasMatches && aliasMatches.length > 0) {
        // Return first match (system exercises are prioritized in seed order)
        return aliasMatches[0] as Exercise
      }

      // No match found - create new exercise with AI-generated metadata
      // This uses AI to infer muscle_group, type (compound/isolation), and equipment
      const metadata = await generateExerciseMetadata(normalizedName)

      const { data, error } = await supabase
        .from('exercises')
        .insert({
          name: normalizedName,
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

    async createWithMetadata(
      name: string,
      userId: string,
      metadata: {
        muscle_group: string
        type: string
        equipment: string
      },
    ) {
      console.log('[database.exercises.createWithMetadata] Called', {
        name,
        userId,
        metadata,
      })

      // Validate and sanitize name
      if (!name || typeof name !== 'string') {
        console.error(
          '[database.exercises.createWithMetadata] Invalid name type',
        )
        throw new Error('Invalid exercise name')
      }

      const trimmedName = name.trim()
      if (!trimmedName) {
        console.error('[database.exercises.createWithMetadata] Empty name')
        throw new Error('Exercise name cannot be empty')
      }

      if (trimmedName.length > 100) {
        console.error('[database.exercises.createWithMetadata] Name too long')
        throw new Error('Exercise name must be 100 characters or less')
      }

      // Check for XSS patterns
      if (
        trimmedName.toLowerCase().includes('script') ||
        trimmedName.toLowerCase().includes('javascript')
      ) {
        console.error(
          '[database.exercises.createWithMetadata] XSS pattern detected',
        )
        throw new Error('Invalid exercise name')
      }

      // Normalize the name
      const normalizedName = trimmedName
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      console.log(
        '[database.exercises.createWithMetadata] Normalized name',
        normalizedName,
      )

      // Check if exercise already exists
      console.log(
        '[database.exercises.createWithMetadata] Checking for existing exercise',
      )
      const { data: existing, error: existingError } = await supabase
        .from('exercises')
        .select('id')
        .ilike('name', normalizedName)
        .limit(1)
        .single()

      if (existingError && existingError.code !== 'PGRST116') {
        console.error(
          '[database.exercises.createWithMetadata] Error checking existing',
          existingError,
        )
        throw existingError
      }

      if (existing) {
        console.log(
          '[database.exercises.createWithMetadata] Exercise already exists',
          existing.id,
        )
        const { data } = await supabase
          .from('exercises')
          .select('*')
          .eq('id', existing.id)
          .single()
        return data as Exercise
      }

      // Create new exercise with provided metadata
      console.log(
        '[database.exercises.createWithMetadata] Creating new exercise with metadata',
      )
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          name: normalizedName,
          created_by: userId,
          muscle_group: metadata.muscle_group,
          type: metadata.type,
          equipment: metadata.equipment,
        })
        .select()
        .single()

      if (error) {
        console.error(
          '[database.exercises.createWithMetadata] Insert error',
          error,
        )
        throw error
      }

      console.log(
        '[database.exercises.createWithMetadata] Exercise created successfully',
        data,
      )
      return data as Exercise
    },

    async update(
      exerciseId: string,
      userId: string,
      updates: {
        name?: string
        muscle_group?: string
        type?: string
        equipment?: string
      },
    ) {
      // First, verify the user owns this exercise
      const { data: exercise, error: fetchError } = await supabase
        .from('exercises')
        .select('id, created_by')
        .eq('id', exerciseId)
        .single()

      if (fetchError) throw fetchError
      if (!exercise) throw new Error('Exercise not found')
      if (exercise.created_by !== userId) {
        throw new Error('You can only update exercises that you created')
      }

      // If name is being updated, normalize it
      const finalUpdates: typeof updates = { ...updates }
      if (updates.name) {
        const trimmed = updates.name.trim()
        if (!trimmed) throw new Error('Exercise name cannot be empty')
        
        // Normalize
        finalUpdates.name = trimmed
            .toLowerCase()
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
      }

      const { data, error } = await supabase
        .from('exercises')
        .update(finalUpdates)
        .eq('id', exerciseId)
        .select()
        .single()

      if (error) throw error
      return data as Exercise
    },

    async delete(exerciseId: string, userId: string) {
      // First, verify the user owns this exercise
      const { data: exercise, error: fetchError } = await supabase
        .from('exercises')
        .select('id, created_by')
        .eq('id', exerciseId)
        .single()

      if (fetchError) {
        console.error(
          '[database.exercises.delete] Error fetching exercise:',
          fetchError,
        )
        throw fetchError
      }

      if (!exercise) {
        throw new Error('Exercise not found')
      }

      // Check if the user owns this exercise
      if (exercise.created_by !== userId) {
        throw new Error('You can only delete exercises that you created')
      }

      // Delete the exercise
      const { error: deleteError } = await supabase
        .from('exercises')
        .delete()
        .eq('id', exerciseId)
        .eq('created_by', userId) // Double-check ownership at DB level

      if (deleteError) {
        console.error(
          '[database.exercises.delete] Error deleting exercise:',
          deleteError,
        )
        throw deleteError
      }

      console.log(
        '[database.exercises.delete] Exercise deleted successfully:',
        exerciseId,
      )
      return true
    },
  },

  // Workout session operations
  workoutSessions: {
    async create(
      userId: string,
      parsedWorkout: ParsedWorkout,
      rawText: string,
      imageUrl?: string | null,
      durationSeconds?: number | null,
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
          duration:
            typeof durationSeconds === 'number' ? durationSeconds : null,
        })
        .select()
        .single()

      if (sessionError) throw sessionError

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
            is_warmup: set.is_warmup === true,
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
          routine:workout_routines (id, name),
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

      if (error) {
        throwIfPrivacyViolation(error)
      }

      if (!data || data.length === 0) {
        return []
      }

      // Fetch profile for the user to display avatar/name
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_tag, display_name, avatar_url')
        .eq('id', userId)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile for getRecent:', profileError)
      }

      // Attach profile to each workout
      const workoutsWithProfile = data.map((workout) => ({
        ...workout,
        profile: profile || undefined,
      }))

      return workoutsWithProfile as WorkoutSessionWithDetails[]
    },

    async getSocialFeed(userId: string, limit = 10, offset = 0) {
      // First, get the list of users whose workouts we want to see:
      // 1. The authenticated user
      // 2. Users they follow
      const { data: followData, error: followError } = await supabase
        .from('follows')
        .select('followee_id')
        .eq('follower_id', userId)

      if (followError) throw followError

      // Build array of user IDs to fetch workouts from
      const followeeIds = followData?.map((f) => f.followee_id) || []
      const authorIds = [userId, ...followeeIds]

      // Fetch workouts from all these users
      const { data: workouts, error } = await supabase
        .from('workout_sessions')
        .select(
          `
          *,
          routine:workout_routines (id, name),
          workout_exercises (
            *,
            exercise:exercises (*),
            sets (*)
          )
        `,
        )
        .in('user_id', authorIds)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throwIfPrivacyViolation(error)
      }
      if (!workouts || workouts.length === 0) {
        return []
      }

      // Fetch profiles for all unique user IDs in the workouts
      const uniqueUserIds = [...new Set(workouts.map((w) => w.user_id))]
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_tag, display_name, avatar_url')
        .in('id', uniqueUserIds)

      if (profileError) throw profileError

      // Create a map of user_id -> profile for quick lookup
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

      // Attach profile to each workout
      const workoutsWithProfiles = workouts.map((workout) => ({
        ...workout,
        profile: profileMap.get(workout.user_id),
      }))

      return workoutsWithProfiles as WorkoutSessionWithDetails[]
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

    async getWeeklyWorkoutCount(
      userId: string,
      targetDate: Date,
      workoutId: string,
    ) {
      // Calculate start of week (Monday) for the target date
      const d = new Date(targetDate)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
      const startOfWeek = new Date(d)
      startOfWeek.setDate(diff)
      startOfWeek.setHours(0, 0, 0, 0)

      // Calculate end of week (Sunday end of day)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 7)

      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, date, created_at')
        .eq('user_id', userId)
        .gte('date', startOfWeek.toISOString())
        .lt('date', endOfWeek.toISOString())
        .order('date', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error

      const index = data?.findIndex((w) => w.id === workoutId) ?? -1
      const count = index !== -1 ? index + 1 : 0

      return count
    },

    async getTotalCount(userId: string) {
      const { count, error } = await supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (error) throw error
      return count || 0
    },

    async getById(id: string) {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(
          `
          *,
          routine:workout_routines (id, name),
          workout_exercises (
            *,
            exercise:exercises (*),
            sets (*)
          )
        `,
        )
        .eq('id', id)
        .single()

      if (error) {
        throwIfPrivacyViolation(error)
      }
      return data as WorkoutSessionWithDetails
    },

    async update(
      sessionId: string,
      updates: {
        type?: string | null
        notes?: string | null
        image_url?: string | null
        date?: string
      },
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
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(
          `
          *,
          routine:workout_routines (id, name),
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
        // If no workout found, return null instead of throwing
        if (error.code === 'PGRST116') {
          return null
        }

        console.error('[database.getLastForRoutine] Error fetching workout:', {
          code: error.code,
          message: error.message,
        })
        throw error
      }

      return data as WorkoutSessionWithDetails
    },

    async getCountByUserId(userId: string): Promise<number> {
      const { count, error } = await supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (error) throw error
      return count || 0
    },

    /**
     * Get workout sessions with muscle group info for recovery tracking
     * Returns sessions from the specified date onwards, including set details for intensity calculation
     */
    async getWithMuscleGroups(userId: string, fromDate: Date) {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(
          `
          id,
          created_at,
          date,
          workout_exercises (
            id,
            exercise:exercises (
              id,
              name,
              muscle_group,
              secondary_muscles
            ),
            sets (
              id,
              reps,
              weight
            )
          )
        `,
        )
        .eq('user_id', userId)
        .gte('date', fromDate.toISOString())
        .order('date', { ascending: false })

      return { data, error }
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
    async create(sessionId: string, exerciseId: string, orderIndex: number) {
      const { data, error } = await supabase
        .from('workout_exercises')
        .insert({
          session_id: sessionId,
          exercise_id: exerciseId,
          order_index: orderIndex,
        })
        .select(
          `
          *,
          exercise:exercises (*),
          sets (*)
        `,
        )
        .single()

      if (error) throw error
      return data
    },

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
    // Key exercises for percentile tracking and strength standards (main compound lifts only)
    // Imported from centralized configuration to ensure consistency with strength standards
    LEADERBOARD_EXERCISES: getLeaderboardExercises(),

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
            const reps = set.reps || 0
            if (!reps) return

            const weight =
              typeof set.weight === 'number' && set.weight > 0 ? set.weight : 1

            totalVolume += reps * weight
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

    async getVolumeProgress(userId: string, daysBack?: number) {
      let query = supabase
        .from('workout_sessions')
        .select(
          `
          id,
          created_at,
          workout_exercises!inner (
            sets!inner (reps, weight)
          )
        `,
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      // Filter by date range if specified
      if (daysBack) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysBack)
        query = query.gte('created_at', cutoffDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      interface VolumeProgressRow {
        id: string
        created_at: string
        workout_exercises?: {
          sets?: {
            reps: number
            weight: number | null
          }[]
        }[]
      }

      // Calculate total volume for each workout session
      const progressData = (data as VolumeProgressRow[])?.map((session) => {
        let totalVolume = 0

        session.workout_exercises?.forEach((we) => {
          we.sets?.forEach((set) => {
            const reps = set.reps || 0
            if (!reps) return

            const weight =
              typeof set.weight === 'number' && set.weight > 0 ? set.weight : 1

            // Volume = reps * weight
            totalVolume += reps * weight
          })
        })

        return {
          date: session.created_at,
          volume: totalVolume,
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

      type VolumeSessionResult = {
        workout_exercises?: {
          exercise?: { muscle_group: string }
          sets?: { reps: number | null }[]
        }[]
      }
      ;((data as unknown) as VolumeSessionResult[])?.forEach((session) => {
        session.workout_exercises?.forEach((we) => {
          const muscleGroup = we.exercise?.muscle_group
          if (!muscleGroup) return

          we.sets?.forEach((set) => {
            const reps = set.reps || 0
            if (!reps) return

            // const weight =
            //   typeof set.weight === 'number' && set.weight > 0 ? set.weight : 1

            const volume = reps // Muscle balance based on reps only
            const currentVolume = muscleGroupVolumes.get(muscleGroup) || 0
            muscleGroupVolumes.set(muscleGroup, currentVolume + volume)
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

    async getWeeklyVolumeData(userId: string, daysBack?: number) {
      let query = supabase
        .from('workout_sessions')
        .select(
          `
          id,
          created_at,
          workout_exercises!inner (
            exercise:exercises!inner (muscle_group),
            sets!inner (reps)
          )
        `,
        )
        .eq('user_id', userId)
        .not('workout_exercises.exercise.muscle_group', 'is', null)
        .order('created_at', { ascending: true })

      // Filter by date range if specified
      if (daysBack) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysBack)
        query = query.gte('created_at', cutoffDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      // Group by week (Sunday start)
      const weeklyData = new Map<string, Map<string, number>>()

      type WeeklyVolumeSession = {
        id: string
        created_at: string
        workout_exercises?: {
          exercise?: { muscle_group: string }
          sets?: { reps: number | null }[]
        }[]
      }
      ;((data as unknown) as WeeklyVolumeSession[])?.forEach((session) => {
        const sessionDate = new Date(session.created_at)

        // Get Sunday of the week
        const dayOfWeek = sessionDate.getDay()
        const weekStart = new Date(sessionDate)
        weekStart.setDate(sessionDate.getDate() - dayOfWeek)
        weekStart.setHours(0, 0, 0, 0)
        const weekKey = weekStart.toISOString().split('T')[0]

        if (!weeklyData.has(weekKey)) {
          weeklyData.set(weekKey, new Map<string, number>())
        }

        const weekMuscleGroups = weeklyData.get(weekKey)!

        session.workout_exercises?.forEach((we) => {
          const muscleGroup = we.exercise?.muscle_group
          if (!muscleGroup) return

          we.sets?.forEach((set) => {
            if (set.reps) {
              const currentSets = weekMuscleGroups.get(muscleGroup) || 0
              weekMuscleGroups.set(muscleGroup, currentSets + 1)
            }
          })
        })
      })

      // Convert to array format
      return Array.from(weeklyData.entries())
        .map(([weekStart, muscleGroups]) => ({
          weekStart,
          muscleGroups: Array.from(muscleGroups.entries())
            .map(([name, sets]) => ({ name, sets }))
            .sort((a, b) => b.sets - a.sets),
        }))
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    },

    async getSessionStats(userId: string, daysBack?: number) {
      let query = supabase
        .from('workout_sessions')
        .select(
          `
          id,
          workout_exercises!inner (
            sets!inner (reps)
          )
        `,
        )
        .eq('user_id', userId)

      // Filter by date range if specified
      if (daysBack) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysBack)
        query = query.gte('created_at', cutoffDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      let totalSets = 0
      const totalWorkouts = data?.length || 0

      type SessionStatsResult = {
        id: string
        workout_exercises?: {
          sets?: { reps: number | null }[]
        }[]
      }
      ;((data as unknown) as SessionStatsResult[])?.forEach((session) => {
        session.workout_exercises?.forEach((we) => {
          we.sets?.forEach((set) => {
            if (set.reps) {
              totalSets++
            }
          })
        })
      })

      return {
        totalSets,
        totalWorkouts,
        avgSetsPerWorkout:
          totalWorkouts > 0 ? Math.round(totalSets / totalWorkouts) : 0,
      }
    },

    async getUserMax1RMs(userId: string) {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(
          `
          workout_exercises!inner (
            exercise_id,
            exercise:exercises!inner (id, name, muscle_group, gif_url),
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
        {
          name: string
          muscleGroup: string | null
          max1RM: number
          gifUrl: string | null
        }
      >()

      type Max1RMSessionResult = {
        workout_exercises?: {
          exercise_id: string
          exercise?: {
            id: string
            name: string
            muscle_group: string
            gif_url: string | null
          }
          sets?: { reps: number | null; weight: number | null }[]
        }[]
      }
      ;((data as unknown) as Max1RMSessionResult[])?.forEach((session) => {
        session.workout_exercises?.forEach((we) => {
          const exercise = we.exercise
          if (!exercise) return

          we.sets?.forEach((set) => {
            if (set.reps && set.weight) {
              // Calculate estimated 1RM using Epley formula: weight × (1 + reps/30)
              const estimated1RM = set.weight * (1 + set.reps / 30)

              const current = exerciseMax1RMs.get(we.exercise_id)
              if (!current || estimated1RM > current.max1RM) {
                exerciseMax1RMs.set(we.exercise_id, {
                  name: exercise.name,
                  muscleGroup: exercise.muscle_group,
                  max1RM: Math.round(estimated1RM),
                  gifUrl: exercise.gif_url,
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
          muscleGroup: data.muscleGroup,
          max1RM: data.max1RM,
          gifUrl: data.gifUrl,
        }),
      )
    },

    async getExerciseRecordsByWeight(userId: string, exerciseId: string) {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(
          `
          id,
          date,
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

      if (error) throw error

      interface RecordsByWeightRow {
        id: string
        date: string
        created_at: string
        workout_exercises?: {
          sets?: {
            reps: number
            weight: number | null
          }[]
        }[]
      }

      // Track max reps achieved at each weight and the date achieved
      const weightRecords = new Map<
        number,
        { maxReps: number; date: string; estimated1RM: number }
      >()

      ;(data as RecordsByWeightRow[])?.forEach((session) => {
        session.workout_exercises?.forEach((we) => {
          we.sets?.forEach((set) => {
            if (set.weight && set.reps) {
              const weight = set.weight
              const reps = set.reps
              const estimated1RM = weight * (1 + reps / 30)

              const existing = weightRecords.get(weight)
              if (!existing || reps > existing.maxReps) {
                weightRecords.set(weight, {
                  maxReps: reps,
                  date: session.date || session.created_at,
                  estimated1RM: Math.round(estimated1RM),
                })
              }
            }
          })
        })
      })

      // Convert to array and sort by weight descending
      return Array.from(weightRecords.entries())
        .map(([weight, record]) => ({
          weight,
          maxReps: record.maxReps,
          date: record.date,
          estimated1RM: record.estimated1RM,
        }))
        .sort((a, b) => b.weight - a.weight)
    },

    async getMajorCompoundLiftsData(userId: string) {
      // Get all user's max 1RMs
      const all1RMs = await this.getUserMax1RMs(userId)

      // Filter to only major compound lifts (exercises with strength standards)
      const compoundLifts = all1RMs.filter((exercise) =>
        this.LEADERBOARD_EXERCISES.includes(exercise.exerciseName),
      )

      // For each compound lift, get detailed records
      const detailedData = await Promise.all(
        compoundLifts.map(async (lift) => {
          const records = await this.getExerciseRecordsByWeight(
            userId,
            lift.exerciseId,
          )
          return {
            exerciseId: lift.exerciseId,
            exerciseName: lift.exerciseName,
            muscleGroup: lift.muscleGroup,
            max1RM: lift.max1RM,
            gifUrl: lift.gifUrl,
            records,
          }
        }),
      )

      return detailedData
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

    /**
     * Get workout dates in a specific date range for calendar display
     */
    async getWorkoutDatesInRange(
      userId: string,
      startDate: Date,
      endDate: Date,
    ): Promise<string[]> {
      try {
        const { data, error } = await supabase
          .from('workout_sessions')
          .select('date')
          .eq('user_id', userId)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0])
          .order('date', { ascending: true })

        if (error) throw error

        // Extract unique dates (YYYY-MM-DD format)
        const dates = new Set<string>()
        data?.forEach((session) => {
          const dateStr = session.date.split('T')[0]
          dates.add(dateStr)
        })

        return Array.from(dates)
      } catch (error) {
        console.error('Error getting workout dates in range:', error)
        return []
      }
    },

    /**
     * Calculate workout streak based on consecutive weeks with at least one workout
     * Returns current streak in weeks and last workout date
     *
     * A streak counts consecutive weeks where you've worked out at least once.
     * The streak is maintained if:
     * - The current week has a workout, OR
     * - The current week hasn't had a workout yet, but last week did (grace period)
     *
     * @param includeCurrentWeek - If true, assume the current week counts (for when
     *        calculating streak while submitting a workout that hasn't been saved yet)
     */
    async calculateStreak(
      userId: string,
      weeklyGoal: number = 3,
      includeCurrentWeek: boolean = false,
    ): Promise<{ currentStreak: number; lastWorkoutDate: string | null }> {
      try {
        // Fetch all workout dates
        const { data, error } = await supabase
          .from('workout_sessions')
          .select('date')
          .eq('user_id', userId)
          .order('date', { ascending: false })

        if (error) throw error

        // If no workouts but we're including current week (submitting now), streak is 1
        if (!data || data.length === 0) {
          if (includeCurrentWeek) {
            return { currentStreak: 1, lastWorkoutDate: null }
          }
          return { currentStreak: 0, lastWorkoutDate: null }
        }

        // Get unique dates and sort descending
        const uniqueDates = Array.from(
          new Set(data.map((s) => s.date.split('T')[0])),
        ).sort((a, b) => b.localeCompare(a))

        const lastWorkoutDate = uniqueDates[0]

        // Group workouts by week (Sunday-Saturday)
        const getWeekKey = (dateStr: string) => {
          const date = new Date(dateStr + 'T00:00:00')
          // Get Sunday of the week
          const day = date.getDay()
          const sunday = new Date(date)
          sunday.setDate(date.getDate() - day)
          return sunday.toISOString().split('T')[0]
        }

        // Get all weeks with at least one workout
        const weeksWithWorkouts = new Set<string>()
        uniqueDates.forEach((dateStr) => {
          const weekKey = getWeekKey(dateStr)
          weeksWithWorkouts.add(weekKey)
        })

        // Calculate current week start (Sunday)
        const today = new Date()
        const currentWeekStart = new Date(today)
        currentWeekStart.setDate(today.getDate() - today.getDay())
        currentWeekStart.setHours(0, 0, 0, 0)
        const currentWeekKey = currentWeekStart.toISOString().split('T')[0]

        // Calculate last week start (Sunday)
        const lastWeekStart = new Date(currentWeekStart)
        lastWeekStart.setDate(currentWeekStart.getDate() - 7)
        const lastWeekKey = lastWeekStart.toISOString().split('T')[0]

        // If includeCurrentWeek is true, add the current week to the set
        // (this handles the case when we're submitting a workout that hasn't been saved yet)
        if (includeCurrentWeek) {
          weeksWithWorkouts.add(currentWeekKey)
        }

        // Determine the starting week for streak calculation
        // If current week has a workout, start from current week
        // If current week has no workout but last week does, start from last week
        // Otherwise, streak is 0
        const hasCurrentWeekWorkout = weeksWithWorkouts.has(currentWeekKey)
        const hasLastWeekWorkout = weeksWithWorkouts.has(lastWeekKey)

        let streakStartWeek: Date
        if (hasCurrentWeekWorkout) {
          streakStartWeek = currentWeekStart
        } else if (hasLastWeekWorkout) {
          // Grace period: current week hasn't had a workout yet, but streak is still valid
          // if last week had a workout
          streakStartWeek = lastWeekStart
        } else {
          // No workout in current or last week - streak is broken
          return { currentStreak: 0, lastWorkoutDate }
        }

        // Sort weeks descending
        const weeks = Array.from(weeksWithWorkouts).sort((a, b) =>
          b.localeCompare(a),
        )

        // Calculate current streak - consecutive weeks with at least one workout
        // Starting from streakStartWeek and going backwards
        let currentStreak = 0
        for (let i = 0; i < weeks.length; i++) {
          const week = weeks[i]

          // Calculate expected week for this position in the streak
          const expectedWeek = new Date(streakStartWeek)
          expectedWeek.setDate(streakStartWeek.getDate() - i * 7)
          const expectedWeekKey = expectedWeek.toISOString().split('T')[0]

          // If this week matches the expected consecutive week, continue streak
          if (week === expectedWeekKey) {
            currentStreak++
          } else {
            // Streak is broken
            break
          }
        }

        return { currentStreak, lastWorkoutDate }
      } catch (error) {
        console.error('Error calculating streak:', error)
        return { currentStreak: 0, lastWorkoutDate: null }
      }
    },
  },

  // Body log operations
  bodyLog: {
    /**
     * Create a new body log entry
     */
    async createEntry(
      userId: string,
      options?: {
        weightKg?: number | null
      },
    ) {
      const payload: {
        user_id: string
        weight_kg?: number
      } = {
        user_id: userId,
      }

      if (
        options &&
        options.weightKg !== undefined &&
        options.weightKg !== null &&
        !Number.isNaN(options.weightKg)
      ) {
        payload.weight_kg = options.weightKg
      }

      const { data, error } = await supabase
        .from('body_log_entries')
        .insert(payload)
        .select()
        .single()

      if (error) {
        throw error
      }

      // Sync weight to user profile if provided
      if (payload.weight_kg !== undefined) {
        await supabase
          .from('profiles')
          .update({ weight_kg: payload.weight_kg })
          .eq('id', userId)
      }

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
        throw error
      }

      return data
    },

    /**
     * Get weight history for a user
     */
    async getWeightHistory(userId: string, daysBack?: number) {
      let query = supabase
        .from('body_log_entries')
        .select('created_at, weight_kg')
        .eq('user_id', userId)
        .not('weight_kg', 'is', null)
        .order('created_at', { ascending: true })

      if (daysBack) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysBack)
        query = query.gte('created_at', cutoffDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error
      return data as { created_at: string; weight_kg: number }[]
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
      const transformedData = data?.map(
        (entry: BodyLogEntryQueryResult): BodyLogEntryWithImages => ({
          id: entry.id,
          user_id: entry.user_id,
          created_at: entry.created_at,
          weight_kg: entry.weight_kg,
          body_fat_percentage: entry.body_fat_percentage,
          bmi: entry.bmi,
          muscle_mass_kg: entry.muscle_mass_kg,
          analysis_summary: entry.analysis_summary,
          images: entry.body_log_images || [],
        }),
      )

      return transformedData
    },

    /**
     * Get paginated entries for a user with their images
     * Returns entries and whether there are more to load
     */
    async getEntriesPage(
      userId: string,
      page: number = 0,
      pageSize: number = 40,
    ): Promise<{
      entries: BodyLogEntryWithImages[]
      hasMore: boolean
    }> {
      const from = page * pageSize
      const to = from + pageSize

      const { data, error, count } = await supabase
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
          { count: 'exact' },
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to - 1)

      if (error) throw error

      // Transform body_log_images to images for consistency
      const transformedData = (data ?? []).map(
        (entry: BodyLogEntryQueryResult): BodyLogEntryWithImages => ({
          id: entry.id,
          user_id: entry.user_id,
          created_at: entry.created_at,
          weight_kg: entry.weight_kg,
          body_fat_percentage: entry.body_fat_percentage,
          bmi: entry.bmi,
          muscle_mass_kg: entry.muscle_mass_kg,
          analysis_summary: entry.analysis_summary,
          images: entry.body_log_images || [],
        }),
      )

      return {
        entries: transformedData,
        hasMore: count !== null ? from + transformedData.length < count : false,
      }
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
      const { data, error } = await supabase
        .from('body_log_entries')
        .update(metrics)
        .eq('id', entryId)
        .select()
        .single()

      if (error) {
        throw error
      }

      // Sync weight to user profile if provided
      if (metrics.weight_kg !== undefined && data?.user_id) {
        await supabase
          .from('profiles')
          .update({ weight_kg: metrics.weight_kg })
          .eq('id', data.user_id)
      }

      return data
    },

    /**
     * Delete a specific image from an entry
     */
    async deleteImage(imageId: string, userId: string) {
      const { error } = await supabase
        .from('body_log_images')
        .delete()
        .eq('id', imageId)
        .eq('user_id', userId)

      if (error) {
        throw error
      }
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

      if (error) {
        throw error
      }
    },
  },

  // Workout Routine operations
  workoutRoutines: {
    /**
     * Create a new workout routine from scratch
     */
    async create(
      userId: string,
      name: string,
      options?: {
        notes?: string
        imagePath?: string
        tintColor?: string
      },
    ) {
      const { data, error } = await supabase
        .from('workout_routines')
        .insert({
          user_id: userId,
          name,
          notes: options?.notes ?? null,
          image_path: options?.imagePath ?? null,
          tint_color: options?.tintColor ?? null,
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
      insertedExercises?.forEach((exercise: WorkoutRoutineExercise) => {
        if (
          typeof exercise.order_index === 'number' &&
          !Number.isNaN(exercise.order_index)
        ) {
          insertedExerciseByOrder.set(exercise.order_index, exercise.id)
        }
      })

      // Insert routine sets (template only - no reps/weight/rest yet)
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
          // Future UI will map parsed/set rest to this field; keep nullable for now
          rest_seconds: null,
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
      updates: {
        name?: string
        notes?: string
        is_archived?: boolean
        image_path?: string | null
        tint_color?: string | null
      },
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

  // Notifications operations
  notifications: {
    /**
     * Get all notifications for a user, enriched with actor profiles
     */
    async list(userId: string) {
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('updated_at', { ascending: false })

      if (error) throw error
      if (!notifications || notifications.length === 0) {
        return []
      }

      // Filter out follow_request_received notifications where the request is no longer pending
      const followRequestNotifications = notifications.filter(
        (n) => n.type === 'follow_request_received' && n.request_id,
      )

      let requestStatuses = new Map<string, string>()
      if (followRequestNotifications.length > 0) {
        const requestIds = followRequestNotifications
          .map((n) => n.request_id)
          .filter(Boolean)
        const { data: requests } = await supabase
          .from('follow_requests')
          .select('id, status')
          .in('id', requestIds)

        requestStatuses = new Map(requests?.map((r) => [r.id, r.status]) || [])
      }

      // Filter out notifications where follow request is no longer pending
      const filteredNotifications = notifications.filter((n) => {
        if (n.type === 'follow_request_received' && n.request_id) {
          const status = requestStatuses.get(n.request_id)
          // Only show if status is still pending (or if we couldn't find the status, keep it just in case)
          return status === 'pending' || status === undefined
        }
        return true
      })

      // Fetch unique actor profiles
      const allActorIds = filteredNotifications.flatMap<string>((n) =>
        Array.isArray(n.actors) ? (n.actors as string[]) : [],
      )
      const uniqueActorIds = [...new Set<string>(allActorIds)]

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, user_tag')
        .in('id', uniqueActorIds)

      if (profilesError) throw profilesError

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

      // Attach profiles to notifications
      return filteredNotifications.map((n) => ({
        ...n,
        actorProfiles: [
          ...new Set<string>(
            Array.isArray(n.actors) ? (n.actors as string[]) : [],
          ),
        ]
          .map((id) => profileMap.get(id))
          .filter(Boolean),
      }))
    },

    /**
     * Mark a notification as read
     */
    async markAsRead(notificationId: string) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) throw error
    },

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId: string) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('recipient_id', userId)
        .eq('read', false)

      if (error) throw error
    },

    /**
     * Get unread notification count for a user
     */
    async getUnreadCount(userId: string): Promise<number> {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('read', false)

      if (error) throw error
      return count || 0
    },

    /**
     * Delete a notification
     */
    async delete(notificationId: string) {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) throw error
    },

    /**
     * Create a trial reminder notification for a user
     * Only creates if one doesn't already exist for this trial period
     */
    async createTrialReminder(userId: string) {
      // Check if a trial reminder was already created in the last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('recipient_id', userId)
        .eq('type', 'trial_reminder')
        .gte('created_at', sevenDaysAgo.toISOString())
        .limit(1)

      if (existing && existing.length > 0) {
        // Already have a trial reminder for this period
        return null
      }

      // Create the notification
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          recipient_id: userId,
          type: 'trial_reminder',
          actors: [],
          read: false,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
  },

  // Explore content operations
  explore: {
    /**
     * Get all published programs with routine count
     */
    async getPrograms() {
      const { data, error } = await supabase
        .from('explore_programs')
        .select(
          `
          *,
          explore_program_routines (
            routine_id
          )
        `,
        )
        .eq('is_published', true)
        .order('display_order', { ascending: true })

      if (error) throw error

      return (data || []).map((program: ExploreProgramQueryResult) => ({
        ...program,
        routine_count: program.explore_program_routines?.length || 0,
        routines: [],
      }))
    },

    /**
     * Get a single program with all its routines
     */
    async getProgramById(programId: string) {
      const { data, error } = await supabase
        .from('explore_programs')
        .select(
          `
          *,
          explore_program_routines (
            *,
            routine:explore_routines (
              *,
              explore_routine_exercises (
                *,
                exercise:exercises (
                  id,
                  name,
                  target_muscles,
                  gif_url
                )
              )
            )
          )
        `,
        )
        .eq('id', programId)
        .eq('is_published', true)
        .single()

      if (error) throw error

      const routines = (data.explore_program_routines || [])
        .sort(
          (
            a: ExploreProgramRoutineQueryResult,
            b: ExploreProgramRoutineQueryResult,
          ) => a.display_order - b.display_order,
        )
        .map((pr: ExploreProgramRoutineQueryResult) => {
          const routine = pr.routine
          if (!routine) return null

          // Sort exercises by order_index
          const exercises = (routine.explore_routine_exercises || []).sort(
            (a, b) => a.order_index - b.order_index,
          )

          return {
            ...routine,
            exercises,
          }
        })
        .filter(Boolean)

      return {
        ...data,
        routines,
        routine_count: routines.length,
      }
    },

    /**
     * Get all published routines
     */
    async getRoutines(filters?: { level?: string; equipment?: string }) {
      let query = supabase
        .from('explore_routines')
        .select('*')
        .eq('is_published', true)
        .order('display_order', { ascending: true })

      if (filters?.level) {
        query = query.eq('level', filters.level)
      }

      if (filters?.equipment) {
        query = query.contains('equipment', [filters.equipment])
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },

    /**
     * Get a single routine with all its exercises
     */
    async getRoutineById(routineId: string) {
      const { data, error } = await supabase
        .from('explore_routines')
        .select(
          `
          *,
          explore_routine_exercises (
            *,
            exercise:exercises (*)
          )
        `,
        )
        .eq('id', routineId)
        .eq('is_published', true)
        .single()

      if (error) throw error

      const typedData = data as ExploreRoutineQueryResult
      const exercises = (typedData.explore_routine_exercises || []).sort(
        (a, b) => a.order_index - b.order_index,
      )

      return {
        ...typedData,
        exercises,
      }
    },

    /**
     * Save an explore routine to user's personal routines
     */
    async saveRoutineToUser(routineId: string, userId: string) {
      // Get the explore routine with exercises
      const exploreRoutine = await this.getRoutineById(routineId)

      // Create user's personal routine
      const { data: routine, error: routineError } = await supabase
        .from('workout_routines')
        .insert({
          user_id: userId,
          name: exploreRoutine.name,
          notes: exploreRoutine.description,
        })
        .select()
        .single()

      if (routineError) throw routineError

      // Insert routine exercises
      if (exploreRoutine.exercises && exploreRoutine.exercises.length > 0) {
        type ExploreExerciseWithExercise = ExploreRoutineExercise & {
          exercise: Exercise
        }
        const routineExercises = exploreRoutine.exercises.map(
          (ex: ExploreExerciseWithExercise) => ({
            routine_id: routine.id,
            exercise_id: ex.exercise_id,
            order_index: ex.order_index,
            notes: ex.notes,
          }),
        )

        const {
          data: insertedExercises,
          error: exercisesError,
        } = await supabase
          .from('workout_routine_exercises')
          .insert(routineExercises)
          .select()

        if (exercisesError) throw exercisesError

        // Create sets for each exercise
        const routineSets: {
          routine_exercise_id: string
          set_number: number
          reps_min: number | null
          reps_max: number | null
        }[] = []
        exploreRoutine.exercises.forEach((ex: ExploreExerciseWithExercise) => {
          const insertedEx = insertedExercises?.find(
            (ie: WorkoutRoutineExercise) => ie.order_index === ex.order_index,
          )
          if (!insertedEx) return

          for (let setNum = 1; setNum <= ex.sets; setNum++) {
            routineSets.push({
              routine_exercise_id: insertedEx.id,
              set_number: setNum,
              reps_min: ex.reps_min,
              reps_max: ex.reps_max,
            })
          }
        })

        if (routineSets.length > 0) {
          const { error: setsError } = await supabase
            .from('workout_routine_sets')
            .insert(routineSets)

          if (setsError) throw setsError
        }
      }

      return routine
    },

    /**
     * Save all routines from a program to user's personal routines
     */
    async saveProgramToUser(programId: string, userId: string) {
      const program = await this.getProgramById(programId)
      const savedRoutines = []

      for (const routine of program.routines) {
        const saved = await this.saveRoutineToUser(routine.id, userId)
        savedRoutines.push(saved)
      }

      return savedRoutines
    },
  },
}
