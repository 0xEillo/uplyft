import {
  buildFriendLeaderboardEntries,
  canExpandLeaderboard,
  getLeaderboardHiddenCount,
  getVisibleLeaderboardEntries,
  isLeaderboardEligible,
  LEADERBOARD_MAX_VISIBLE,
  shouldShowLeaderboardYouPreview,
} from '@/lib/friend-leaderboard'

describe('friend-leaderboard', () => {
  it('only shows you preview when rank is outside top 3', () => {
    expect(shouldShowLeaderboardYouPreview(1)).toBe(false)
    expect(shouldShowLeaderboardYouPreview(3)).toBe(false)
    expect(shouldShowLeaderboardYouPreview(4)).toBe(true)
  })

  it('requires more than one followed user', () => {
    expect(isLeaderboardEligible(0)).toBe(false)
    expect(isLeaderboardEligible(1)).toBe(false)
    expect(isLeaderboardEligible(2)).toBe(true)
  })

  it('ranks by points with current user included', () => {
    const entries = buildFriendLeaderboardEntries(
      {
        id: 'me',
        displayName: 'Me',
        userTag: 'me',
        avatarUrl: null,
        score: 500,
        level: 'Novice',
      },
      [
        {
          id: 'a',
          display_name: 'Alex',
          user_tag: 'alex',
          avatar_url: null,
          overall_strength_score: 900,
          overall_strength_level: 'Intermediate',
        },
        {
          id: 'b',
          display_name: 'Sam',
          user_tag: 'sam',
          avatar_url: null,
          overall_strength_score: 700,
          overall_strength_level: 'Novice',
        },
      ],
    )

    expect(entries.map((entry) => entry.userId)).toEqual(['a', 'b', 'me'])
    expect(entries[2].rank).toBe(3)
    expect(getVisibleLeaderboardEntries(entries, false)).toHaveLength(3)
    expect(getVisibleLeaderboardEntries(entries, true)).toHaveLength(3)
  })

  it('caps expanded visible entries at 10', () => {
    const followees = Array.from({ length: 15 }, (_, index) => ({
      id: `user-${index}`,
      display_name: `Athlete ${index}`,
      user_tag: `athlete${index}`,
      avatar_url: null,
      overall_strength_score: 1000 - index,
      overall_strength_level: 'Novice' as const,
    }))

    const entries = buildFriendLeaderboardEntries(
      {
        id: 'me',
        displayName: 'Me',
        userTag: 'me',
        avatarUrl: null,
        score: 500,
        level: 'Novice',
      },
      followees,
    )

    expect(getVisibleLeaderboardEntries(entries, true)).toHaveLength(
      LEADERBOARD_MAX_VISIBLE,
    )
    expect(canExpandLeaderboard(entries.length)).toBe(true)
    expect(getLeaderboardHiddenCount(entries.length, false)).toBe(7)
  })

  it('sorts null scores last', () => {
    const entries = buildFriendLeaderboardEntries(
      {
        id: 'me',
        displayName: 'Me',
        userTag: 'me',
        avatarUrl: null,
        score: null,
        level: null,
      },
      [
        {
          id: 'a',
          display_name: 'Alex',
          user_tag: 'alex',
          avatar_url: null,
          overall_strength_score: 100,
          overall_strength_level: 'Beginner',
        },
        {
          id: 'b',
          display_name: 'Sam',
          user_tag: 'sam',
          avatar_url: null,
          overall_strength_score: null,
          overall_strength_level: null,
        },
      ],
    )

    expect(entries.map((entry) => entry.userId)).toEqual(['a', 'me', 'b'])
  })
})
