import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { HapticButton } from '@/components/haptic-button'
import { LevelBadge } from '@/components/LevelBadge'
import { useTheme } from '@/contexts/theme-context'
import { getLevelColor } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import {
    EXERCISES_WITH_STANDARDS,
    type ExerciseStandardsConfig,
} from '@/lib/exercise-standards-config'
import { haptic, hapticSuccess } from '@/lib/haptics'
import {
    getStandardsLadder,
    getStrengthStandard,
    type StrengthLevel,
} from '@/lib/strength-standards'
import { Ionicons } from '@expo/vector-icons'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Animated,
    Dimensions,
    Keyboard,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native'
import ConfettiCannon from 'react-native-confetti-cannon'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const FEATURED_EXERCISES = [
  'Bench Press (Barbell)',
  'Squat (Barbell)',
  'Shoulder Press (Barbell)',
  'Bench Press (Dumbbell)',
  'Seated Shoulder Press (Dumbbell)',
  'Bicep Curl (Dumbbell)',
  'Lat Pulldown (Cable)',
  'Leg Press (Machine)',
]

// Simple mapping for muscle group subtitles
const EXERCISE_MUSCLE_MAPPING: Record<string, string> = {
  'Bench Press (Barbell)': 'Chest',
  'Bench Press (Dumbbell)': 'Chest',
  'Shoulder Press (Barbell)': 'Shoulders',
  'Seated Shoulder Press (Dumbbell)': 'Shoulders',
  'Bicep Curl (Dumbbell)': 'Biceps',
  'Squat (Barbell)': 'Quads',
  'Lat Pulldown (Cable)': 'Back',
  'Leg Press (Machine)': 'Quads',
}

const GRID_GAP = 12
const CARD_WIDTH = (SCREEN_WIDTH - 48 - GRID_GAP) / 2

interface StrengthLevelIntroStepProps {
  gender: 'male' | 'female' | null
  weightKg: number
  weightUnit: 'kg' | 'lb'
  onComplete: () => void
  colors: ReturnType<typeof useThemedColors>
}

interface ExerciseCardProps {
  exercise: ExerciseStandardsConfig
  isSelected: boolean
  onSelect: () => void
  colors: ReturnType<typeof useThemedColors>
}

// Memoized exercise card matching the library UI
const ExerciseCard = memo(function ExerciseCard({
  exercise,
  isSelected,
  onSelect,
  colors,
}: ExerciseCardProps) {
  const { isDark } = useTheme()
  const muscleGroup = EXERCISE_MUSCLE_MAPPING[exercise.name]

  return (
    <TouchableOpacity
      style={[
        styles.exerciseCard,
        {
          backgroundColor: isDark ? colors.rowTint : colors.surfaceCard,
          borderColor: colors.border,
        },
        isSelected && {
          borderColor: colors.brandPrimary,
          borderWidth: 2,
          backgroundColor: colors.brandPrimary + '10',
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.cardImageContainer}>
        <ExerciseMediaThumbnail
          gifUrl={exercise.gifUrl || undefined}
          style={styles.cardImage}
        />
        {/* Overlay Checkbox */}
        <View style={styles.cardOverlay}>
          {isSelected ? (
            <Ionicons name="checkbox" size={20} color={colors.brandPrimary} />
          ) : (
            <View style={styles.iconPlaceholder} />
          )}
          <View style={[styles.infoCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)'}
            />
          </View>
        </View>
      </View>

      <View style={styles.cardContent}>
        <Text
          style={[
            styles.cardTitle,
            { color: colors.textPrimary },
            isSelected && { color: colors.brandPrimary },
          ]}
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        {muscleGroup && (
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            {muscleGroup}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
})



export function StrengthLevelIntroStep({
  gender,
  weightKg,
  weightUnit,
  onComplete,
  colors,
}: StrengthLevelIntroStepProps) {
  const [phase, setPhase] = useState<'select' | 'input' | 'result'>('select')
  const [selectedExercise, setSelectedExercise] =
    useState<ExerciseStandardsConfig | null>(null)
  const [inputWeight, setInputWeight] = useState('')
  const [inputReps, setInputReps] = useState('')
  const [calculatedLevel, setCalculatedLevel] = useState<{
    level: StrengthLevel
    progress: number
    color: string
    estimated1RM: number
  } | null>(null)

  const { isDark } = useTheme()
  const { convertInputToKg } = useWeightUnits()
  const confettiRef = useRef<any>(null)
  const fadeAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const selectTimeoutRef = useRef<any>(null)

  useEffect(() => {
    const showListener = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideListener = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSubscription = Keyboard.addListener(showListener, () => setIsKeyboardVisible(true))
    const hideSubscription = Keyboard.addListener(hideListener, () => setIsKeyboardVisible(false))

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current)
    }
  }, [])

  // Get featured exercises with standards
  const featuredExercises = useMemo(() => {
    return EXERCISES_WITH_STANDARDS.filter((ex) =>
      FEATURED_EXERCISES.includes(ex.name)
    ).sort((a, b) => {
      return FEATURED_EXERCISES.indexOf(a.name) - FEATURED_EXERCISES.indexOf(b.name)
    })
  }, [])

  const animateTransition = useCallback(
    (nextPhase: 'select' | 'input' | 'result') => {
      // Fade out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -30,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setPhase(nextPhase)
        slideAnim.setValue(30)
        // Fade in
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            friction: 10,
          }),
        ]).start()
      })
    },
    [fadeAnim, slideAnim]
  )

  const handleExerciseSelect = useCallback(
    (exercise: ExerciseStandardsConfig) => {
      haptic('light')
      setSelectedExercise(exercise)
      
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current)

      // Auto-advance after a small delay (0.2s as requested)
      selectTimeoutRef.current = setTimeout(() => {
        animateTransition('input')
      }, 200)
    },
    [animateTransition]
  )

  const handleContinueToInput = useCallback(() => {
    if (selectedExercise) {
      haptic('medium')
      animateTransition('input')
    }
  }, [selectedExercise, animateTransition])

  const handleSelectionProceed = useCallback(() => {
    if (selectedExercise) {
      handleContinueToInput()
    } else {
      haptic('light')
      onComplete()
    }
  }, [selectedExercise, handleContinueToInput, onComplete])

  const handleCalculateLevel = useCallback(() => {
    if (!selectedExercise || !inputWeight || !inputReps || !gender) return

    const weight = parseFloat(inputWeight)
    const reps = parseInt(inputReps, 10)
    if (isNaN(weight) || isNaN(reps) || reps <= 0 || weight <= 0) return

    haptic('medium')
    Keyboard.dismiss()

    // Convert weight to kg for calculation
    const weightInKg =
      weightUnit === 'lb' ? weight / 2.20462 : weight

    // Calculate estimated 1RM using Epley formula: weight × (1 + reps/30)
    const estimated1RM = weightInKg * (1 + reps / 30)

    // Get strength standard
    const result = getStrengthStandard(
      selectedExercise.name,
      gender,
      weightKg,
      estimated1RM
    )

    if (result) {
      setCalculatedLevel({
        level: result.level,
        progress: result.progress,
        color: getLevelColor(result.level),
        estimated1RM,
      })
      animateTransition('result')

      // Trigger confetti after transition
      setTimeout(() => {
        confettiRef.current?.start()
        hapticSuccess()
      }, 400)
    }
  }, [
    selectedExercise,
    inputWeight,
    inputReps,
    gender,
    weightKg,
    weightUnit,
    animateTransition,
  ])

  const renderSelectPhase = () => (
    <View style={styles.phaseContainer}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Get your first gym rank.
          </Text>
        </View>
      </View>

      <View style={styles.gridContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Pick an exercise you know
        </Text>
        <View style={styles.gridWrapper}>
          {featuredExercises.map((item) => (
            <ExerciseCard
              key={item.id}
              exercise={item}
              isSelected={selectedExercise?.id === item.id}
              onSelect={() => handleExerciseSelect(item)}
              colors={colors}
            />
          ))}
        </View>
      </View>

      {selectedExercise && (
        <View style={styles.selectionInfo}>
          <View
            style={[
              styles.selectedExerciseChip,
              { backgroundColor: colors.brandPrimary + '15' },
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={colors.brandPrimary}
            />
            <Text
              style={[styles.selectedExerciseText, { color: colors.brandPrimary }]}
            >
              {selectedExercise.name}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <HapticButton
          style={[
            styles.primaryButton,
            {
              backgroundColor: colors.textPrimary,
              opacity: 1, // Full opacity for both skip and continue
              shadowColor: colors.textPrimary,
            },
            !selectedExercise && {
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              borderWidth: 1,
              borderColor: colors.border,
              shadowOpacity: 0,
              elevation: 0,
            }
          ]}
          onPress={handleSelectionProceed}
          hapticIntensity="medium"
        >
          <Text
            style={[
              styles.primaryButtonText,
              { color: colors.bg },
              !selectedExercise && { color: colors.textPrimary }
            ]}
          >
            {selectedExercise ? 'Continue' : 'Skip for now'}
          </Text>
        </HapticButton>
      </View>
    </View>
  )

  const renderInputPhase = () => (
    <View style={styles.phaseContainer}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Enter your best set.
        </Text>
      </View>

      {/* Exercise Preview - hidden when keyboard is up to save space */}
      {!isKeyboardVisible && (
        <View style={styles.exercisePreviewContainer}>
          <View
            style={[
              styles.exerciseCard,
              {
                backgroundColor: isDark ? colors.rowTint : colors.surfaceCard,
                borderColor: colors.border,
                width: CARD_WIDTH,
              },
            ]}
          >
            <View style={styles.cardImageContainer}>
              <ExerciseMediaThumbnail
                gifUrl={selectedExercise?.gifUrl || undefined}
                style={styles.cardImage}
              />
              <View style={styles.cardOverlay}>
                <View style={styles.iconPlaceholder} />
                <View style={[styles.infoCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)'}
                  />
                </View>
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text
                style={[
                  styles.cardTitle,
                  { color: colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {selectedExercise?.name}
              </Text>
              {selectedExercise && EXERCISE_MUSCLE_MAPPING[selectedExercise.name] && (
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  {EXERCISE_MUSCLE_MAPPING[selectedExercise.name]}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Input Fields */}
      <View style={[styles.inputContainer, isKeyboardVisible && { marginTop: 20 }]}>
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Weight ({weightUnit})
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                },
              ]}
              value={inputWeight}
              onChangeText={setInputWeight}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textPlaceholder}
              maxLength={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Reps
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                },
              ]}
              value={inputReps}
              onChangeText={setInputReps}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textPlaceholder}
              maxLength={2}
            />
          </View>
        </View>

        <Text style={[styles.inputHint, { color: colors.textTertiary }]}>
          💡 Use your best recent set (1-12 reps)
        </Text>
      </View>

      <View style={styles.footer}>
        <HapticButton
          style={[
            styles.primaryButton,
            {
              backgroundColor: colors.textPrimary,
              opacity: inputWeight && inputReps ? 1 : 0.5,
              shadowColor: colors.textPrimary,
            },
          ]}
          onPress={handleCalculateLevel}
          disabled={!inputWeight || !inputReps}
          hapticIntensity="medium"
        >
          <Text
            style={[
              styles.primaryButtonText,
              {
                color: colors.bg,
              },
            ]}
          >
            Get exercise rank
          </Text>
        </HapticButton>
      </View>
    </View>
  )

  const renderResultPhase = () => {
    if (!calculatedLevel || !selectedExercise || !gender) return null

    const ladder = getStandardsLadder(selectedExercise.name, gender)
    if (!ladder) return null

    const currentLevelIndex = ladder.findIndex((s: any) => s.level === calculatedLevel.level)

    return (
      <View style={styles.phaseContainer}>
        <ConfettiCannon
          ref={confettiRef}
          count={100}
          origin={{ x: SCREEN_WIDTH / 2, y: -20 }}
          autoStart={false}
          fadeOut
          explosionSpeed={350}
          fallSpeed={3000}
          colors={[
            calculatedLevel.color,
            '#FFD700',
            '#FFA500',
            '#FF6B35',
            '#4ECDC4',
            colors.brandPrimary,
          ]}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.resultScrollContent}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Congrats! You got your first rank.
            </Text>
          </View>

          {/* Current Level Hero Card - matching ExerciseDetailScreen */}
          <View
            style={[
              styles.levelHeroCard,
              { borderColor: calculatedLevel.color, backgroundColor: colors.surfaceCard },
            ]}
          >
            <View style={styles.levelHeroGlow}>
              <LevelBadge level={calculatedLevel.level} size="large" />
              <View style={styles.levelHeroContent}>
                <Text style={[styles.levelHeroLabel, { color: colors.textSecondary }]}>CURRENT RANK</Text>
                <Text style={[styles.levelHeroTitle, { color: calculatedLevel.color }]}>
                  {calculatedLevel.level}
                </Text>
                <View style={styles.levelHeroSubRow}>
                  <Text style={[styles.levelHeroSubtitle, { color: colors.textSecondary }]}>
                    {selectedExercise.name}
                  </Text>
                  <Text style={[styles.levelHeroBestSet, { color: colors.textTertiary }]}>
                    • {Math.round(
                      weightUnit === 'lb'
                        ? calculatedLevel.estimated1RM * 2.20462
                        : calculatedLevel.estimated1RM,
                    )}{' '}
                    {weightUnit} (Est. 1RM)
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Levels Ladder Section - matching ExerciseDetailScreen */}
          <View style={styles.ladderSection}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 32 }]}>
              All Ranks for this lift
            </Text>

            <View style={styles.levelsLadder}>
              {[...ladder].reverse().map((standard, idx) => {
                const actualIndex = ladder.length - 1 - idx
                const isAchieved = currentLevelIndex >= actualIndex
                const isCurrent = currentLevelIndex === actualIndex
                const isLocked = currentLevelIndex < actualIndex
                const targetWeight = Math.ceil(weightKg * standard.multiplier)

                return (
                  <View
                    key={standard.level}
                    style={[
                      styles.levelLadderItem,
                      { backgroundColor: 'transparent' },
                      isCurrent && [
                        styles.levelLadderItemCurrent,
                        { borderColor: standard.color, backgroundColor: colors.surfaceCard },
                      ],
                    ]}
                  >
                    {/* Rank badge Column */}
                    <View style={styles.levelLadderBadgeColumn}>
                      <LevelBadge
                        level={standard.level as any}
                        size="medium"
                        style={[
                          isLocked && { opacity: 0.3 },
                          isCurrent && styles.levelLadderBadgeCurrent,
                        ]}
                      />
                    </View>

                    {/* Level info */}
                    <View style={styles.levelLadderInfo}>
                      <Text
                        style={[
                          styles.levelLadderName,
                          { color: colors.textPrimary },
                          isCurrent && { color: standard.color, fontWeight: '700' },
                          isLocked && { color: colors.textSecondary },
                        ]}
                      >
                        {standard.level}
                      </Text>
                      <Text
                        style={[
                          styles.levelLadderDesc,
                          { color: colors.textSecondary },
                          isLocked && { opacity: 0.5 },
                        ]}
                      >
                        {standard.description}
                      </Text>
                    </View>

                    {/* Target weight */}
                    <View style={styles.levelLadderTarget}>
                      <Text
                        style={[
                          styles.levelLadderWeight,
                          { color: colors.textPrimary },
                          isCurrent && { color: standard.color },
                          isLocked && { color: colors.textSecondary },
                        ]}
                      >
                        {Math.round(
                          weightUnit === 'lb' ? targetWeight * 2.20462 : targetWeight,
                        )}
                      </Text>
                      <Text style={[styles.levelLadderWeightLabel, { color: colors.textSecondary }]}>
                        {weightUnit}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>

          <View style={styles.explanationContainer}>
            <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
              Track more exercises to unlock your{' '}
              <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                overall gym rank
              </Text>{' '}
            </Text>
          </View>

          {/* Added spacer for footer */}
          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={[styles.resultFooter, { backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : colors.bg }]}>
          <HapticButton
            style={[
              styles.primaryButton,
              { backgroundColor: colors.textPrimary, shadowColor: colors.textPrimary },
            ]}
            onPress={onComplete}
            hapticIntensity="medium"
          >
            <Text style={[styles.primaryButtonText, { color: colors.bg }]}>Continue</Text>
          </HapticButton>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {phase === 'select' && renderSelectPhase()}
        {phase === 'input' && renderInputPhase()}
        {phase === 'result' && renderResultPhase()}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedContainer: {
    flex: 1,
  },
  phaseContainer: {
    flex: 1,
  },
  header: {
    marginBottom: 24,
  },
  titleContainer: {
    marginBottom: 12,
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  gridContainer: {
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  gridWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  exerciseCard: {
    width: CARD_WIDTH,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImageContainer: {
    height: CARD_WIDTH * 1.1,
    backgroundColor: '#000',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
  },
  iconPlaceholder: {
    width: 20,
    height: 20,
  },
  infoCircle: {
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
  },
  selectionInfo: {
    alignItems: 'center',
    marginTop: 8,
  },
  selectedExerciseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
  },
  selectedExerciseText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 64,
    borderRadius: 32,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Input Phase
  exercisePreviewContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  inputContainer: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 16,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  inputHint: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  // Result Phase
  resultScrollContent: {
    paddingBottom: 40,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resultPreTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  levelHeroCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  levelHeroGlow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  levelHeroContent: {
    flex: 1,
  },
  levelHeroLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    opacity: 0.8,
    marginBottom: 2,
  },
  levelHeroTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  levelHeroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  levelHeroSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },
  levelHeroBestSet: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.6,
  },
  levelProgressSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  levelProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  levelProgressLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.6,
  },
  levelProgressPercent: {
    fontSize: 16,
    fontWeight: '800',
  },
  levelProgressBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    borderRadius: 5,
  },
  levelProgressTarget: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.5,
    marginTop: 10,
  },
  ladderSection: {
    gap: 0,
  },
  levelsLadder: {
    marginTop: 12,
  },
  levelLadderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  levelLadderItemCurrent: {
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  levelLadderBadgeColumn: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  levelLadderBadgeCurrent: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  levelLadderInfo: {
    flex: 1,
  },
  levelLadderName: {
    fontSize: 16,
    fontWeight: '700',
  },
  levelLadderDesc: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  levelLadderTarget: {
    alignItems: 'flex-end',
  },
  levelLadderWeight: {
    fontSize: 18,
    fontWeight: '800',
  },
  levelLadderWeightLabel: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.6,
  },
  explanationContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  resultFooter: {
    position: 'absolute',
    bottom: -40, // Offset to compensate for the ScrollView paddingBottom in onboarding.tsx
    left: -24,   // Offset to compensate for the paddingHorizontal in onboarding.tsx
    right: -24,  // Offset to compensate for the paddingHorizontal in onboarding.tsx
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
})
