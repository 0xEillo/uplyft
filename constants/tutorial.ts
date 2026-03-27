import { Ionicons } from '@expo/vector-icons'

export const TUTORIAL_STORAGE_KEY = '@tutorial_progress'
export const TUTORIAL_DISMISSED_KEY = '@tutorial_dismissed'
export const TUTORIAL_TRIAL_USED_KEY = '@tutorial_trial_used'

export type TutorialStepId =
  | 'setup_profile'
  | 'create_workout'
  | 'log_workout'
  | 'first_exercise_rank'
  | 'save_routine'

// Features that can be trialed once for free during tutorial
export type TrialFeatureId = 'ai_workout' | 'create_routine'

export interface TutorialStepConfig {
  id: TutorialStepId
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  route: string | null
  trialFeature: TrialFeatureId | null // Feature that gets a free trial during this step
  autoComplete?: boolean // Automatically marked as complete
}

export const TUTORIAL_STEPS: TutorialStepConfig[] = [
  {
    id: 'setup_profile',
    title: 'Set Up Your Profile',
    description: 'Goals, preferences, and training style',
    icon: 'person-circle-outline',
    route: null,
    trialFeature: null,
    autoComplete: true,
  },
  {
    id: 'create_workout',
    title: 'Plan Workout',
    description: 'Plan your first workout with your coach',
    icon: 'add-circle-outline',
    route: '/(tabs)/chat',
    trialFeature: null,
  },
  {
    id: 'log_workout',
    title: 'Log First Workout',
    description: 'Complete a workout to track your progress',
    icon: 'barbell-outline',
    route: '/(tabs)/create-post',
    trialFeature: null,
  },
  {
    id: 'first_exercise_rank',
    title: 'Get First Exercise Rank',
    description: 'Earn a rank by logging your top sets',
    icon: 'trophy-outline',
    route: '/(tabs)/analytics',
    trialFeature: null,
  },
  {
    id: 'save_routine',
    title: 'Save First Routine',
    description: 'Save a workout as a reusable routine',
    icon: 'albums-outline',
    route: '/create-routine',
    trialFeature: 'create_routine',
  },
]

// Map from trial feature to the step it's associated with
export const TRIAL_FEATURE_TO_STEP: Partial<Record<TrialFeatureId, TutorialStepId>> = {
  // ai_workout: 'generate_workout', // Removed from tutorial
  create_routine: 'save_routine',
}
