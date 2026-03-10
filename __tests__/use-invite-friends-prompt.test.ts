import { getNextInvitePromptStep } from '@/hooks/useInviteFriendsPrompt'

describe('getNextInvitePromptStep', () => {
  it('advances to the next future milestone for new users', () => {
    expect(getNextInvitePromptStep(0, 0)).toBe(1)
  })

  it('skips milestones that are already satisfied so dismiss hides immediately', () => {
    expect(getNextInvitePromptStep(0, 5)).toBe(2)
    expect(getNextInvitePromptStep(0, 9)).toBe(2)
    expect(getNextInvitePromptStep(1, 15)).toBe(3)
  })

  it('stops at the terminal hidden state', () => {
    expect(getNextInvitePromptStep(2, 15)).toBe(3)
    expect(getNextInvitePromptStep(3, 30)).toBe(3)
  })
})
