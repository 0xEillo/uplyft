import { LevelBadge } from '@/components/LevelBadge'
import { RulerPicker } from '@/components/RulerPicker'
import {
  FontSize,
  FontWeight,
  Layout,
  Radius,
  Spacing,
} from '@/constants/theme'
import { LEVEL_COLORS } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { isRepBasedExercise } from '@/lib/exercise-standards-config'
import {
  estimateOneRepMaxKg,
  type StrengthGender,
} from '@/lib/strength-progress'
import {
  getStandardsLadder,
  getStrengthStandard,
  hasStrengthStandards,
  type StrengthLevel,
} from '@/lib/strength-standards'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

const DEFAULT_MAX_WEIGHT_KG = 300
const MAX_WEIGHTED_REPS = 20
const DEFAULT_REPS = 5
const GREY_LEVELS = new Set<StrengthLevel>(['Untrained', 'Beginner'])

interface ExerciseRankCalculatorProps {
  exerciseName: string
  gender: StrengthGender | null
  bodyweightKg: number | null
  /** Best logged set. The calculator opens on it so it shows your current rank. */
  bestSet: { weight: number; reps: number } | null
  isViewingOwnStats: boolean
}

export function ExerciseRankCalculator({
  exerciseName,
  gender,
  bodyweightKg,
  bestSet,
  isViewingOwnStats,
}: ExerciseRankCalculatorProps) {
  const colors = useThemedColors()
  const router = useRouter()
  const { weightUnit, convertInputToKg, convertToPreferred, formatWeight } =
    useWeightUnits()
  const styles = useMemo(() => createStyles(colors), [colors])

  const isRepBased = isRepBasedExercise(exerciseName)
  const hasStandards = hasStrengthStandards(exerciseName)
  const ladder = useMemo(
    () => (gender ? getStandardsLadder(exerciseName, gender) : null),
    [exerciseName, gender],
  )
  const canRank = !!ladder && (isRepBased || !!bodyweightKg)

  const toDisplay = (kg: number) => convertToPreferred(kg) ?? kg

  const bestReps = bestSet && bestSet.reps > 0 ? Math.round(bestSet.reps) : 0
  // Open on the best logged set so the calculator starts on your current rank.
  // With nothing logged yet, start empty (Untrained), matching the Stats tab.
  const [reps, setReps] = useState(() =>
    isRepBased ? bestReps : bestReps > 0 ? bestReps : DEFAULT_REPS,
  )
  // Stored in the user's display unit so the ruler never drifts on round-trips.
  const [displayWeight, setDisplayWeight] = useState(() => {
    if (isRepBased || !bestSet || bestSet.weight <= 0 || bestReps <= 0) return 0
    const exact = toDisplay(bestSet.weight)
    const rounded = Math.round(exact)
    if (!gender || !bodyweightKg) return rounded
    // The ruler only holds whole numbers; make sure rounding doesn't move the
    // set across a rank threshold.
    const levelAt = (displayValue: number) =>
      getStrengthStandard(
        exerciseName,
        gender,
        bodyweightKg,
        estimateOneRepMaxKg(convertInputToKg(displayValue) ?? 0, bestReps),
      )?.level
    const actual = levelAt(exact)
    return (
      [rounded, Math.floor(exact), Math.ceil(exact)].find(
        (candidate) => levelAt(candidate) === actual,
      ) ?? rounded
    )
  })
  const weightKg = convertInputToKg(displayWeight) ?? 0

  const maxDisplayWeight = useMemo(() => {
    const topMultiplier = ladder?.[ladder.length - 1]?.multiplier ?? 0
    const topTargetKg = isRepBased ? 0 : (bodyweightKg ?? 0) * topMultiplier * 1.1
    return Math.ceil(
      toDisplay(
        Math.max(DEFAULT_MAX_WEIGHT_KG, topTargetKg, (bestSet?.weight ?? 0) * 1.1),
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladder, isRepBased, bodyweightKg, bestSet?.weight, weightUnit])

  const maxReps = Math.max(
    bestReps,
    isRepBased
      ? Math.max(
          50,
          Math.ceil((ladder?.[ladder.length - 1]?.multiplier ?? 0) * 1.25),
        )
      : MAX_WEIGHTED_REPS,
  )

  const metric = isRepBased ? reps : estimateOneRepMaxKg(weightKg, reps)
  const result = useMemo(() => {
    if (!canRank || !gender) return null
    return getStrengthStandard(exerciseName, gender, bodyweightKg ?? 1, metric)
  }, [bodyweightKg, canRank, exerciseName, gender, metric])

  const resultLevel: StrengthLevel = result?.level ?? 'Untrained'
  const resultColor = LEVEL_COLORS[resultLevel]

  // Small bounce whenever the calculated rank changes.
  const haloScale = useRef(new Animated.Value(1)).current
  const previousLevel = useRef(resultLevel)
  useEffect(() => {
    if (previousLevel.current === resultLevel) return
    previousLevel.current = resultLevel
    haloScale.setValue(0.88)
    Animated.spring(haloScale, {
      toValue: 1,
      friction: 4,
      tension: 140,
      useNativeDriver: true,
    }).start()
  }, [haloScale, resultLevel])
  // The grey ranks read as "disabled" when used for text, so fall back to the
  // primary text colour there and keep the grey for badges and accents.
  const textColorFor = (level: StrengthLevel) =>
    GREY_LEVELS.has(level) ? colors.textPrimary : LEVEL_COLORS[level]

  if (!hasStandards) {
    return (
      <EmptyState
        styles={styles}
        colors={colors}
        icon="trophy-outline"
        title="No ranks for this exercise"
        message="Ranks are only available for exercises with strength standards."
      />
    )
  }

  if (!canRank) {
    return (
      <EmptyState
        styles={styles}
        colors={colors}
        icon="person-circle-outline"
        title={
          isViewingOwnStats
            ? 'Add your details to see ranks'
            : 'Ranks unavailable'
        }
        message={
          isViewingOwnStats
            ? 'Rank targets are based on your gender and bodyweight.'
            : "This lifter hasn't added the gender and bodyweight ranks are based on."
        }
        actionLabel={isViewingOwnStats ? 'Edit profile' : undefined}
        onAction={() => router.push('/edit-profile')}
      />
    )
  }

  const progressPct = result?.nextLevel ? Math.round(result.progress) : 100

  return (
    <View style={styles.root}>
      {/* Live result */}
      <View style={styles.hero}>
        <Animated.View
          style={[
            styles.halo,
            { shadowColor: resultColor, transform: [{ scale: haloScale }] },
          ]}
        >
          <LevelBadge level={resultLevel} size="xl" />
        </Animated.View>
        <Text style={[styles.heroLevel, { color: textColorFor(resultLevel) }]}>
          {resultLevel}
        </Text>
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {isRepBased
                ? `${reps} rep${reps === 1 ? '' : 's'}`
                : `${displayWeight} ${weightUnit} × ${reps}`}
            </Text>
          </View>
          {!isRepBased && (
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>1RM </Text>
              <Text style={styles.chipText}>
                {formatWeight(metric, { maximumFractionDigits: 0 })}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>
              {result?.nextLevel ? (
                <>
                  {`${progressPct}% to `}
                  <Text
                    style={{
                      color: LEVEL_COLORS[result.nextLevel.level],
                      fontWeight: FontWeight.bold,
                    }}
                  >
                    {result.nextLevel.level}
                  </Text>
                </>
              ) : (
                'Top rank reached'
              )}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPct}%`, backgroundColor: resultColor },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Inputs */}
      <View style={styles.inputCard}>
        {!isRepBased && (
          <>
            <RulerPicker
              unit={weightUnit}
              value={displayWeight}
              onValueChange={setDisplayWeight}
              min={0}
              max={maxDisplayWeight}
              step={1}
              dragMultiplier={2}
              fadeColor={colors.surfaceCard}
              compact
            />
            <View style={styles.inputDivider} />
          </>
        )}
        <RulerPicker
          unit={reps === 1 ? 'rep' : 'reps'}
          value={reps}
          onValueChange={setReps}
          min={isRepBased ? 0 : 1}
          max={maxReps}
          step={1}
          tickWidth={isRepBased ? 12 : 18}
          fadeColor={colors.surfaceCard}
          compact
        />
      </View>
    </View>
  )
}


function EmptyState({
  styles,
  colors,
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  styles: ReturnType<typeof createStyles>
  colors: ReturnType<typeof useThemedColors>
  icon: keyof typeof Ionicons.glyphMap
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={colors.textTertiary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.emptyButton} onPress={onAction}>
          <Text style={styles.emptyButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      gap: Spacing.xl,
    },
    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.base,
    },
    halo: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
    },
    heroLevel: {
      fontSize: FontSize.display + 4,
      fontWeight: FontWeight.heavy,
      letterSpacing: -0.8,
      textAlign: 'center',
    },
    chips: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'baseline',
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: Radius.pill,
      backgroundColor: colors.surfaceSubtle,
    },
    chipLabel: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textSecondary,
    },
    chipText: {
      fontSize: FontSize.base,
      fontWeight: FontWeight.bold,
      color: colors.textPrimary,
    },
    progressWrap: {
      alignSelf: 'stretch',
      gap: Spacing.sm,
      marginTop: Spacing.xxl,
    },
    progressTrack: {
      height: 8,
      borderRadius: Radius.pill,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: Radius.pill,
    },
    progressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    progressText: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textSecondary,
    },
    inputCard: {
      borderRadius: Radius.xxl,
      backgroundColor: colors.surfaceCard,
      paddingTop: Spacing.base,
      overflow: 'hidden',
    },
    inputDivider: {
      height: Layout.hairline,
      backgroundColor: colors.border,
      marginHorizontal: Spacing.base,
      marginBottom: Spacing.base,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.huge,
      paddingHorizontal: Spacing.xl,
      gap: Spacing.sm,
    },
    emptyTitle: {
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.textPrimary,
      textAlign: 'center',
      marginTop: Spacing.xs,
    },
    emptyMessage: {
      fontSize: FontSize.base,
      lineHeight: 21,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    emptyButton: {
      marginTop: Spacing.md,
      backgroundColor: colors.brandPrimary,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      borderRadius: Radius.pill,
    },
    emptyButtonText: {
      color: '#fff',
      fontWeight: FontWeight.bold,
      fontSize: FontSize.base,
    },
  })
