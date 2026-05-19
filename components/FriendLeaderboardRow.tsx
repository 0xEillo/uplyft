import {
  formatLeaderboardPoints,
  getLeaderboardPointsColor,
  isDevMockLeaderboardUserId,
  type FriendLeaderboardEntry,
} from '@/lib/friend-leaderboard'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useRouter } from 'expo-router'
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

function getRankLabel(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

interface FriendLeaderboardRowProps {
  entry: FriendLeaderboardEntry
  compact?: boolean
  /** Pulls highlight background to parent card edges (pass parent horizontal padding). */
  insetBleed?: number
}

export function FriendLeaderboardRow({
  entry,
  compact = false,
  insetBleed = 0,
}: FriendLeaderboardRowProps) {
  const colors = useThemedColors()
  const router = useRouter()
  const pointsText = formatLeaderboardPoints(entry.score)
  const hasPoints = pointsText !== '—'
  const pointsColor = getLeaderboardPointsColor(
    entry.level,
    colors.textTertiary,
  )
  const styles = createStyles(
    colors,
    compact,
    entry.isCurrentUser,
    pointsColor,
    insetBleed,
  )

  const handlePress = () => {
    if (isDevMockLeaderboardUserId(entry.userId)) return
    router.push(`/user/${entry.userId}`)
  }

  const renderAvatar = () => {
    if (entry.avatarUrl) {
      return (
        <Image source={{ uri: entry.avatarUrl }} style={styles.avatar} />
      )
    }

    const initial = entry.displayName[0]?.toUpperCase() ?? '?'
    return (
      <View style={[styles.avatar, styles.avatarPlaceholder]}>
        <Text style={styles.avatarInitial}>{initial}</Text>
      </View>
    )
  }

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={styles.rank}>{getRankLabel(entry.rank)}</Text>
      {renderAvatar()}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.isCurrentUser ? 'You' : entry.displayName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {!compact && entry.userTag ? `@${entry.userTag}` : null}
          {!compact && entry.userTag && entry.level ? ' · ' : null}
          {entry.level ?? 'Unranked'}
        </Text>
      </View>
      <View style={styles.pointsBlock}>
        <Text style={styles.pointsValue}>{pointsText}</Text>
        <Text style={styles.pointsLabel}>{hasPoints ? 'pts' : 'no score'}</Text>
      </View>
    </TouchableOpacity>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  compact: boolean,
  isCurrentUser: boolean,
  pointsColor: string,
  insetBleed: number,
) => {
  const fullWidthHighlight = isCurrentUser && insetBleed > 0

  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: compact ? 8 : 12,
      paddingHorizontal: fullWidthHighlight ? insetBleed : compact ? 0 : 4,
      marginHorizontal: fullWidthHighlight ? -insetBleed : 0,
      borderRadius: fullWidthHighlight ? 0 : 12,
      backgroundColor: isCurrentUser ? `${pointsColor}18` : 'transparent',
    },
    rank: {
      width: 28,
      fontSize: compact ? 14 : 16,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.textSecondary,
    },
    avatar: {
      width: compact ? 34 : 40,
      height: compact ? 34 : 40,
      borderRadius: compact ? 17 : 20,
    },
    avatarPlaceholder: {
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: compact ? 14 : 16,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontSize: compact ? 14 : 15,
      fontWeight: isCurrentUser ? '700' : '600',
      color: colors.textPrimary,
    },
    meta: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textTertiary,
      marginTop: 2,
    },
    pointsBlock: {
      alignItems: 'flex-end',
      minWidth: compact ? 56 : 64,
    },
    pointsValue: {
      fontSize: compact ? 20 : 24,
      fontWeight: '800',
      color: pointsColor,
      letterSpacing: -0.6,
      fontVariant: ['tabular-nums'],
      lineHeight: compact ? 22 : 26,
    },
    pointsLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: pointsColor,
      opacity: 0.72,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 1,
    },
  })
}
