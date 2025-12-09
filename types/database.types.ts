export type Gender = 'male' | 'female' | 'prefer_not_to_say'
export type Goal =
  | 'build_muscle'
  | 'lose_fat'
  | 'gain_strength'
  | 'general_fitness'
export type TrainingYears = 'less_than_1' | '1_to_3' | '3_to_5' | '5_plus'

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
  commitment: string | null
  training_years: TrainingYears | null
  expo_push_token: string | null
  has_requested_push_notifications: boolean
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
    | 'Cardio'
    | 'Full Body'
    | null
  type: string | null
  equipment: string | null
  created_by: string | null
  created_at: string
  aliases?: string[] | null
  embedding?: number[] | null
}

export interface WorkoutSession {
  id: string
  user_id: string
  date: string
  raw_text: string | null
  notes: string | null
  type: string | null
  image_url: string | null
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
  created_at: string
}

export interface WorkoutRoutine {
  id: string
  user_id: string
  name: string
  notes: string | null
  is_archived: boolean
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
  created_at: string
  updated_at: string
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
}

// Notification types
export type NotificationType =
  | 'workout_like'
  | 'workout_comment'
  | 'follow_request_received'
  | 'follow_request_approved'
  | 'follow_request_declined'

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
