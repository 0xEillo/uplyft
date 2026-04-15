import { shouldShowProfilePicPrompt } from '@/hooks/useProfilePicPrompt'

describe('shouldShowProfilePicPrompt', () => {
  it('waits for persisted prompt state and profile loading to finish', () => {
    expect(
      shouldShowProfilePicPrompt({
        hasProfilePic: false,
        isProfileLoading: true,
        isReady: true,
        nextPromptWorkoutCount: 3,
        timesShown: 0,
        workoutCount: 10,
      }),
    ).toBe(false)

    expect(
      shouldShowProfilePicPrompt({
        hasProfilePic: false,
        isProfileLoading: false,
        isReady: false,
        nextPromptWorkoutCount: 3,
        timesShown: 0,
        workoutCount: 10,
      }),
    ).toBe(false)
  })

  it('does not show once a profile photo exists', () => {
    expect(
      shouldShowProfilePicPrompt({
        hasProfilePic: true,
        isProfileLoading: false,
        isReady: true,
        nextPromptWorkoutCount: 3,
        timesShown: 0,
        workoutCount: 10,
      }),
    ).toBe(false)
  })

  it('shows only when the current milestone is reached', () => {
    expect(
      shouldShowProfilePicPrompt({
        hasProfilePic: false,
        isProfileLoading: false,
        isReady: true,
        nextPromptWorkoutCount: 3,
        timesShown: 0,
        workoutCount: 2,
      }),
    ).toBe(false)

    expect(
      shouldShowProfilePicPrompt({
        hasProfilePic: false,
        isProfileLoading: false,
        isReady: true,
        nextPromptWorkoutCount: 3,
        timesShown: 0,
        workoutCount: 3,
      }),
    ).toBe(true)
  })

  it('waits until 3 workouts after the last dismissal', () => {
    expect(
      shouldShowProfilePicPrompt({
        hasProfilePic: false,
        isProfileLoading: false,
        isReady: true,
        nextPromptWorkoutCount: 13,
        timesShown: 1,
        workoutCount: 12,
      }),
    ).toBe(false)

    expect(
      shouldShowProfilePicPrompt({
        hasProfilePic: false,
        isProfileLoading: false,
        isReady: true,
        nextPromptWorkoutCount: 13,
        timesShown: 1,
        workoutCount: 13,
      }),
    ).toBe(true)
  })

  it('stops showing after all thresholds are exhausted', () => {
    expect(
      shouldShowProfilePicPrompt({
        hasProfilePic: false,
        isProfileLoading: false,
        isReady: true,
        nextPromptWorkoutCount: 12,
        timesShown: 3,
        workoutCount: 20,
      }),
    ).toBe(false)
  })
})
