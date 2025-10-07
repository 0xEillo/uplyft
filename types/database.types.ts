export type Gender = 'male' | 'female' | 'prefer_not_to_say'
export type Goal = 'build_muscle' | 'lose_fat' | 'gain_strength' | 'general_fitness'

export interface Profile {
  id: string
  user_tag: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  gender: Gender | null
  height_cm: number | null
  weight_kg: number | null
  age: number | null
  goal: Goal | null
  commitment: string | null
  created_at: string
  updated_at: string
}

export interface Exercise {
  id: string
  name: string
  muscle_group: string | null
  type: string | null
  equipment: string | null
  created_by: string | null
  created_at: string
}

export interface WorkoutSession {
  id: string
  user_id: string
  date: string
  raw_text: string | null
  notes: string | null
  type: string | null
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
  reps: number
  weight: number | null
  rpe: number | null
  notes: string | null
  created_at: string
}

// Extended types with relations
export interface WorkoutExerciseWithDetails extends WorkoutExercise {
  exercise: Exercise
  sets: Set[]
}

export interface WorkoutSessionWithDetails extends WorkoutSession {
  workout_exercises: WorkoutExerciseWithDetails[]
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
  sets: ParsedSet[]
}

export interface ParsedSet {
  set_number: number
  reps: number
  weight?: number
  rpe?: number
  notes?: string
}
