import { FriendLeaderboardRow } from '@/components/FriendLeaderboardRow'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useFriendLeaderboard } from '@/hooks/useFriendLeaderboard'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import {
  canExpandLeaderboard,
  formatLeaderboardPoints,
  getLeaderboardHiddenCount,
  getLeaderboardPointsColor,
  getVisibleLeaderboardEntries,
  shouldShowLeaderboardYouPreview,
} from '@/lib/friend-leaderboard'
import type { StrengthLevel } from '@/lib/strength-standards'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const LEADERBOARD_CARD_PADDING = 14

interface FriendLeaderboardPreviewProps {
  currentUserScore?: number | null
  currentUserLevel?: StrengthLevel | null
  currentUserDisplayName?: string | null
  currentUserAvatarUrl?: string | null
}

export function FriendLeaderboardPreview({
  currentUserScore,
  currentUserLevel,
  currentUserDisplayName,
  currentUserAvatarUrl,
}: FriendLeaderboardPreviewProps) {
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const styles = createStyles(colors)
  const [expanded, setExpanded] = useState(false)

  const {
    entries,
    currentUserEntry,
    isEligible,
    isLoading,
  } = useFriendLeaderboard({
    currentUserScore,
    currentUserLevel,
    currentUserDisplayName,
    currentUserAvatarUrl,
  })

  const visibleEntries = useMemo(
    () => getVisibleLeaderboardEntries(entries, expanded),
    [entries, expanded],
  )

  const showExpandControl = canExpandLeaderboard(entries.length)
  const hiddenCount = getLeaderboardHiddenCount(entries.length, expanded)
  const showYouBlock =
    currentUserEntry &&
    shouldShowLeaderboardYouPreview(currentUserEntry.rank)

  useEffect(() => {
    if (!isEligible || isLoading) return
    trackEvent(AnalyticsEvents.FRIEND_LEADERBOARD_PREVIEW_SHOWN, {
      rank: currentUserEntry?.rank,
      athlete_count: entries.length,
    })
  }, [isEligible, isLoading, currentUserEntry?.rank, entries.length, trackEvent])

  if (isLoading || !isEligible) return null

  const youPointsColor = getLeaderboardPointsColor(
    currentUserEntry?.level ?? null,
    colors.textTertiary,
  )

  const toggleExpanded = () => {
    haptic('light')
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    trackEvent(
      nextExpanded
        ? AnalyticsEvents.FRIEND_LEADERBOARD_EXPANDED
        : AnalyticsEvents.FRIEND_LEADERBOARD_COLLAPSED,
      {
        rank: currentUserEntry?.rank,
        athlete_count: entries.length,
        visible_count: getVisibleLeaderboardEntries(entries, nextExpanded).length,
      },
    )
  }

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Leaderboard</Text>
      </View>

      <View style={styles.card}>
        {showYouBlock ? (
          <View style={styles.youBlock}>
            <View style={styles.youRow}>
              <View style={styles.youInfo}>
                <Text style={styles.youName}>You</Text>
                <Text style={styles.youRank}>
                  Rank #{currentUserEntry.rank}
                  {currentUserEntry.level
                    ? ` · ${currentUserEntry.level}`
                    : ''}
                </Text>
              </View>
              <View style={styles.youPointsRow}>
                <Text style={[styles.youPoints, { color: youPointsColor }]}>
                  {formatLeaderboardPoints(currentUserEntry.score)}
                </Text>
                <Text
                  style={[styles.youPointsLabel, { color: youPointsColor }]}
                >
                  pts
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.rows}>
          {visibleEntries.map((entry) => (
            <FriendLeaderboardRow
              key={entry.userId}
              entry={entry}
              compact
              insetBleed={LEADERBOARD_CARD_PADDING}
            />
          ))}
        </View>

        {showExpandControl ? (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={toggleExpanded}
            activeOpacity={0.7}
          >
            <Text style={styles.expandButtonText}>
              {expanded
                ? 'Show less'
                : `Show ${hiddenCount} more`}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ) : null}

      </View>
    </>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 32,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    sectionHeaderText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
      letterSpacing: -0.4,
    },
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: LEADERBOARD_CARD_PADDING,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    youBlock: {
      marginBottom: 8,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    youRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    youInfo: {
      flex: 1,
      minWidth: 0,
    },
    youName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    youPointsRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'flex-end',
      gap: 3,
    },
    youPoints: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4,
      fontVariant: ['tabular-nums'],
      lineHeight: 22,
    },
    youPointsLabel: {
      fontSize: 11,
      fontWeight: '700',
      opacity: 0.72,
    },
    youRank: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textTertiary,
      marginTop: 2,
    },
    rows: {
      gap: 2,
    },
    expandButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    expandButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  })
