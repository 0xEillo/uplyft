import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { HapticButton } from '@/components/haptic-button'
import { LevelBadge } from '@/components/LevelBadge'
import { useTheme } from '@/contexts/theme-context'
import { getLevelColor, LEVEL_COLORS } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
    EXERCISES_WITH_STANDARDS,
    type ExerciseStandardsConfig,
} from '@/lib/exercise-standards-config'
import { haptic, hapticSuccess } from '@/lib/haptics'
import { markUserAsRated, requestReview } from '@/lib/rating'
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
    Image,
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
import Svg, { Circle, Defs, Ellipse, Line, Path, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg'

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
  onPhaseChange?: (
    phase: 'select' | 'input' | 'result' | 'affirmation' | 'rating'
  ) => void
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
  onPhaseChange,
}: StrengthLevelIntroStepProps) {
  const [phase, setPhase] = useState<'select' | 'input' | 'result' | 'affirmation' | 'rating'>('select')
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
  const confettiRef = useRef<any>(null)
  const hasRequestedReviewOnRatingRef = useRef(false)
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
    (nextPhase: 'select' | 'input' | 'result' | 'affirmation' | 'rating') => {
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

  useEffect(() => {
    // Reset inputs when selected exercise changes
    setInputWeight('')
    setInputReps('')
  }, [selectedExercise])

  useEffect(() => {
    if (phase !== 'rating' || Platform.OS !== 'ios' || hasRequestedReviewOnRatingRef.current) {
      return
    }

    const timer = setTimeout(async () => {
      hasRequestedReviewOnRatingRef.current = true
      try {
        await requestReview()
        await markUserAsRated()
      } catch (error) {
        console.log('Error requesting review:', error)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    onPhaseChange?.(phase)
  }, [onPhaseChange, phase])

  const handleCalculateLevel = useCallback(() => {
    if (!selectedExercise || !inputWeight || !inputReps || !gender) return

    const weight = parseFloat(inputWeight)
    const reps = parseInt(inputReps, 10)
    if (isNaN(weight) || isNaN(reps) || reps <= 0 || weight <= 0) return

    haptic('medium')

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
          Pick an exercise you know.
        </Text>
        <View style={styles.gridWrapper}>
          {featuredExercises.map((item) => (
            <ExerciseCard
              key={item.name}
              exercise={item}
              isSelected={selectedExercise?.name === item.name}
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
          <View style={[styles.inputGroup, { 
              backgroundColor: colors.surfaceCard, 
              borderRadius: 20, 
              padding: 16,
              alignItems: 'center' 
          }]}>
            <Text style={[styles.inputLabel, { color: colors.textTertiary, marginBottom: 4, textTransform: 'uppercase', fontSize: 13 }]}>
              Weight ({weightUnit})
            </Text>
            <TextInput
              style={{
                  fontSize: 36,
                  fontWeight: '800',
                  color: colors.textPrimary,
                  textAlign: 'center',
                  width: '100%',
                  paddingVertical: 8
              }}
              value={inputWeight}
              onChangeText={setInputWeight}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              maxLength={4}
              selectionColor={colors.brandPrimary}
            />
          </View>

          <View style={[styles.inputGroup, { 
              backgroundColor: colors.surfaceCard, 
              borderRadius: 20, 
              padding: 16,
              alignItems: 'center' 
          }]}>
            <Text style={[styles.inputLabel, { color: colors.textTertiary, marginBottom: 4, textTransform: 'uppercase', fontSize: 13 }]}>
              Reps
            </Text>
            <TextInput
              style={{
                  fontSize: 36,
                  fontWeight: '800',
                  color: colors.textPrimary,
                  textAlign: 'center',
                  width: '100%',
                  paddingVertical: 8
              }}
              value={inputReps}
              onChangeText={setInputReps}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              maxLength={2}
              selectionColor={colors.brandPrimary}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, opacity: 0.8 }}>
             <Ionicons name="bulb" size={14} color={colors.brandPrimary} style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '500' }}>
               Use your best recent set (1-12 reps)
            </Text>
        </View>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -4 }}>
              <Text style={{ fontSize: 18, color: colors.textSecondary }}>
                Estimated 1RM:
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginLeft: 6 }}>
                {Math.round(weightUnit === 'lb' ? calculatedLevel.estimated1RM * 2.20462 : calculatedLevel.estimated1RM)} {weightUnit}
              </Text>
            </View>
          </View>



          {/* Levels Ladder Section - matching ExerciseDetailScreen */}
          <View style={styles.ladderSection}>


            <View style={styles.levelsLadder}>
              {[...ladder].reverse().map((standard, idx) => {
                const actualIndex = ladder.length - 1 - idx
                const isCurrent = currentLevelIndex === actualIndex
                const isLocked = currentLevelIndex < actualIndex
                const targetWeight = Math.ceil(weightKg * standard.multiplier)
                
                const displayWeight = isCurrent 
                  ? calculatedLevel.estimated1RM 
                  : targetWeight

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
                        numberOfLines={1}
                      >
                        {Math.round(
                          weightUnit === 'lb' ? displayWeight * 2.20462 : displayWeight,
                        )}{' '}
                        {weightUnit}
                      </Text>
                      {isCurrent && (
                        <Text
                          style={[styles.levelLadderWeightLabel, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          Your 1RM
                        </Text>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>
          </View>

          {/* Added spacer for footer */}
          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={[styles.resultFooter, { backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : colors.bg }]}>
          <HapticButton
            style={[
              styles.primaryButton,
              { backgroundColor: colors.textPrimary, shadowColor: colors.textPrimary },
            ]}
            onPress={() => animateTransition('affirmation')}
            hapticIntensity="medium"
          >
            <Text style={[styles.primaryButtonText, { color: colors.bg }]}>Continue</Text>
          </HapticButton>
        </View>
      </View>
    )
  }

  const renderAffirmationPhase = () => {
    if (!calculatedLevel || !selectedExercise || !gender) return null

    const ladder = getStandardsLadder(selectedExercise.name, gender)
    if (!ladder) return null

    const currentLevelIndex = ladder.findIndex((s: any) => s.level === calculatedLevel.level)
    
    // Target a +1 level jump for short-term excitement, falling back to max level if needed
    let targetIndex = currentLevelIndex + 1
    if (targetIndex >= ladder.length) targetIndex = ladder.length - 1

    const targetLevel = ladder[targetIndex]

    // Calculate target date (6 weeks from now)
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 42)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    // e.g. "Apr 25"
    const targetDateString = `${monthNames[targetDate.getMonth()]} ${targetDate.getDate()}`

    const GRAPH_HEIGHT = 200
    const GRAPH_WIDTH = SCREEN_WIDTH
    const startX = 60
    const endX = GRAPH_WIDTH - 60
    const startY = GRAPH_HEIGHT - 30 // bottom
    const endY = 80 // top

    // Smooth bezier curve points
    const controlPoint1X = startX + (endX - startX) * 0.4
    const controlPoint1Y = startY
    const controlPoint2X = startX + (endX - startX) * 0.6
    const controlPoint2Y = endY

    const pathData = `M ${startX},${startY} C ${controlPoint1X},${controlPoint1Y} ${controlPoint2X},${controlPoint2Y} ${endX},${endY}`

    const startColor = LEVEL_COLORS[calculatedLevel.level] || colors.brandPrimary
    const endColor = LEVEL_COLORS[targetLevel.level] || colors.brandPrimary

    return (
      <View style={styles.phaseContainer}>
        {/* Header Section - Standard Onboarding Title Position */}
        <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
                We predict you can reach <Text style={{ color: endColor, textTransform: 'uppercase' }}>{targetLevel.level}</Text> by <Text style={{ color: endColor }}>{targetDateString}</Text>
            </Text>
        </View>

        {/* Graph Section */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT + 40, position: 'relative' }}>
            
            <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT} style={{ position: 'absolute', left: 0, top: 0 }}>
              <Defs>
                <SvgLinearGradient id="graphGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor={startColor} />
                  <Stop offset="100%" stopColor={endColor} />
                </SvgLinearGradient>
              </Defs>
              
              {/* Dotted lines down to axis */}
              <Line 
                x1={startX} y1={startY} x2={startX} y2={GRAPH_HEIGHT} 
                stroke={startColor} strokeWidth={2} strokeDasharray="4,4" opacity={0.6} 
              />
              <Line 
                x1={endX} y1={endY} x2={endX} y2={GRAPH_HEIGHT} 
                stroke={endColor} strokeWidth={2} strokeDasharray="4,4" opacity={0.6} 
              />

              {/* Curve */}
              <Path d={pathData} stroke="url(#graphGrad)" strokeWidth={4} fill="none" strokeLinecap="round" />

              {/* Start Node */}
              <Circle cx={startX} cy={startY} r={6} fill={startColor} />

              {/* End Node */}
              <Circle cx={endX} cy={endY} r={6} fill={endColor} />
            </Svg>

            {/* Badges Absolute Positioning (Rendered ON TOP of SVG) */}
            {/* Start Badge: hoisted above start node */}
            <View style={{ position: 'absolute', left: startX - 24, top: startY - 56, alignItems: 'center', zIndex: 10 }}>
                <LevelBadge level={calculatedLevel.level as any} size="large" showTooltipOnPress={false} />
            </View>

            {/* Target Badge: hoisted above target node */}
            <View style={{ position: 'absolute', left: endX - 24, top: endY - 56, alignItems: 'center', zIndex: 10 }}>
                <LevelBadge level={targetLevel.level as any} size="large" showTooltipOnPress={false} />
            </View>
            
            {/* Axis Labels */}
            <View style={{ position: 'absolute', left: startX - 25, top: GRAPH_HEIGHT + 10, width: 50, alignItems: 'center' }}>
              <Text style={{ color: startColor, fontSize: 13, fontWeight: '700' }}>Today</Text>
            </View>
            <View style={{ position: 'absolute', left: endX - 35, top: GRAPH_HEIGHT + 10, width: 70, alignItems: 'center' }}>
              <Text style={{ color: endColor, fontSize: 13, fontWeight: '700' }}>{targetDateString}*</Text>
            </View>
          </View>
        </View>

        {/* Motivational Text */}
        <View style={{ alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: endColor, marginBottom: 8 }}>
            You&apos;re incredible!
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, textAlign: 'center', lineHeight: 24 }}>
            You have what it takes to be the best. Keep it up!
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>
            *This prediction is based on lifters at your level.
          </Text>
          <HapticButton
            style={[
              styles.primaryButton,
              { backgroundColor: colors.textPrimary, shadowColor: colors.textPrimary, width: '100%' },
            ]}
            onPress={() => animateTransition('rating')}
            hapticIntensity="medium"
          >
            <Text style={[styles.primaryButtonText, { color: colors.bg }]}>Continue</Text>
          </HapticButton>
        </View>
      </View>
    )
  }

  const renderRatingPhase = () => {
    const laurelColor = '#D99A62'

    const renderLaurel = (side: 'left' | 'right') => (
      <View
        style={{
          width: 44,
          height: 64,
          alignItems: 'center',
          justifyContent: 'center',
          transform: side === 'right' ? [{ scaleX: -1 }] : undefined,
        }}
      >
        <Svg width={44} height={64} viewBox="0 0 46 96">
          <Path
            d="M34 88 C20 76 12 61 11 45 C10 29 16 16 27 8"
            stroke={laurelColor}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <Ellipse cx={20} cy={14} rx={6.3} ry={4.2} fill={laurelColor} transform="rotate(-68 20 14)" />
          <Ellipse cx={14} cy={25} rx={6.8} ry={4.6} fill={laurelColor} transform="rotate(-53 14 25)" />
          <Ellipse cx={11} cy={36} rx={7.1} ry={4.9} fill={laurelColor} transform="rotate(-40 11 36)" />
          <Ellipse cx={11} cy={48} rx={7.2} ry={5} fill={laurelColor} transform="rotate(-26 11 48)" />
          <Ellipse cx={14} cy={60} rx={7.4} ry={5.1} fill={laurelColor} transform="rotate(-12 14 60)" />
          <Ellipse cx={19} cy={72} rx={7.6} ry={5.2} fill={laurelColor} transform="rotate(2 19 72)" />
          <Ellipse cx={25} cy={82} rx={7.7} ry={5.3} fill={laurelColor} transform="rotate(14 25 82)" />
          <Ellipse cx={27} cy={20} rx={5.7} ry={4} fill={laurelColor} transform="rotate(38 27 20)" />
          <Ellipse cx={23} cy={31} rx={6.1} ry={4.2} fill={laurelColor} transform="rotate(34 23 31)" />
          <Ellipse cx={22} cy={42} rx={6.4} ry={4.4} fill={laurelColor} transform="rotate(28 22 42)" />
          <Ellipse cx={24} cy={54} rx={6.7} ry={4.6} fill={laurelColor} transform="rotate(20 24 54)" />
          <Ellipse cx={29} cy={66} rx={7} ry={4.8} fill={laurelColor} transform="rotate(12 29 66)" />
        </Svg>
      </View>
    )

    return (
      <View style={styles.phaseContainer}>
        <View style={styles.header}>
            <View style={styles.titleContainer}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    Give us a rating
                </Text>
            </View>
        </View>

        <View>
            {/* Rating Summary Card */}
            <View style={{
                backgroundColor: colors.surfaceCard,
                borderRadius: 24,
                padding: 24,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 40,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
                elevation: 4,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {renderLaurel('left')}
                    <View style={{ alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <Text style={{ fontSize: 32, fontWeight: '800', color: colors.textPrimary }}>
                                4.8
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 2 }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <Ionicons key={i} name="star" size={20} color={laurelColor} />
                                ))}
                            </View>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                            Trusted by experienced lifters
                        </Text>
                    </View>
                    {renderLaurel('right')}
                </View>
            </View>

            {/* Social Proof Section */}
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
                <Text style={{ 
                    fontSize: 24, 
                    fontWeight: '800', 
                    textAlign: 'center', 
                    color: colors.textPrimary,
                    marginBottom: 20,
                    lineHeight: 30
                }}>
                    Rep AI was made for{'\n'}people like you
                </Text>

                <View style={{ flexDirection: 'row', marginBottom: 12, height: 76, alignItems: 'center', justifyContent: 'center' }}>
                    {[
                        'https://unsplash.com/photos/vSKZ-vCSgf8/download?force=true&w=120&h=120',
                        'https://unsplash.com/photos/2EdIqBs2LeI/download?force=true&w=120&h=120',
                        'https://unsplash.com/photos/apUfSZDonPo/download?force=true&w=120&h=120'
                    ].map((url, i) => (
                        <Image
                            key={i}
                            source={{ uri: url }}
                            style={{
                                width: 72,
                                height: 72,
                                borderRadius: 36,
                                borderWidth: 3,
                                borderColor: colors.bg,
                                marginLeft: i > 0 ? -20 : 0,
                                zIndex: 3 - i
                            }}
                        />
                    ))}
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
                    Join others training with Rep AI
                </Text>
            </View>

            {/* Testimonial Card */}
            <View style={{
                backgroundColor: colors.surfaceCard,
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
                elevation: 4,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Image
                            source={{ uri: 'https://unsplash.com/photos/CxFA1kTu9-k/download?force=true&w=120&h=120' }}
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                        />
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
                            Jake Sullivan
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <Ionicons key={i} name="star" size={14} color={laurelColor} />
                        ))}
                    </View>
                </View>
                <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textSecondary }}>
                    I added serious strength in 8 weeks and finally started progressive overload the right way. My lifts are up across the board.
                </Text>
            </View>

            {/* Testimonial Card 2 */}
            <View style={{
                backgroundColor: colors.surfaceCard,
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
                elevation: 4,
                marginTop: 16,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Image
                            source={{ uri: 'https://unsplash.com/photos/aHqe_NrxrUk/download?force=true&w=120&h=120' }}
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                        />
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
                            Sarah Jenkins
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <Ionicons key={i} name="star" size={14} color={laurelColor} />
                        ))}
                    </View>
                </View>
                <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textSecondary }}>
                    This is the first app that actually adjusts to my training. I have built more muscle, and my squat and press numbers keep climbing.
                </Text>
            </View>
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
        {phase === 'affirmation' && renderAffirmationPhase()}
        {phase === 'rating' && renderRatingPhase()}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  animatedContainer: {
    flex: 1,
    minHeight: 0,
  },
  phaseContainer: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    marginBottom: 8,
  },
  titleContainer: {
    marginBottom: 8,
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 0,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  gridContainer: {
    marginTop: 8,
    marginBottom: 12,
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
    paddingVertical: 13,
    paddingHorizontal: 4,
  },
  levelLadderItemCurrent: {
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 11,
    marginVertical: 3,
  },
  levelLadderBadgeColumn: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
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
    flexShrink: 0,
    minWidth: 72,
  },
  levelLadderWeight: {
    fontSize: 14,
    fontWeight: '600',
  },
  levelLadderWeightLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.7,
    marginTop: 2,
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
    bottom: -20, // Offset to compensate for the ScrollView paddingBottom in onboarding.tsx
    left: -24,   // Offset to compensate for the paddingHorizontal in onboarding.tsx
    right: -24,  // Offset to compensate for the paddingHorizontal in onboarding.tsx
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
})

// Matches LifterLevelsSheet current card format

