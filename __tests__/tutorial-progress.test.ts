import {
  getCompletedTutorialStepCount,
  isTutorialCompleteForStepIds,
  normalizeTutorialStepIds,
  TUTORIAL_STEPS,
} from '@/constants/tutorial'

jest.mock('@expo/vector-icons', () => ({
  Ionicons: {
    glyphMap: {
      'person-circle-outline': 'person-circle-outline',
      'add-circle-outline': 'add-circle-outline',
      'barbell-outline': 'barbell-outline',
      'trophy-outline': 'trophy-outline',
      'albums-outline': 'albums-outline',
    },
  },
}))

describe('tutorial progress helpers', () => {
  it('filters unknown tutorial step ids and removes duplicates', () => {
    expect(
      normalizeTutorialStepIds([
        'setup_profile',
        'legacy_step',
        'save_routine',
        'save_routine',
        'another_removed_step',
      ]),
    ).toEqual(['setup_profile', 'save_routine'])
  })

  it('counts only current tutorial steps from stored progress', () => {
    const completedSteps = new Set<string>([
      'setup_profile',
      'create_workout',
      'log_workout',
      'first_exercise_rank',
      'save_routine',
      'removed_old_step',
      'removed_old_step_2',
      'removed_old_step_3',
    ])

    expect(getCompletedTutorialStepCount(completedSteps)).toBe(
      TUTORIAL_STEPS.length,
    )
  })

  it('treats the tutorial as complete when all current steps are done, even with stale ids present', () => {
    const completedSteps = new Set<string>([
      ...TUTORIAL_STEPS.map((step) => step.id),
      'removed_old_step',
      'removed_old_step_2',
    ])

    expect(isTutorialCompleteForStepIds(completedSteps)).toBe(true)
  })
})
