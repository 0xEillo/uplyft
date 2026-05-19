import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import {
  buildFriendLeaderboardEntries,
  DEV_MOCK_LEADERBOARD_FALLBACK_LEVEL,
  DEV_MOCK_LEADERBOARD_FALLBACK_SCORE,
  DEV_MOCK_LEADERBOARD_FOLLOWEES,
  getCurrentUserEntry,
  isLeaderboardEligible,
  shouldUseDevMockLeaderboard,
  type CurrentLeaderboardUser,
  type FriendLeaderboardEntry,
} from '@/lib/friend-leaderboard'
import { database } from '@/lib/database'
import type { StrengthLevel } from '@/lib/strength-standards'
import { useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'

interface UseFriendLeaderboardParams {
  currentUserScore?: number | null
  currentUserLevel?: StrengthLevel | null
  currentUserDisplayName?: string | null
  currentUserAvatarUrl?: string | null
}

interface UseFriendLeaderboardResult {
  entries: FriendLeaderboardEntry[]
  currentUserEntry: FriendLeaderboardEntry | undefined
  followingCount: number
  isEligible: boolean
  isLoading: boolean
  isMockData: boolean
  refresh: () => void
}

export function useFriendLeaderboard({
  currentUserScore = null,
  currentUserLevel = null,
  currentUserDisplayName = null,
  currentUserAvatarUrl = null,
}: UseFriendLeaderboardParams = {}): UseFriendLeaderboardResult {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [entries, setEntries] = useState<FriendLeaderboardEntry[]>([])
  const [followingCount, setFollowingCount] = useState(0)
  const [isMockData, setIsMockData] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadLeaderboard = useCallback(async () => {
    if (!user?.id) {
      setEntries([])
      setFollowingCount(0)
      setIsMockData(false)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const followingRows = await database.follows.listFollowingWithStrength(
        user.id,
      )
      const followees = followingRows
        .map((row) => row.followee)
        .filter((followee): followee is NonNullable<typeof followee> =>
          Boolean(followee),
        )

      const useMock = shouldUseDevMockLeaderboard(followees.length)
      const leaderboardFollowees = useMock
        ? DEV_MOCK_LEADERBOARD_FOLLOWEES
        : followees

      setIsMockData(useMock)
      setFollowingCount(leaderboardFollowees.length)

      const resolvedScore =
        currentUserScore ?? profile?.overall_strength_score ?? null
      const resolvedLevel =
        currentUserLevel ?? profile?.overall_strength_level ?? null

      const currentUser: CurrentLeaderboardUser = {
        id: user.id,
        displayName:
          currentUserDisplayName ??
          profile?.display_name ??
          'You',
        userTag: profile?.user_tag ?? 'you',
        avatarUrl: currentUserAvatarUrl ?? profile?.avatar_url ?? null,
        score:
          resolvedScore ??
          (useMock ? DEV_MOCK_LEADERBOARD_FALLBACK_SCORE : null),
        level:
          resolvedLevel ??
          (useMock ? DEV_MOCK_LEADERBOARD_FALLBACK_LEVEL : null),
      }

      setEntries(
        buildFriendLeaderboardEntries(currentUser, leaderboardFollowees),
      )
    } catch (error) {
      console.error('[FriendLeaderboard] Failed to load:', error)
      setEntries([])
      setFollowingCount(0)
      setIsMockData(false)
    } finally {
      setIsLoading(false)
    }
  }, [
    user?.id,
    profile?.display_name,
    profile?.user_tag,
    profile?.avatar_url,
    profile?.overall_strength_score,
    profile?.overall_strength_level,
    currentUserScore,
    currentUserLevel,
    currentUserDisplayName,
    currentUserAvatarUrl,
  ])

  useFocusEffect(
    useCallback(() => {
      void loadLeaderboard()
    }, [loadLeaderboard]),
  )

  const isEligible = isLeaderboardEligible(followingCount)

  const currentUserEntry = useMemo(
    () => (user?.id ? getCurrentUserEntry(entries, user.id) : undefined),
    [entries, user?.id],
  )

  return {
    entries,
    currentUserEntry,
    followingCount,
    isEligible,
    isLoading,
    isMockData,
    refresh: loadLeaderboard,
  }
}
