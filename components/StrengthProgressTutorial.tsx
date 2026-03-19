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
    id: 'levels',
    description:
      'Your Lifter Level is the ultimate measure of your strength. Reach new milestones by progressing in core lifts.',
  },
  {
    id: 'tiers',
    description:
      'Not all lifts are equal. Focus on free-weight compounds to level up faster—they contribute more to your strength score than machines and cables.',
  },
  {
    id: 'map',
    description:
      'Identify your strengths and weaknesses at a glance with the Body Map. Focus on local weak points to level up faster.',
  },
  {
    id: 'exercise-ranks',
    description:
      'Track your progress on every individual lift, from Beginner all the way to World Class.',
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
            <Text style={styles.levelCardValue} numberOfLines={1} adjustsFontSizeToFit>
              {SAMPLE_LEVEL}
            </Text>
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

function TiersVisual() {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const pairs = [
    { compound: 'Bench Press (Barbell)', accessory: 'Chest Press (Machine)', label: 'Chest' },
    { compound: 'Squat (Barbell)', accessory: 'Leg Press (Machine)', label: 'Legs' },
    { compound: 'Shoulder Press (Barbell)', accessory: 'Shoulder Press (Machine)', label: 'Shoulders' },
  ]

  const renderExercise = (name: string, isFreeWeight: boolean) => {
    const config = EXERCISE_NAME_MAP.get(name)
    const cleanName = name.split('(')[0].trim()
    const accentColor = isFreeWeight ? colors.brandPrimary : colors.textSecondary

    return (
      <View style={styles.gridThumbWrap}>
        <View style={[styles.gridThumbContainer, { borderColor: accentColor + '22', borderWidth: 1 }]}>
          <ExerciseMediaThumbnail
            gifUrl={config?.gifUrl ?? null}
            style={styles.gridThumb}
          />
        </View>
        <Text style={[styles.gridThumbLabel, { color: accentColor }]} numberOfLines={1}>
          {cleanName}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.visualSection}>
      <View style={styles.sampleCard}>
        <View style={styles.tierGroupHeader}>
          <Text style={[styles.tierGroupTitle, { color: colors.textPrimary }]}>Free Weights vs Machines</Text>
        </View>
        <View style={styles.comparisonGrid}>
          {pairs.map((pair) => (
            <View key={pair.label} style={styles.comparisonCol}>
              {renderExercise(pair.compound, true)}
              <View style={styles.vsLine} />
              {renderExercise(pair.accessory, false)}
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

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
      case 'tiers':
        return <TiersVisual />
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
      backgroundColor: 'rgba(0,0,0,0.75)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      maxHeight: '90%',
      borderRadius: 32,
      backgroundColor: colors.bg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border + '33',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 20 },
          shadowOpacity: 0.3,
          shadowRadius: 40,
        },
        android: { elevation: 24 },
      }),
    },
    cardScroll: {
      flexGrow: 0,
    },
    cardContent: {
      padding: 20,
      gap: 16,
    },
    stepCounter: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textTertiary,
      textAlign: 'right',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },

    // Shared visual section
    visualSection: {
      gap: 12,
    },
    mapWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 160,
      backgroundColor: colors.surfaceSubtle + '40',
      borderRadius: 24,
      padding: 6,
    },
    legendGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 4,
      marginTop: 4,
    },

    // Level card
    levelCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      borderWidth: 1,
      paddingHorizontal: 20,
      paddingVertical: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 4,
    },
    levelCardContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    levelCardLeft: {
      flex: 1,
      justifyContent: 'center',
    },
    levelCardValue: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: -1,
      marginBottom: 4,
    },
    pointsRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    pointsCurrent: {
      fontSize: 20,
      fontWeight: '900',
      fontVariant: ['tabular-nums'] as any,
    },
    pointsSlash: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginHorizontal: 2,
      opacity: 0.5,
    },
    pointsTotal: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'] as any,
      opacity: 0.8,
    },

    // Sample cards
    sampleCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border + '22',
    },
    sampleCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    sampleThumb: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.bg,
    },
    sampleCardTextWrap: {
      flex: 1,
      gap: 4,
    },
    sampleCardName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    sampleCardSubtext: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
      marginBottom: 2,
    },
    tierGroupHeader: {
      marginBottom: 16,
      alignItems: 'center',
    },
    tierGroupTitle: {
      fontSize: 16,
      fontWeight: '800',
      textAlign: 'center',
    },
    comparisonGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    comparisonCol: {
      flex: 1,
      gap: 6,
      alignItems: 'center',
    },
    vsLine: {
      height: 10,
      width: 1,
      backgroundColor: colors.border + '66',
    },
    gridThumbWrap: {
      width: '100%',
      gap: 6,
      alignItems: 'center',
    },
    gridThumbContainer: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 14,
      backgroundColor: colors.bg,
      overflow: 'hidden',
    },
    gridThumb: {
      width: '100%',
      height: '100%',
    },
    gridThumbLabel: {
      fontSize: 10,
      fontWeight: '700',
      textAlign: 'center',
    },
    divider: {
      height: 1,
    },
    // Exercise rank details
    exerciseContentWrap: {
      flex: 1,
      gap: 6,
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
      fontWeight: '800',
      fontVariant: ['tabular-nums'] as any,
    },
    barTrack: {
      height: 6,
      backgroundColor: colors.border + '44',
      borderRadius: 3,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 3,
    },

    // Copy
    copyBlock: {
      paddingHorizontal: 8,
    },
    slideDescription: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.2,
    },

    // Footer
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 20,
      gap: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border + '22',
    },
    footerDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border + '66',
    },
    dotActive: {
      width: 24,
    },
    footerActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backBtn: {
      paddingVertical: 12,
      paddingRight: 20,
    },
    backBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    nextBtn: {
      borderRadius: 20,
      paddingHorizontal: 28,
      paddingVertical: 12,
      minWidth: 120,
      alignItems: 'center',
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    nextBtnText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
  })
