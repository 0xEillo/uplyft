import type { StrengthLevel } from '@/lib/strength-standards'

const LEADERBOARD_LEVEL_COLORS: Record<StrengthLevel, string> = {
  Untrained: '#6B7280',
  Beginner: '#9CA3AF',
  Novice: '#3B82F6',
  Intermediate: '#10B981',
  Advanced: '#8B5CF6',
  Elite: '#F59E0B',
  'World Class': '#EF4444',
}

export type LeaderboardProfileFields = {
  id: string
  display_name: string | null
  user_tag: string | null
  avatar_url: string | null
  overall_strength_score: number | null
  overall_strength_level: StrengthLevel | null
}

export interface FriendLeaderboardEntry {
  userId: string
  displayName: string
  userTag: string
  avatarUrl: string | null
  score: number | null
  level: StrengthLevel | null
  rank: number
  isCurrentUser: boolean
}

export interface CurrentLeaderboardUser {
  id: string
  displayName: string
  userTag: string
  avatarUrl: string | null
  score: number | null
  level: StrengthLevel | null
}

/** Leaderboard is shown when the user follows more than one person. */
export function isLeaderboardEligible(followingCount: number): boolean {
  return followingCount > 1
}

export const DEV_MOCK_LEADERBOARD_USER_ID_PREFIX = 'dev-mock-lb-'

export function isDevMockLeaderboardUserId(userId: string): boolean {
  return userId.startsWith(DEV_MOCK_LEADERBOARD_USER_ID_PREFIX)
}

/** Dummy followees for local dev when the account has no follows yet. */
export const DEV_MOCK_LEADERBOARD_FOLLOWEES: LeaderboardProfileFields[] = [
  {
    id: `${DEV_MOCK_LEADERBOARD_USER_ID_PREFIX}alex`,
    display_name: 'Alex Carter',
    user_tag: 'alexc',
    avatar_url: null,
    overall_strength_score: 1240,
    overall_strength_level: 'Elite',
  },
  {
    id: `${DEV_MOCK_LEADERBOARD_USER_ID_PREFIX}sam`,
    display_name: 'Sam Rivera',
    user_tag: 'samr',
    avatar_url: null,
    overall_strength_score: 982,
    overall_strength_level: 'Advanced',
  },
  {
    id: `${DEV_MOCK_LEADERBOARD_USER_ID_PREFIX}jordan`,
    display_name: 'Jordan Lee',
    user_tag: 'jordanl',
    avatar_url: null,
    overall_strength_score: 810,
    overall_strength_level: 'Intermediate',
  },
  {
    id: `${DEV_MOCK_LEADERBOARD_USER_ID_PREFIX}riley`,
    display_name: 'Riley Brooks',
    user_tag: 'rileyb',
    avatar_url: null,
    overall_strength_score: 540,
    overall_strength_level: 'Novice',
  },
  {
    id: `${DEV_MOCK_LEADERBOARD_USER_ID_PREFIX}casey`,
    display_name: 'Casey Kim',
    user_tag: 'caseyk',
    avatar_url: null,
    overall_strength_score: 320,
    overall_strength_level: 'Beginner',
  },
  {
    id: `${DEV_MOCK_LEADERBOARD_USER_ID_PREFIX}morgan`,
    display_name: 'Morgan Tate',
    user_tag: 'morgant',
    avatar_url: null,
    overall_strength_score: null,
    overall_strength_level: null,
  },
]

/** Fallback score so your row lands mid-pack in the dev mock. */
export const DEV_MOCK_LEADERBOARD_FALLBACK_SCORE = 647
export const DEV_MOCK_LEADERBOARD_FALLBACK_LEVEL: StrengthLevel = 'Novice'

export function shouldUseDevMockLeaderboard(followingCount: number): boolean {
  return __DEV__ && followingCount <= 1
}

function sortScore(score: number | null): number {
  return score ?? Number.NEGATIVE_INFINITY
}

export function buildFriendLeaderboardEntries(
  currentUser: CurrentLeaderboardUser,
  following: LeaderboardProfileFields[],
): FriendLeaderboardEntry[] {
  const rows: Omit<FriendLeaderboardEntry, 'rank'>[] = [
    {
      userId: currentUser.id,
      displayName: currentUser.displayName || 'You',
      userTag: currentUser.userTag || 'you',
      avatarUrl: currentUser.avatarUrl,
      score: currentUser.score,
      level: currentUser.level,
      isCurrentUser: true,
    },
    ...following.map((followee) => ({
      userId: followee.id,
      displayName: followee.display_name || 'Athlete',
      userTag: followee.user_tag || 'athlete',
      avatarUrl: followee.avatar_url,
      score: followee.overall_strength_score,
      level: followee.overall_strength_level,
      isCurrentUser: false,
    })),
  ]

  const sorted = [...rows].sort((a, b) => {
    const scoreDiff = sortScore(b.score) - sortScore(a.score)
    if (scoreDiff !== 0) return scoreDiff
    return a.displayName.localeCompare(b.displayName)
  })

  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
  }))
}

export const LEADERBOARD_DEFAULT_VISIBLE = 3
export const LEADERBOARD_MAX_VISIBLE = 10

export function getVisibleLeaderboardEntries(
  entries: FriendLeaderboardEntry[],
  expanded: boolean,
): FriendLeaderboardEntry[] {
  const limit = expanded
    ? LEADERBOARD_MAX_VISIBLE
    : LEADERBOARD_DEFAULT_VISIBLE
  return entries.slice(0, limit)
}

export function canExpandLeaderboard(entriesCount: number): boolean {
  return entriesCount > LEADERBOARD_DEFAULT_VISIBLE
}

/** Hide the "You" strip when already visible in the default top 3. */
export function shouldShowLeaderboardYouPreview(rank: number): boolean {
  return rank > LEADERBOARD_DEFAULT_VISIBLE
}

export function getLeaderboardHiddenCount(
  entriesCount: number,
  expanded: boolean,
): number {
  const visibleCap = expanded
    ? LEADERBOARD_MAX_VISIBLE
    : LEADERBOARD_DEFAULT_VISIBLE
  return Math.max(0, Math.min(entriesCount, LEADERBOARD_MAX_VISIBLE) - visibleCap)
}

export function getCurrentUserEntry(
  entries: FriendLeaderboardEntry[],
  userId: string,
): FriendLeaderboardEntry | undefined {
  return entries.find((entry) => entry.userId === userId)
}

export function formatLeaderboardPoints(score: number | null): string {
  if (score === null || Number.isNaN(score)) return '—'
  return `${Math.round(score)}`
}

export function getLeaderboardPointsColor(
  level: StrengthLevel | null,
  fallbackColor: string,
): string {
  if (!level) return fallbackColor
  return LEADERBOARD_LEVEL_COLORS[level]
}
