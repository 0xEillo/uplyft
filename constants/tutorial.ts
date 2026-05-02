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

// Features that can be trialed once for free during tutorial.
// No active trial features at the moment — kept as a generic union type so the
// trial plumbing in tutorial-context can stay in place if we want to bring
// back a trial for some other premium feature later.
export type TrialFeatureId = 'ai_workout'

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
    trialFeature: null,
  },
]

export const VALID_TUTORIAL_STEP_IDS = new Set<TutorialStepId>(
  TUTORIAL_STEPS.map((step) => step.id),
)

export const AUTO_COMPLETED_TUTORIAL_STEP_IDS: TutorialStepId[] = TUTORIAL_STEPS
  .filter((step) => step.autoComplete)
  .map((step) => step.id)

export function normalizeTutorialStepIds(
  stepIds: readonly string[] | null | undefined,
): TutorialStepId[] {
  if (!stepIds?.length) return []

  return Array.from(
    new Set(stepIds.filter((stepId): stepId is TutorialStepId => {
      return VALID_TUTORIAL_STEP_IDS.has(stepId as TutorialStepId)
    })),
  )
}

export function getCompletedTutorialStepCount(
  completedStepIds: ReadonlySet<string>,
): number {
  return TUTORIAL_STEPS.reduce((count, step) => {
    return count + (completedStepIds.has(step.id) ? 1 : 0)
  }, 0)
}

export function isTutorialCompleteForStepIds(
  completedStepIds: ReadonlySet<string>,
): boolean {
  return getCompletedTutorialStepCount(completedStepIds) === TUTORIAL_STEPS.length
}

// Map from trial feature to the step it's associated with
export const TRIAL_FEATURE_TO_STEP: Partial<Record<TrialFeatureId, TutorialStepId>> = {
  // ai_workout: 'generate_workout', // Removed from tutorial
}
