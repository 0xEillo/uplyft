import { shouldShowProfilePicPrompt } from '@/hooks/useProfilePicPrompt'

describe('shouldShowProfilePicPrompt', () => {
  it('waits for persisted prompt state and profile loading to finish', () => {
    expect(
      shouldShowProfilePicPrompt({
        hasProfilePic: false,
        isProfileLoading: true,
        isReady: true,
        timesShown: 0,
        workoutCount: 10,
      }),
    ).toBe(false)

    expect(
      shouldShowProfilePicPrompt({
        hasProfilePic: false,
        isProfileLoading: false,
        isReady: false,
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
        timesShown: 0,
        workoutCount: 2,
      }),
    ).toBe(false)

    expect(
      shouldShowProfilePicPrompt({
        hasProfilePic: false,
        isProfileLoading: false,
        isReady: true,
        timesShown: 0,
        workoutCount: 3,
      }),
    ).toBe(true)
  })

  it('stops showing after all thresholds are exhausted', () => {
    expect(
      shouldShowProfilePicPrompt({
        hasProfilePic: false,
        isProfileLoading: false,
        isReady: true,
        timesShown: 3,
        workoutCount: 20,
      }),
    ).toBe(false)
  })
})
