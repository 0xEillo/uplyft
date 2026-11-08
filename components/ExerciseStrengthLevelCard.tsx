import { LevelBadge } from '@/components/LevelBadge'
import { useThemedColors } from '@/hooks/useThemedColors'
import { getLevelColor } from '@/hooks/useStrengthData'
import type { StrengthLevel, StrengthStandard } from '@/lib/strength-standards'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

type FormatWeight = (
  weightKg: number,
  options?: { maximumFractionDigits?: number },
) => string

interface ExerciseStrengthLevelCardProps {
  level: StrengthLevel
  nextLevel: StrengthStandard | null
  /** 0-100 progress from the current level to the next one. */
  progress: number
  ladder: StrengthStandard[]
  /** Best estimated 1RM in kg, or best reps for rep-based lifts. */
  bestValue: number
  bodyweightKg: number
  isRepBased: boolean
  isViewingOwnStats: boolean
  formatWeight: FormatWeight
  onOpenLevels: () => void
}

export function ExerciseStrengthLevelCard({
  level,
  nextLevel,
  progress,
  ladder,
  bestValue,
  bodyweightKg,
  isRepBased,
  isViewingOwnStats,
  formatWeight,
  onOpenLevels,
}: ExerciseStrengthLevelCardProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const hasBest = bestValue > 0
  const levelColor = getLevelColor(level)
  const currentStandard = ladder.find((standard) => standard.level === level)

  const formatTarget = (standard: StrengthStandard) =>
    isRepBased
      ? `${Math.round(standard.multiplier)} reps`
      : formatWeight(Math.ceil(bodyweightKg * standard.multiplier), {
          maximumFractionDigits: 0,
        })

  const fill = !hasBest ? 0 : nextLevel ? progress : 100

  let caption: string
  if (!hasBest) {
    caption = isViewingOwnStats
      ? 'Log a set to get ranked'
      : 'No sets logged yet'
  } else if (!nextLevel) {
    caption = 'Highest level reached'
  } else {
    caption = `${Math.round(progress)}% to ${nextLevel.level}`
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onOpenLevels}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Strength level ${level}. ${caption}. Show all levels`}
    >
      <View style={styles.header}>
        <LevelBadge level={level} size="medium" variant="icon" />
        <Text style={styles.levelName} numberOfLines={1}>
          {level}
        </Text>
        <Text style={styles.caption} numberOfLines={2}>
          {caption}
        </Text>
      </View>

      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${fill}%`, backgroundColor: levelColor }]}
        />
      </View>

      {hasBest && nextLevel ? (
        <View style={styles.scale}>
          <Text style={styles.scaleText}>
            {currentStandard
              ? `${level} · ${formatTarget(currentStandard)}`
              : level}
          </Text>
          <Text style={styles.scaleText}>
            {nextLevel.level} · {formatTarget(nextLevel)}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 16,
      gap: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    levelName: {
      flexShrink: 0,
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    caption: {
      flex: 1,
      textAlign: 'right',
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceSubtle,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
    scale: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: -6,
    },
    scaleText: {
      fontSize: 12,
      color: colors.textTertiary,
      fontVariant: ['tabular-nums'],
    },
  })
