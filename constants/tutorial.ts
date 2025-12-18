import { Ionicons } from '@expo/vector-icons'

export const TUTORIAL_STORAGE_KEY = '@tutorial_progress'
export const TUTORIAL_DISMISSED_KEY = '@tutorial_dismissed'
export const TUTORIAL_TRIAL_USED_KEY = '@tutorial_trial_used'

export type TutorialStepId =
  | 'setup_profile'
  | 'generate_workout'
  | 'create_routine'
  | 'log_workout'
  | 'body_log'

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
    id: 'generate_workout',
    title: 'Create AI Workout',
    description: 'Ask your coach to generate a personalized workout',
    icon: 'flash-outline',
    route: '/(tabs)/chat',
    trialFeature: 'ai_workout',
  },
  {
    id: 'create_routine',
    title: 'Save a Routine',
    description: 'Save your AI workout as a reusable routine',
    icon: 'albums-outline',
    route: '/create-routine',
    trialFeature: 'create_routine',
  },
  {
    id: 'log_workout',
    title: 'Log First Workout',
    description: 'Record your workout to track progress',
    icon: 'barbell-outline',
    route: '/(tabs)/create-post',
    trialFeature: null,
  },
  {
    id: 'body_log',
    title: 'Track Your Body',
    description: 'Log your weight or take progress photos',
    icon: 'body-outline',
    route: '/body-log',
    trialFeature: null,
  },
]

// Map from trial feature to the step it's associated with
export const TRIAL_FEATURE_TO_STEP: Record<TrialFeatureId, TutorialStepId> = {
  ai_workout: 'generate_workout',
  create_routine: 'create_routine',
}
