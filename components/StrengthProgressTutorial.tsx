import { BodyHighlighterDual } from '@/components/BodyHighlighterDual'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LevelBadge } from '@/components/LevelBadge'
import { useBodyDiagramGender } from '@/hooks/useBodyDiagramGender'
import {
  LEVEL_COLORS,
  getLevelColor,
  getLevelIntensity,
} from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import type { BodyPartSlug } from '@/lib/body-mapping'
import { getExerciseNameMap } from '@/lib/exercise-standards-config'
import { OVERALL_STRENGTH_SCORE_CAP } from '@/lib/overall-strength-score'
import type { StrengthLevel } from '@/lib/strength-standards'
import { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface StrengthProgressTutorialProps {
  visible: boolean
  onComplete: () => void
}

interface TutorialSlide {
  id: string
  description: string
}

type SampleBodyDatum = {
  slug: BodyPartSlug
  intensity: number
}

const LEVEL_ORDER: StrengthLevel[] = [
  'Beginner',
  'Novice',
  'Intermediate',
  'Advanced',
  'Elite',
  'World Class',
]

const SAMPLE_LEVEL: StrengthLevel = 'Intermediate'
const SAMPLE_SCORE = 485 // Intermediate range: 400–600, scale 0–1000

// 3 tiers only: simpler to read. Weak (gray), mid (green), strong (purple).
// Clear pattern: core/arms weaker, big compounds stronger.
const SAMPLE_BODY_DATA: SampleBodyDatum[] = [
  { slug: 'chest', intensity: getLevelIntensity('Advanced') },
  { slug: 'upper-back', intensity: getLevelIntensity('Advanced') },
  { slug: 'trapezius', intensity: getLevelIntensity('Novice') },
  { slug: 'deltoids', intensity: getLevelIntensity('Intermediate') },
  { slug: 'biceps', intensity: getLevelIntensity('Intermediate') },
  { slug: 'triceps', intensity: getLevelIntensity('Intermediate') },
  { slug: 'forearm', intensity: getLevelIntensity('Beginner') },
  { slug: 'abs', intensity: getLevelIntensity('Beginner') },
  { slug: 'obliques', intensity: getLevelIntensity('Intermediate') },
  { slug: 'lower-back', intensity: getLevelIntensity('Intermediate') },
  { slug: 'quadriceps', intensity: getLevelIntensity('Advanced') },
  { slug: 'hamstring', intensity: getLevelIntensity('Advanced') },
  { slug: 'gluteal', intensity: getLevelIntensity('Intermediate') },
  { slug: 'adductors', intensity: getLevelIntensity('Beginner') },
  { slug: 'calves', intensity: getLevelIntensity('Intermediate') },
]

const SLIDES: TutorialSlide[] = [
  {
    id: 'map',
    description:
      'Use the body map to see how strong each of your muscle groups are, and spot your weaknesses.',
  },
  {
    id: 'levels',
    description:
      'Your lifter level shows you how strong you are overall. Get stronger on tier 1 lifts to level up faster.',
  },
  {
    id: 'exercise-ranks',
    description:
      'See exactly where you rank on different exercises and how close you are to the next level.',
  },
]

function MapVisual() {
  const colors = useThemedColors()
  const bodyGender = useBodyDiagramGender()
  const styles = createStyles(colors)

  return (
    <View style={styles.visualSection}>
      <View style={styles.mapWrap}>
        <BodyHighlighterDual
          bodyData={SAMPLE_BODY_DATA}
          gender={bodyGender}
          colors={[
            '#4A4A4A',
            LEVEL_COLORS.Beginner,
            LEVEL_COLORS.Novice,
            LEVEL_COLORS.Intermediate,
            LEVEL_COLORS.Advanced,
            LEVEL_COLORS.Elite,
            LEVEL_COLORS['World Class'],
          ]}
          onBodyPartPress={() => {}}
        />
      </View>
      <View style={styles.legendGrid}>
        {LEVEL_ORDER.map((level) => (
          <LevelBadge key={level} level={level} variant="pill" size="small" />
        ))}
      </View>
    </View>
  )
}

function LevelVisual() {
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const levelColor = getLevelColor(SAMPLE_LEVEL)

  return (
    <View style={styles.visualSection}>
      <View style={[styles.levelCard, { borderColor: `${levelColor}66` }]}>
        <View style={styles.levelCardContent}>
          <View style={styles.levelCardLeft}>
            <Text style={styles.levelCardValue}>{SAMPLE_LEVEL}</Text>
            <View style={styles.pointsRow}>
              <Text style={[styles.pointsCurrent, { color: levelColor }]}>
                {SAMPLE_SCORE}
              </Text>
              <Text style={styles.pointsSlash}>/</Text>
              <Text style={styles.pointsTotal}>
                {OVERALL_STRENGTH_SCORE_CAP}
              </Text>
            </View>
          </View>
          <LevelBadge
            level={SAMPLE_LEVEL}
            size="hero"
            showTooltipOnPress={false}
          />
        </View>
      </View>
    </View>
  )
}

const EXERCISE_NAME_MAP = getExerciseNameMap()
const SAMPLE_EXERCISES = [
  {
    name: 'Bench Press (Barbell)',
    level: 'Intermediate' as StrengthLevel,
    progress: 68,
  },
  {
    name: 'Deadlift (Barbell)',
    level: 'Advanced' as StrengthLevel,
    progress: 45,
  },
]

function ExerciseRankVisual() {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const items = SAMPLE_EXERCISES.map((ex) => ({
    ...ex,
    gifUrl: EXERCISE_NAME_MAP.get(ex.name)?.gifUrl ?? null,
  }))

  return (
    <View style={styles.visualSection}>
      {items.map((item) => {
        const color = getLevelColor(item.level)
        return (
          <View key={item.name} style={styles.sampleCard}>
            <View style={styles.sampleCardRow}>
              <ExerciseMediaThumbnail
                gifUrl={item.gifUrl}
                style={styles.sampleThumb}
              />
              <View style={styles.exerciseContentWrap}>
                <Text style={styles.sampleCardName}>{item.name}</Text>
                <View style={styles.exerciseProgressWrap}>
                  <View style={styles.exerciseProgressTop}>
                    <LevelBadge level={item.level} variant="pill" size="xs" />
                    <Text style={[styles.exercisePercent, { color }]}>
                      {item.progress}%
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${item.progress}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}

export function StrengthProgressTutorial({
  visible,
  onComplete,
}: StrengthProgressTutorialProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (!visible) setCurrentStep(0)
  }, [visible])

  const styles = createStyles(colors)
  const step = SLIDES[currentStep]
  const isLastStep = currentStep === SLIDES.length - 1
  const cardWidth = Math.min(windowWidth - 32, 400)

  const visual = useMemo(() => {
    if (!step) return null
    switch (step.id) {
      case 'map':
        return <MapVisual />
      case 'levels':
        return <LevelVisual />
      default:
        return <ExerciseRankVisual />
    }
  }, [step])

  const handleNext = () => {
    if (isLastStep) {
      onComplete()
      return
    }
    setCurrentStep((prev) => prev + 1)
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1))
  }

  if (!visible || !step) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={handleNext}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              width: cardWidth,
              marginTop: insets.top + 20,
              marginBottom: insets.bottom + 20,
            },
          ]}
        >
          <ScrollView
            style={styles.cardScroll}
            contentContainerStyle={styles.cardContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={styles.stepCounter}>
              {currentStep + 1} of {SLIDES.length}
            </Text>

            {visual}

            <View style={styles.copyBlock}>
              <Text style={styles.slideDescription}>{step.description}</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.footerDots}>
              {SLIDES.map((slide, index) => (
                <View
                  key={slide.id}
                  style={[
                    styles.dot,
                    index === currentStep && [
                      styles.dotActive,
                      { backgroundColor: colors.brandPrimary },
                    ],
                  ]}
                />
              ))}
            </View>
            <View style={styles.footerActions}>
              {currentStep > 0 ? (
                <TouchableOpacity
                  onPress={handleBack}
                  style={styles.backBtn}
                  activeOpacity={0.75}
                >
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}
              <TouchableOpacity
                onPress={handleNext}
                style={[
                  styles.nextBtn,
                  { backgroundColor: colors.brandPrimary },
                ]}
                activeOpacity={0.85}
              >
                <Text style={styles.nextBtnText}>
                  {isLastStep ? 'Got it' : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.72)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      maxHeight: '88%',
      borderRadius: 24,
      backgroundColor: colors.bg,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.25,
          shadowRadius: 32,
        },
        android: { elevation: 24 },
      }),
    },
    cardScroll: {
      flexGrow: 0,
    },
    cardContent: {
      padding: 20,
      gap: 20,
    },
    stepCounter: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textTertiary,
      textAlign: 'right',
    },

    // Shared visual section
    visualSection: {
      gap: 10,
    },
    mapWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
    },
    legendGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
    },

    // Level card — mirrors StrengthBodyView.levelCard
    levelCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 20,
      paddingVertical: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    levelCardContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    levelCardLeft: {
      flex: 1,
      justifyContent: 'center',
    },
    levelCardValue: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    pointsRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    pointsCurrent: {
      fontSize: 24,
      fontWeight: '800',
      fontVariant: ['tabular-nums'] as any,
    },
    pointsSlash: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginLeft: 2,
    },
    pointsTotal: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'] as any,
    },

    // Sample cards — mirrors StrengthBodyView exercise/priority cards
    sampleCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    sampleCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sampleThumb: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sampleCardTextWrap: {
      flex: 1,
      gap: 4,
    },
    sampleCardName: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 20,
      color: colors.textPrimary,
    },
    sampleCardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sampleCardAction: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      flexShrink: 1,
    },
    ptsLine: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 3,
    },
    ptsValue: {
      fontSize: 16,
      lineHeight: 18,
      fontWeight: '800',
      fontVariant: ['tabular-nums'] as any,
    },
    ptsSuffix: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.1,
    },

    // Exercise rank details
    exerciseContentWrap: {
      flex: 1,
      minHeight: 52,
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    exerciseProgressWrap: {
      gap: 4,
    },
    exerciseProgressTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    exercisePercent: {
      fontSize: 14,
      fontWeight: '700',
      fontVariant: ['tabular-nums'] as any,
    },
    barTrack: {
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 999,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 999,
    },

    // Copy
    copyBlock: {},
    slideDescription: {
      fontSize: 15,
      lineHeight: 24,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
    },

    // Footer
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 18,
      gap: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    footerDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 22,
    },
    footerActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backBtn: {
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    backBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    nextBtn: {
      borderRadius: 999,
      paddingHorizontal: 22,
      paddingVertical: 12,
      minWidth: 100,
      alignItems: 'center',
    },
    nextBtnText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
  })
