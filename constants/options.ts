import { Gender, Goal, TrainingYears } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'

/**
 * Shared constants for user profile options.
 * Used in onboarding and profile editing screens.
 */

export const GOALS: {
  value: Goal
  label: string
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  { value: 'gain_strength', label: 'Get stronger', icon: 'flash' },
  { value: 'build_muscle', label: 'Build muscle', icon: 'arrow-up' },
  { value: 'lose_fat', label: 'Lose fat', icon: 'arrow-down' },
  { value: 'improve_cardio', label: 'Improve cardio', icon: 'heart' },
  { value: 'become_flexible', label: 'Become flexible', icon: 'sync' },
  { value: 'general_fitness', label: 'General fitness', icon: 'ellipse' },
]

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export const COMMITMENTS: {
  value: string
  label: string
}[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'not_sure', label: 'Not sure' },
]


export const TRAINING_YEARS: {
  value: TrainingYears
  label: string
}[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]
