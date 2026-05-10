import { BodyHighlighterDual } from '@/components/BodyHighlighterDual'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LevelBadge } from '@/components/LevelBadge'
import { Paywall } from '@/components/paywall'
import { useTheme } from '@/contexts/theme-context'
import { useBodyDiagramGender } from '@/hooks/useBodyDiagramGender'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
  EXERCISES_WITH_STANDARDS,
  type ExerciseStandardsConfig,
} from '@/lib/exercise-standards-config'
import { useFeatureGate } from '@/utils/analytics-helpers'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'

const TOUR_FEATURE = 'strength_score' as const
const TOUR_SOURCE = 'strength_pro_tour'

const PRIORITY_PREVIEW: {
  exerciseName: string
  targetLevel: string
  gain: number
}[] = [
  {
    exerciseName: 'Bench Press (Barbell)',
    targetLevel: 'Intermediate',
    gain: 14,
  },
  {
    exerciseName: 'Back Squat (Barbell)',
    targetLevel: 'Advanced',
    gain: 11,
  },
  {
    exerciseName: 'Deadlift (Barbell)',
    targetLevel: 'Novice',
    gain: 9,
  },
]

const MUSCLE_PREVIEW = [
  { group: 'Chest', level: 'Intermediate' as const, progress: 67 },
  { group: 'Back', level: 'Novice' as const, progress: 42 },
  { group: 'Legs', level: 'Advanced' as const, progress: 18 },
  { group: 'Shoulders', level: 'Beginner' as const, progress: 81 },
]

function sortPreviewExercises(
  list: ExerciseStandardsConfig[],
): ExerciseStandardsConfig[] {
  return [...list].sort((a, b) => {
    const tierA = a.tier ?? 3
    const tierB = b.tier ?? 3
    if (tierA !== tierB) return tierA - tierB
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

function previewName(name: string): string {
  return name.replace(' (Barbell)', '').replace(' (Dumbbell)', '')
}

const LEVEL_COLOR: Record<string, string> = {
  Untrained: '#6B7280',
  Beginner: '#9CA3AF',
  Novice: '#3B82F6',
  Intermediate: '#10B981',
  Advanced: '#8B5CF6',
  Elite: '#F59E0B',
  'World Class': '#EF4444',
}

export default function StrengthProTourScreen() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const bodyGender = useBodyDiagramGender()
  const { trackPaywallShown, trackPaywallDismissed } = useFeatureGate()
  const [paywallVisible, setPaywallVisible] = useState(false)

  const styles = useMemo(
    () => createStyles(colors, isDark),
    [colors, isDark],
  )

  const previewBodyData = useMemo(
    () =>
      [
        { slug: 'chest' as const, intensity: 4 },
        { slug: 'biceps' as const, intensity: 5 },
        { slug: 'abs' as const, intensity: 6 },
        { slug: 'quadriceps' as const, intensity: 7 },
        { slug: 'upper-back' as const, intensity: 3 },
        { slug: 'lower-back' as const, intensity: 4 },
        { slug: 'gluteal' as const, intensity: 5 },
        { slug: 'hamstring' as const, intensity: 3 },
        { slug: 'deltoids' as const, intensity: 5 },
        { slug: 'triceps' as const, intensity: 4 },
        { slug: 'calves' as const, intensity: 2 },
      ] as const,
    [],
  )

  const bodyHighlightColors = useMemo(() => {
    const baseColor = isDark ? '#2A2A2A' : '#4A4A4A'
    return [
      baseColor,
      '#9CA3AF',
      '#3B82F6',
      '#10B981',
      '#8B5CF6',
      '#F59E0B',
      '#EF4444',
    ]
  }, [isDark])

  const calcExercises = useMemo(
    () => sortPreviewExercises(EXERCISES_WITH_STANDARDS).slice(0, 6),
    [],
  )

  const priorityExercises = useMemo(
    () =>
      PRIORITY_PREVIEW.map((row) => {
        const config = EXERCISES_WITH_STANDARDS.find(
          (ex) => ex.name === row.exerciseName,
        )
        return {
          ...row,
          gifUrl: config?.gifUrl,
        }
      }),
    [],
  )

  const openPaywall = useCallback(() => {
    trackPaywallShown(TOUR_FEATURE, TOUR_SOURCE)
    setPaywallVisible(true)
  }, [trackPaywallShown])

  const closePaywall = useCallback(() => {
    trackPaywallDismissed(TOUR_FEATURE, TOUR_SOURCE)
    setPaywallVisible(false)
  }, [trackPaywallDismissed])

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={
          isDark
            ? ['rgba(255,107,53,0.18)', 'rgba(0,0,0,0)']
            : ['rgba(255,107,53,0.12)', 'rgba(255,255,255,0)']
        }
        style={styles.topGlow}
        pointerEvents="none"
      />

      <View style={styles.topBar}>
        <View style={{ width: 36 }} />
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.closeButton,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.05)',
            },
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 140 + insets.bottom },
        ]}
      >
        <View style={styles.heroBlock}>
          <Text style={styles.headline}>
            See how strong you{'\n'}really are
          </Text>
        </View>

        {/* Strength Score */}
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Strength Score</Text>

          <View style={styles.scoreGaugeWrap}>
            <ScoreGauge
              score={72}
              color={LEVEL_COLOR.Intermediate}
              trackColor={isDark ? '#1F1F22' : '#E6E8EB'}
              labelColor={colors.textPrimary}
              subColor={colors.textSecondary}
            />
            <View style={styles.scoreMeta}>
              <LevelBadge level="Intermediate" variant="pill" size="medium" />
              <Text style={styles.scoreMetaText}>
                Next: <Text style={styles.scoreMetaStrong}>Advanced</Text> · 8
                pts away
              </Text>
            </View>
          </View>
        </View>

        {/* Lifter Levels / Body diagram */}
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Lifter Levels</Text>

          <View style={styles.bodyDiagramWrap} pointerEvents="none">
            <BodyHighlighterDual
              bodyData={previewBodyData as any}
              gender={bodyGender}
              colors={bodyHighlightColors}
              onBodyPartPress={() => undefined}
            />
          </View>

          <View style={styles.legendRow}>
            {(
              [
                'Beginner',
                'Novice',
                'Intermediate',
                'Advanced',
                'Elite',
                'World Class',
              ] as const
            ).map((level) => (
              <LevelBadge
                key={level}
                level={level}
                variant="pill"
                size="small"
              />
            ))}
          </View>
        </View>

        {/* Priority Lifts */}
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Priority Lifts</Text>

          <View style={styles.priorityList}>
            {priorityExercises.map((lift) => (
              <View key={lift.exerciseName} style={styles.priorityCard}>
                <ExerciseMediaThumbnail
                  gifUrl={lift.gifUrl}
                  style={styles.priorityThumb}
                />
                <View style={styles.priorityTextWrap}>
                  <Text style={styles.priorityName} numberOfLines={1}>
                    {previewName(lift.exerciseName)}
                  </Text>
                  <Text style={styles.priorityCta} numberOfLines={1}>
                    Level up to {lift.targetLevel}
                  </Text>
                </View>
                <View style={styles.priorityPoints}>
                  <Text
                    style={[
                      styles.priorityPointsValue,
                      { color: colors.brandPrimary },
                    ]}
                  >
                    +{lift.gain}
                  </Text>
                  <Text
                    style={[
                      styles.priorityPointsSuffix,
                      { color: colors.brandPrimary },
                    ]}
                  >
                    pts
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Muscle Ranks */}
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Muscle Ranks</Text>

          <View style={styles.rankList}>
            {MUSCLE_PREVIEW.map((row) => {
              const tint = LEVEL_COLOR[row.level] ?? colors.brandPrimary
              return (
                <View key={row.group} style={styles.rankRow}>
                  <View style={styles.rankRowHeader}>
                    <Text style={styles.rankGroup}>{row.group}</Text>
                    <View style={styles.rankRight}>
                      <LevelBadge
                        level={row.level}
                        variant="pill"
                        size="xs"
                      />
                      <Text style={[styles.rankPct, { color: tint }]}>
                        {row.progress}%
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.rankBarTrack,
                      { backgroundColor: colors.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.rankBarFill,
                        {
                          width: `${row.progress}%`,
                          backgroundColor: tint,
                        },
                      ]}
                    />
                  </View>
                </View>
              )
            })}
          </View>
        </View>

        {/* Rank Calculator */}
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Rank Calculator</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.calcStrip}
          >
            {calcExercises.map((ex) => (
              <View key={ex.id} style={styles.calcItem}>
                <ExerciseMediaThumbnail
                  gifUrl={ex.gifUrl}
                  style={styles.calcThumb}
                />
                <Text style={styles.calcLabel} numberOfLines={2}>
                  {previewName(ex.name)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: isDark
              ? 'rgba(0,0,0,0.94)'
              : 'rgba(255,255,255,0.96)',
            borderTopColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={openPaywall}
          style={[
            styles.ctaButton,
            { backgroundColor: colors.brandPrimary },
          ]}
        >
          <Ionicons name="star" size={18} color="#fff" />
          <Text style={styles.ctaButtonText}>Unlock Strength Score</Text>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.ctaCaption}>
          Part of Rep AI Pro · Cancel anytime
        </Text>
      </View>

      <Paywall
        visible={paywallVisible}
        onClose={closePaywall}
        title="Unlock Strength Score"
        feature={TOUR_FEATURE}
      />
    </View>
  )
}

interface ScoreGaugeProps {
  score: number
  color: string
  trackColor: string
  labelColor: string
  subColor: string
}

const GAUGE_SIZE = 160
const GAUGE_STROKE = 14
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2
const GAUGE_CIRC = 2 * Math.PI * GAUGE_RADIUS
const GAUGE_ARC_FRACTION = 0.75

function ScoreGauge({
  score,
  color,
  trackColor,
  labelColor,
  subColor,
}: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const visibleLength = GAUGE_CIRC * GAUGE_ARC_FRACTION
  const hiddenLength = GAUGE_CIRC - visibleLength
  const progressLength = visibleLength * (clamped / 100)

  return (
    <View style={gaugeStyles.wrap}>
      <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
        <Circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={GAUGE_RADIUS}
          stroke={trackColor}
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${visibleLength} ${hiddenLength}`}
          rotation={135}
          originX={GAUGE_SIZE / 2}
          originY={GAUGE_SIZE / 2}
        />
        <Circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={GAUGE_RADIUS}
          stroke={color}
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${progressLength} ${GAUGE_CIRC}`}
          rotation={135}
          originX={GAUGE_SIZE / 2}
          originY={GAUGE_SIZE / 2}
        />
      </Svg>
      <View style={gaugeStyles.center} pointerEvents="none">
        <Text style={[gaugeStyles.scoreText, { color: labelColor }]}>
          {clamped}
        </Text>
        <Text style={[gaugeStyles.scoreSub, { color: subColor }]}>/100</Text>
      </View>
    </View>
  )
}

const gaugeStyles = StyleSheet.create({
  wrap: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  scoreSub: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: -4,
  },
})

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    topGlow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 220,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingHorizontal: 16,
      gap: 14,
    },
    heroBlock: {
      paddingTop: 8,
      paddingBottom: 4,
    },
    headline: {
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: -1,
      lineHeight: 34,
      color: colors.textPrimary,
    },
    featureCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 20,
      padding: 18,
      gap: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
    featureTitle: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: colors.textPrimary,
    },
    scoreGaugeWrap: {
      alignItems: 'center',
      gap: 14,
      paddingVertical: 6,
    },
    scoreMeta: {
      alignItems: 'center',
      gap: 6,
    },
    scoreMetaText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    scoreMetaStrong: {
      color: colors.textPrimary,
      fontWeight: '800',
    },
    bodyDiagramWrap: {
      opacity: isDark ? 0.95 : 1,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 6,
      paddingTop: 4,
    },
    priorityList: {
      gap: 10,
    },
    priorityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: isDark ? '#1A1A1C' : '#F4F5F7',
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    priorityThumb: {
      width: 56,
      height: 56,
      borderRadius: 14,
      backgroundColor: colors.bg,
      overflow: 'hidden',
    },
    priorityTextWrap: {
      flex: 1,
      minWidth: 0,
      gap: 4,
      justifyContent: 'center',
    },
    priorityName: {
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: -0.2,
      color: colors.textPrimary,
    },
    priorityCta: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    priorityPoints: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 3,
    },
    priorityPointsValue: {
      fontSize: 18,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.4,
    },
    priorityPointsSuffix: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
    rankList: {
      gap: 14,
    },
    rankRow: {
      gap: 6,
    },
    rankRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rankGroup: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    rankRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rankPct: {
      fontSize: 11,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    rankBarTrack: {
      height: 6,
      borderRadius: 999,
      overflow: 'hidden',
    },
    rankBarFill: {
      height: '100%',
      borderRadius: 999,
    },
    calcStrip: {
      gap: 12,
    },
    calcItem: {
      width: 76,
      alignItems: 'center',
      gap: 8,
    },
    calcThumb: {
      width: 60,
      height: 60,
      borderRadius: 14,
    },
    calcLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 13,
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 12,
      paddingHorizontal: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 8,
    },
    ctaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 18,
      paddingHorizontal: 20,
      paddingVertical: 18,
      gap: 12,
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
    },
    ctaButtonText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.3,
    },
    ctaCaption: {
      textAlign: 'center',
      fontSize: 10,
      fontWeight: '600',
      color: colors.textTertiary,
    },
  })
