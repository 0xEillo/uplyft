import { Ionicons } from '@expo/vector-icons'
import { Gender, Goal } from '@/types/database.types'

/**
 * Shared constants for user profile options.
 * Used in onboarding and profile editing screens.
 */

export const GOALS: {
  value: Goal
  label: string
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  { value: 'build_muscle', label: 'Build Muscle', icon: 'body' },
  { value: 'gain_strength', label: 'Gain Strength', icon: 'barbell' },
  { value: 'lose_fat', label: 'Lose Fat', icon: 'flame' },
  { value: 'general_fitness', label: 'General Fitness', icon: 'heart' },
]

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export const COMMITMENTS: {
  value: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  { value: '2_times', label: '2x per week', icon: 'calendar' },
  { value: '3_times', label: '3x per week', icon: 'calendar' },
  { value: '4_times', label: '4x per week', icon: 'calendar' },
  { value: '5_plus', label: '5+ per week', icon: 'flame' },
]
