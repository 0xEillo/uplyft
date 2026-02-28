import type { WorkoutSong } from '@/types/music'

export type Gender = 'male' | 'female' | 'prefer_not_to_say'
export type Goal =
  | 'build_muscle'
  | 'lose_fat'
  | 'gain_strength'
  | 'improve_cardio'
  | 'become_flexible'
  | 'general_fitness'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

export interface Profile {
  id: string
  user_tag: string
  display_name: string
  bio: string | null
  profile_description: string | null
  avatar_url: string | null
  is_private: boolean
  is_guest: boolean
  gender: Gender | null
  height_cm: number | null
  weight_kg: number | null
  age: number | null
  goals: Goal[] | null
  commitment: string[] | null
  training_years: string | null
  experience_level: ExperienceLevel | null
  expo_push_token: string | null
  has_requested_push_notifications: boolean
  created_at: string
  updated_at: string
  coach: string | null
}

export interface RetentionPushPreferences {
  user_id: string
  enabled: boolean
  scheduled_reminders_enabled: boolean
  streak_protection_enabled: boolean
  inactivity_enabled: boolean
  weekly_recaps_enabled: boolean
  milestones_enabled: boolean
  preferred_reminder_hour: number
  quiet_hours_start: string
  quiet_hours_end: string
  timezone: string
  max_pushes_per_week: number
  snoozed_until: string | null
  last_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface Exercise {
  id: string
  name: string
  muscle_group:
    | 'Chest'
    | 'Back'
    | 'Shoulders'
    | 'Biceps'
    | 'Triceps'
    | 'Core'
    | 'Glutes'
    | 'Quads'
    | 'Hamstrings'
    | 'Calves'
    | 'Forearms'
    | 'Cardio'
    | 'Full Body'
    | null
  type: string | null
  equipment: string | null
  created_by: string | null
  created_at: string
  aliases?: string[] | null
  embedding?: number[] | null
  exercise_id?: string | null
  gif_url?: string | null
  target_muscles?: string[] | null
  body_parts?: string[] | null
  equipments?: string[] | null
  secondary_muscles?: string[] | null
  instructions?: string[] | null
}

export interface WorkoutSession {
  id: string
  user_id: string
  date: string
  raw_text: string | null
  notes: string | null
  type: string | null
  image_url: string | null
  song?: WorkoutSong | null
  routine_id: string | null
  duration: number | null
  created_at: string
}

export interface WorkoutExercise {
  id: string
  session_id: string
  exercise_id: string
  order_index: number
  notes: string | null
  exercise_name?: string | null
  created_at: string
}

export interface Set {
  id: string
  workout_exercise_id: string
  set_number: number
  reps: number | null
  weight: number | null
  rpe: number | null
  notes: string | null
  is_warmup: boolean
  created_at: string
}

export interface WorkoutRoutine {
  id: string
  user_id: string
  name: string
  notes: string | null
  is_archived: boolean
  image_path: string | null
  tint_color: string | null
  created_at: string
  updated_at: string
}

export interface WorkoutRoutineExercise {
  id: string
  routine_id: string
  exercise_id: string
  order_index: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WorkoutRoutineSet {
  id: string
  routine_exercise_id: string
  set_number: number
  reps_min: number | null
  reps_max: number | null
  rest_seconds: number | null
  created_at: string
  updated_at: string
}

export type DailyLogMealSource =
  | 'text'
  | 'photo'
  | 'voice'
  | 'manual'
  | 'correction'

export type DailyLogConfidence = 'low' | 'medium' | 'high'

export interface DailyLogEntry {
  id: string
  user_id: string
  log_date: string
  weight_kg: number | null
  calorie_goal: number | null
  protein_goal_g: number | null
  created_at: string
  updated_at: string
}

export interface DailyLogMeal {
  id: string
  daily_log_entry_id: string
  user_id: string
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  source: DailyLogMealSource
  confidence: DailyLogConfidence | null
  chat_message_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface DailyLogSummary {
  logDate: string
  entryId: string | null
  totals: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    meal_count: number
  }
  goals: {
    calorie_goal: number | null
    protein_goal_g: number | null
  }
}

// Extended types with relations
export interface WorkoutExerciseWithDetails extends WorkoutExercise {
  exercise: Exercise
  sets: Set[]
}

export interface WorkoutSessionWithDetails extends WorkoutSession {
  workout_exercises: WorkoutExerciseWithDetails[]
  routine?: {
    id: string
    name: string
  }
  isPending?: boolean // Flag for placeholder workouts being processed
  profile?: Profile // Profile of the user who created the workout (for social feed)
}

export interface WorkoutRoutineExerciseWithDetails
  extends WorkoutRoutineExercise {
  exercise: Exercise
  sets: WorkoutRoutineSet[]
}

export interface WorkoutRoutineWithDetails extends WorkoutRoutine {
  workout_routine_exercises: WorkoutRoutineExerciseWithDetails[]
}

export interface Follow {
  follower_id: string
  followee_id: string
  created_at: string
}

export type FollowRequestStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'cancelled'

export interface FollowRequest {
  id: string
  follower_id: string
  followee_id: string
  status: FollowRequestStatus
  created_at: string
  updated_at: string
  responded_at: string | null
}

export interface FollowRelationshipStatus {
  target_id: string
  is_private: boolean
  is_following: boolean
  has_pending_request: boolean
  request_id: string | null
  has_incoming_request: boolean
  incoming_request_id: string | null
}

export interface WorkoutLike {
  workout_id: string
  user_id: string
  created_at: string
}

export interface WorkoutComment {
  id: string
  workout_id: string
  user_id: string
  content: string
  parent_comment_id: string | null
  reply_to_user_id: string | null
  created_at: string
  updated_at: string
}

export interface WorkoutCommentLike {
  comment_id: string
  user_id: string
  created_at: string
}

export interface WorkoutSocialStats {
  workout_id: string
  like_count: number
  comment_count: number
}

// Parsed workout data structure (from LLM) - matches database schema
export interface ParsedWorkout {
  notes?: string
  type?: string
  exercises: ParsedExercise[]
}

export interface ParsedExercise {
  name: string
  order_index: number
  notes?: string
  hasRepGaps?: boolean
  sets: ParsedSet[]
}

export interface ParsedSet {
  set_number: number
  reps: number | null
  weight?: number
  rpe?: number
  notes?: string
  is_warmup?: boolean
}

// Notification types
export type NotificationType =
  | 'workout_like'
  | 'workout_comment'
  | 'workout_comment_reply'
  | 'workout_comment_like'
  | 'follow_request_received'
  | 'follow_request_approved'
  | 'follow_request_declined'
  | 'follow_received'
  | 'trial_reminder'
  | 'retention_scheduled_workout'
  | 'retention_streak_protection'
  | 'retention_inactivity'
  | 'retention_weekly_recap'
  | 'retention_milestone'

export interface Notification {
  id: string
  recipient_id: string
  type: NotificationType
  workout_id: string | null
  request_id: string | null
  actors: string[] // Array of user IDs who liked/commented
  comment_preview: string | null // Latest comment text (for comment notifications)
  metadata: Record<string, any> | null
  read: boolean
  created_at: string
  updated_at: string
}

export interface NotificationWithProfiles extends Notification {
  actorProfiles: Profile[] // Enriched with actor profile data
}

// Explore content types
export type ExploreLevel = 'beginner' | 'intermediate' | 'advanced'

export interface ExploreProgram {
  id: string
  name: string
  description: string | null
  level: ExploreLevel | null
  goal: string | null
  is_published: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface ExploreRoutine {
  id: string
  name: string
  description: string | null
  image_url: string | null
  level: ExploreLevel | null
  duration_minutes: number | null
  equipment: string[] | null
  is_published: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface ExploreProgramRoutine {
  id: string
  program_id: string
  routine_id: string
  day_number: number | null
  display_order: number
  created_at: string
}

export interface ExploreRoutineExercise {
  id: string
  routine_id: string
  exercise_id: string
  order_index: number
  sets: number
  reps_min: number | null
  reps_max: number | null
  notes: string | null
  created_at: string
}

// Extended types with relations
export interface ExploreRoutineWithExercises extends ExploreRoutine {
  exercises: (ExploreRoutineExercise & { exercise: Exercise })[]
}

export interface ExploreProgramWithRoutines extends ExploreProgram {
  routines: ExploreRoutineWithExercises[]
  routine_count: number
}
