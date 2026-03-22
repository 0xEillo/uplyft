import { type CustomNumericKeypadProps } from '@/components/custom-numeric-keypad'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { exerciseLookup } from '@/lib/services/exerciseLookup'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { hapticAsync } from '@/lib/haptics'
import {
    WorkoutRoutineWithDetails,
    WorkoutSessionWithDetails,
} from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
    Alert,
    Keyboard,
    LayoutAnimation,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated'

import { WorkoutExerciseMenuBottomSheet } from '@/components/workout-exercise-menu-bottom-sheet'

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const DEBUG_NEXT_FLOW = false
const DEBUG_KEYPAD_VERBOSE = false
/** Log focus/blur flow when tapping between inputs - set true to debug keyboard closing */
const DEBUG_FOCUS_TRANSFER = false
const DEFAULT_WARMUP_TEMPLATE = [
  { percent: 0.4, reps: 5 },
  { percent: 0.6, reps: 5 },
  { percent: 0.8, reps: 3 },
] as const

interface SetData {
  weight: string
  reps: string
  isWarmup?: boolean
  isBodyWeight?: boolean
  lastWorkoutWeight?: string | null
  lastWorkoutReps?: string | null
  targetRepsMin?: number | null
  targetRepsMax?: number | null
  targetRestSeconds?: number | null
  isCompleted?: boolean
}

interface ExerciseData {
  id: string
  name: string
  sets: SetData[]
}

type FocusedInputState = {
  exerciseIndex: number
  setIndex: number
  field: 'weight' | 'reps'
}

type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'dot' | 'backspace'

interface WorkoutSetRowProps {
  exerciseIndex: number
  setIndex: number
  set: SetData
  workingSetNumber: number
  isWarmup: boolean
  isBodyWeight: boolean
  displayLabel: string | number
  targetText: string
  isWeightFocused: boolean
  isRepsFocused: boolean
  isWeightSuspicious: boolean
  compactPreview: boolean
  unitDisplay: string
  colors: ReturnType<typeof useThemedColors>
  styles: ReturnType<typeof createStyles>
  onToggleSetType: (exerciseIndex: number, setIndex: number) => void
  onToggleComplete: (exerciseIndex: number, setIndex: number) => void
  onWeightChange: (exerciseIndex: number, setIndex: number, value: string) => void
  onRepsChange: (exerciseIndex: number, setIndex: number, value: string) => void
  onFocus: (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps') => void
  onBlur: (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps') => void
  onPressIn: (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps') => void
  onDeleteSet: (exerciseIndex: number, setIndex: number) => void
  onSelectionWeightChange?: (start: number, end: number, valueLength: number) => void
  onSelectionRepsChange?: (start: number, end: number, valueLength: number) => void
  registerWeightRef: (ref: TextInput | null) => void
  registerRepsRef: (ref: TextInput | null) => void
  canDelete: boolean
}

const WorkoutSetRow = React.memo(function WorkoutSetRow({
  exerciseIndex,
  setIndex,
  set,
  isWarmup,
  isBodyWeight,
  displayLabel,
  targetText,
  isWeightFocused,
  isRepsFocused,
  isWeightSuspicious,
  compactPreview,
  unitDisplay,
  colors,
  styles,
  onToggleSetType,
  onToggleComplete,
  onWeightChange,
  onRepsChange,
  onFocus,
  onBlur,
  onPressIn,
  onDeleteSet,
  onSelectionWeightChange,
  onSelectionRepsChange,
  registerWeightRef,
  registerRepsRef,
  canDelete,
}: WorkoutSetRowProps) {
  const renderRightActions = useCallback(() => {
    if (compactPreview || !canDelete) return null

    return (
      <View style={styles.swipeActionContainer}>
        <TouchableOpacity
          style={styles.swipeDeleteButton}
          onPress={() => onDeleteSet(exerciseIndex, setIndex)}
          activeOpacity={0.8}
        >
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    )
  }, [compactPreview, canDelete, onDeleteSet, exerciseIndex, setIndex, styles])

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      containerStyle={styles.swipeableContainer}
    >
      <View style={{ backgroundColor: colors.bg, borderRadius: 6 }}>
        <View style={[styles.setRow, set.isCompleted && styles.setRowCompleted]}>
          <View style={styles.setColSet}>
        <LiquidGlassSurface
          style={styles.setNumberBadge}
          fallbackStyle={styles.setNumberBadgeFallback}
          isInteractive
        >
          <TouchableOpacity
            style={styles.setNumberBadgeTouch}
            onPress={() => onToggleSetType(exerciseIndex, setIndex)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.setNumberText,
                isWarmup && styles.warmupText,
                isBodyWeight && styles.bodyWeightText,
              ]}
            >
              {displayLabel}
            </Text>
          </TouchableOpacity>
        </LiquidGlassSurface>
      </View>

      <View style={styles.setColPrev}>
        {set.lastWorkoutWeight && set.lastWorkoutReps ? (
          <TouchableOpacity
            style={styles.previousTouchable}
            onPress={() => {
              hapticAsync()
              onWeightChange(exerciseIndex, setIndex, set.lastWorkoutWeight!)
              onRepsChange(exerciseIndex, setIndex, set.lastWorkoutReps!)
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.previousText} numberOfLines={1}>
              {`${set.lastWorkoutWeight}${unitDisplay} x ${set.lastWorkoutReps}`}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.previousText} numberOfLines={1}>
            {targetText
              ? `Target: ${targetText.trim().replace(/^\(|\)$/g, '')}`
              : '-'}
          </Text>
        )}
      </View>

      <View style={styles.setColInput}>
        {isBodyWeight ? (
          <View style={styles.boxInputPlaceholder} />
        ) : (
          <TextInput
            ref={registerWeightRef}
            style={[
              styles.boxInput,
              isWeightFocused && styles.boxInputFocused,
              isWeightSuspicious && styles.boxInputWarning,
            ]}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            placeholder={set.lastWorkoutWeight ? set.lastWorkoutWeight : '-'}
            placeholderTextColor={colors.textPlaceholder}
            showSoftInputOnFocus={false}
            keyboardType="number-pad"
            contextMenuHidden
            caretHidden={false}
            value={set.weight}
            selection={
              isWeightFocused
                ? { start: set.weight.length, end: set.weight.length }
                : undefined
            }
            onChangeText={(value) =>
              onWeightChange(exerciseIndex, setIndex, value)
            }
            cursorColor={colors.brandPrimary}
            selectionColor={colors.brandPrimary}
            onSelectionChange={(event) => {
              if (onSelectionWeightChange) {
                const { start, end } = event.nativeEvent.selection
                onSelectionWeightChange(start, end, set.weight.length)
              }
            }}
            onPressIn={() => onPressIn(exerciseIndex, setIndex, 'weight')}
            onFocus={() => onFocus(exerciseIndex, setIndex, 'weight')}
            onBlur={() => onBlur(exerciseIndex, setIndex, 'weight')}
          />
        )}
      </View>

      <View style={styles.setColInput}>
        <TextInput
          ref={registerRepsRef}
          style={[
            styles.boxInput,
            isRepsFocused && styles.boxInputFocused,
          ]}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          placeholder={set.lastWorkoutReps ? set.lastWorkoutReps : '-'}
          placeholderTextColor={colors.textPlaceholder}
          showSoftInputOnFocus={false}
          keyboardType="number-pad"
          contextMenuHidden
          caretHidden={false}
          value={set.reps}
          selection={
            isRepsFocused
              ? { start: set.reps.length, end: set.reps.length }
              : undefined
          }
          onChangeText={(value) => onRepsChange(exerciseIndex, setIndex, value)}
          cursorColor={colors.brandPrimary}
          selectionColor={colors.brandPrimary}
          onSelectionChange={(event) => {
            if (onSelectionRepsChange) {
              const { start, end } = event.nativeEvent.selection
              onSelectionRepsChange(start, end, set.reps.length)
            }
          }}
          onPressIn={() => onPressIn(exerciseIndex, setIndex, 'reps')}
          onFocus={() => onFocus(exerciseIndex, setIndex, 'reps')}
          onBlur={() => onBlur(exerciseIndex, setIndex, 'reps')}
        />
      </View>

      <View style={styles.setColCheckmark}>
        {!compactPreview && (
          <TouchableOpacity
            style={[
              styles.checkmarkButton,
              set.isCompleted && styles.checkmarkButtonCompleted
            ]}
            onPress={() => onToggleComplete(exerciseIndex, setIndex)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="checkmark" 
              size={20} 
              color={set.isCompleted ? '#FFF' : colors.textTertiary} 
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
    </View>
    </Swipeable>
  )
})

interface WorkoutExerciseHeaderProps {
  exercise: ExerciseData
  exerciseIndex: number
  isDragging: boolean
  compactPreview: boolean
  colors: ReturnType<typeof useThemedColors>
  styles: ReturnType<typeof createStyles>
  exerciseGifUrl?: string
  totalExercises: number
  onExerciseNamePress?: (exerciseName: string) => void
  onLongPressExercise: (index: number) => void
  onMoveExerciseUp: (index: number) => void
  onMoveExerciseDown: (index: number) => void
  onDropExercise: () => void
  onDeleteExercise: (index: number) => void
  onMenuPress: (index: number) => void
}

const WorkoutExerciseHeader = React.memo(function WorkoutExerciseHeader({
  exercise,
  exerciseIndex,
  isDragging,
  compactPreview,
  colors,
  styles,
  exerciseGifUrl,
  totalExercises,
  onExerciseNamePress,
  onLongPressExercise,
  onMoveExerciseUp,
  onMoveExerciseDown,
  onDropExercise,
  onDeleteExercise,
  onMenuPress,
}: WorkoutExerciseHeaderProps) {
  return (
    <View style={styles.exerciseHeader}>
      <View style={styles.exerciseNameRow}>
        <ExerciseMediaThumbnail
          gifUrl={exerciseGifUrl}
          style={styles.exerciseThumbnail}
        />
        <TouchableOpacity
          onPress={() => onExerciseNamePress?.(exercise.name)}
          onLongPress={() => onLongPressExercise(exerciseIndex)}
          delayLongPress={400}
          activeOpacity={0.6}
          style={styles.exerciseNameButton}
        >
          <Text
            style={styles.exerciseName}
            numberOfLines={isDragging ? 1 : undefined}
            ellipsizeMode={isDragging ? 'tail' : undefined}
          >
            {exercise.name}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Drag Controls or Menu Button */}
      {isDragging ? (
        <View style={styles.dragControls}>
          <TouchableOpacity
            onPress={() => onMoveExerciseUp(exerciseIndex)}
            style={[
              styles.dragArrow,
              exerciseIndex === 0 && styles.dragArrowDisabled,
            ]}
            activeOpacity={0.5}
            disabled={exerciseIndex === 0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="chevron-up"
              size={22}
              color={exerciseIndex === 0 ? colors.textTertiary : colors.textPrimary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onMoveExerciseDown(exerciseIndex)}
            style={[
              styles.dragArrow,
              exerciseIndex === totalExercises - 1 && styles.dragArrowDisabled,
            ]}
            activeOpacity={0.5}
            disabled={exerciseIndex === totalExercises - 1}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="chevron-down"
              size={22}
              color={exerciseIndex === totalExercises - 1 ? colors.textTertiary : colors.textPrimary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDropExercise}
            style={styles.dragDone}
            activeOpacity={0.5}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="checkmark" size={20} color={colors.brandPrimary} />
          </TouchableOpacity>
        </View>
      ) : !compactPreview ? (
        <TouchableOpacity
          style={styles.menuExerciseButton}
          onPress={() => onMenuPress(exerciseIndex)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
})

interface StructuredWorkoutInputProps {
  routine?: WorkoutRoutineWithDetails
  lastWorkout?: WorkoutSessionWithDetails | null
  initialExercises?: ExerciseData[]
  compactPreview?: boolean
  onDataChange: (exercises: ExerciseData[]) => void
  onRestTimerStart?: (seconds: number) => void
  autoRestEnabled?: boolean
  autoRestDuration?: number
  onInputFocus?: () => void
  onInputBlur?: () => void
  onFocusedInputFrame?: (frame: { pageY: number; height: number }) => void
  /**
   * Callback fired when the custom keypad should be shown or hidden.
   * Parent is responsible for rendering <CustomNumericKeypad> with these props
   * outside of any ScrollView to avoid the Modal focus-stealing issue.
   */
  onKeypadStateChange?: (props: CustomNumericKeypadProps | null) => void
  /**
   * Callback to fetch history data for a specific set when adding new sets.
   * Returns the last workout's weight/reps for the given exercise and set number.
   */
  onFetchSetHistory?: (
    exerciseName: string,
    setNumber: number,
  ) => Promise<{ weight: string | null; reps: string | null } | null>
  /**
   * Callback when an exercise name is pressed.
   * Parent can use this to navigate to exercise details if it exists in the database.
   */
  onExerciseNamePress?: (exerciseName: string) => void
  onReplaceExercise?: (index: number) => void
  warmupCalculatorEnabled?: boolean
}

export function StructuredWorkoutInput({
  routine,
  lastWorkout,
  initialExercises,
  compactPreview = false,
  onDataChange,
  onRestTimerStart,
  autoRestEnabled,
  autoRestDuration,
  onInputFocus,
  onInputBlur,
  onFocusedInputFrame,
  onKeypadStateChange,
  onFetchSetHistory,
  onExerciseNamePress,
  onReplaceExercise,
  warmupCalculatorEnabled = false,
}: StructuredWorkoutInputProps) {
  const debugNext = useCallback((...args: unknown[]) => {
    if (DEBUG_NEXT_FLOW) {
      console.log('[StructuredNextFlow]', ...args)
    }
  }, [])
  const debugKeypad = useCallback((event: string, payload?: Record<string, unknown>) => {
    if (!__DEV__ || !DEBUG_KEYPAD_VERBOSE) return
    const ts = Date.now() % 100000
    if (payload) {
      console.log(`[KeypadTrace][${ts}] ${event}`, payload)
    } else {
      console.log(`[KeypadTrace][${ts}] ${event}`)
    }
  }, [])

  const debugFocusTransfer = useCallback((event: string, payload?: Record<string, unknown>) => {
    if (!__DEV__ || !DEBUG_FOCUS_TRANSFER) return
    const ts = Date.now()
    const key = (p?: Record<string, unknown>) =>
      p ? `${p.exerciseIndex ?? '?'}-${p.setIndex ?? '?'}-${p.field ?? '?'}` : 'null'
    if (payload) {
      console.log(`[KeypadFocus][${ts}] ${event}`, { ...payload, key: key(payload) })
    } else {
      console.log(`[KeypadFocus][${ts}] ${event}`)
    }
  }, [])

  const colors = useThemedColors()
  const { weightUnit, convertToPreferred } = useWeightUnits()
  const styles = createStyles(colors, compactPreview)
  const isInitialMount = useRef(true)
  const inputRefs = useRef<{ [key: string]: TextInput | null }>({})
  const [focusedInput, setFocusedInput] = useState<FocusedInputState | null>(null)
  const focusedInputRef = useRef<FocusedInputState | null>(null)

  // Ref to debounce blur callback - prevents double toolbar when focus transfers between inputs
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const focusTransitionRef = useRef(false)
  const focusTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextPressInFlightRef = useRef(false)
  const keypadClosingRef = useRef(false)
  const keypadCloseUntilRef = useRef(0)
  const keypadOpenedAtRef = useRef(0)

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
      if (focusTransitionTimeoutRef.current) {
        clearTimeout(focusTransitionTimeoutRef.current)
      }
    }
  }, [])

  // Drag and drop state
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const draggingScale = useSharedValue(1)
  const draggingOpacity = useSharedValue(1)

  // Menu state
  const [menuExerciseIndex, setMenuExerciseIndex] = useState<number | null>(null)

  // Exercise GIF lookup cache (exercise id -> gifUrl) for display
  const [exerciseGifUrls, setExerciseGifUrls] = useState<Record<string, string | null>>({})

  // Get the display unit text (kg or lbs)
  const unitDisplay = weightUnit === 'kg' ? 'kg' : 'lbs'

  // Threshold for warning about suspiciously high weights (350kg or ~770lbs)
  const MAX_REASONABLE_WEIGHT_KG = 350
  const isWeightSuspicious = (weight: string): boolean => {
    const numeric = parseFloat(weight)
    if (isNaN(numeric) || numeric <= 0) return false
    // Convert to kg if user is in lbs mode for consistent comparison
    const weightInKg = weightUnit === 'kg' ? numeric : numeric / 2.205
    return weightInKg > MAX_REASONABLE_WEIGHT_KG
  }

  // Initialize exercise data from routine or initialExercises
  const [exercises, setExercises] = useState<ExerciseData[]>(() => {
    // If initialExercises provided, use those
    if (initialExercises && initialExercises.length > 0) {
      return initialExercises
    }

    // Otherwise, initialize from routine
    if (!routine) {
      return []
    }

    return (routine.workout_routine_exercises || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((exercise) => {
        const sets = (exercise.sets || []).sort(
          (a, b) => a.set_number - b.set_number,
        )

        // Try to find matching exercise in last workout by exercise name
        // (We match by name because the text parsing may result in different exercise IDs)
        const exerciseName = exercise.exercise?.name || 'Exercise'
        const lastWorkoutExercise = lastWorkout?.workout_exercises?.find(
          (we) => we.exercise?.name === exerciseName,
        )

        return {
          id: exercise.id,
          name: exercise.exercise?.name || 'Exercise',
          sets: sets.map((routineSet, index) => {
            // Try to find matching set from last workout
            const lastSet = lastWorkoutExercise?.sets?.find(
              (s) => s.set_number === index + 1,
            )

            // Convert weight to user's preferred unit and format
            const weightInPreferredUnit = lastSet?.weight
              ? convertToPreferred(lastSet.weight)
              : null

            return {
              weight: '', // Start empty so placeholder shows
              reps: '', // Start empty so placeholder shows
              lastWorkoutWeight: weightInPreferredUnit
                ? Math.round(weightInPreferredUnit).toString()
                : null,
              lastWorkoutReps: lastSet?.reps?.toString() || null,
              targetRepsMin: routineSet?.reps_min ?? null,
              targetRepsMax: routineSet?.reps_max ?? null,
              targetRestSeconds: routineSet?.rest_seconds ?? null,
            }
          }),
        }
      })
  })
  const exercisesRef = useRef<ExerciseData[]>(exercises)

  useEffect(() => {
    exercisesRef.current = exercises
  }, [exercises])

  // Look up exercise GIFs when exercises change
  useEffect(() => {
    let cancelled = false
    void exerciseLookup.initialize().then(() => {
      if (cancelled) return
      const updates: Record<string, string | null> = {}
      exercises.forEach((ex) => {
        if (!ex.name.trim()) return
        const match = exerciseLookup.findByNameExact(ex.name.trim())
        if (match?.gifUrl) {
          updates[ex.id] = match.gifUrl
        } else {
          updates[ex.id] = null
        }
      })
      if (!cancelled) {
        setExerciseGifUrls((prev) => ({ ...prev, ...updates }))
      }
    })
    return () => {
      cancelled = true
    }
  }, [exercises])

  const commitExercises = useCallback(
    (nextExercises: ExerciseData[]) => {
      exercisesRef.current = nextExercises
      setExercises(nextExercises)
      onDataChange(nextExercises)
    },
    [onDataChange],
  )

  const setFocusedInputState = useCallback((next: FocusedInputState | null) => {
    focusedInputRef.current = next
    setFocusedInput(next)
  }, [])

  const endFocusTransition = useCallback(() => {
    focusTransitionRef.current = false
    if (focusTransitionTimeoutRef.current) {
      clearTimeout(focusTransitionTimeoutRef.current)
      focusTransitionTimeoutRef.current = null
    }
  }, [])

  const startFocusTransition = useCallback(() => {
    focusTransitionRef.current = true
    if (focusTransitionTimeoutRef.current) {
      clearTimeout(focusTransitionTimeoutRef.current)
    }
    // Failsafe to avoid being stuck in transition state if a focus event never arrives.
    focusTransitionTimeoutRef.current = setTimeout(() => {
      focusTransitionRef.current = false
      focusTransitionTimeoutRef.current = null
    }, 700)
  }, [])

  const isStructuredInputCurrentlyFocused = useCallback(() => {
    const textInputState = (TextInput as unknown as {
      State?: { currentlyFocusedInput?: () => unknown }
    }).State
    const activeInput = textInputState?.currentlyFocusedInput?.()
    if (!activeInput) return false

    return Object.values(inputRefs.current).some((ref) => {
      if (!ref) return false
      if (ref === activeInput) return true
      const refAny = ref as unknown as { _nativeTag?: unknown; __nativeTag?: unknown }
      const activeAny = activeInput as { _nativeTag?: unknown; __nativeTag?: unknown }
      return (
        refAny._nativeTag === activeAny._nativeTag ||
        refAny.__nativeTag === activeAny.__nativeTag
      )
    })
  }, [])

  // Update exercises when initialExercises changes
  useEffect(() => {
    if (initialExercises && initialExercises.length > 0) {
      exercisesRef.current = initialExercises
      setExercises(initialExercises)
      // Don't call onDataChange on initial mount - parent already has the data
      if (!isInitialMount.current) {
        onDataChange(initialExercises)
      }
      isInitialMount.current = false
    } else if (
      initialExercises === undefined &&
      exercises.length > 0 &&
      !routine
    ) {
      // Don't clear exercises if initialExercises becomes undefined but we have exercises and no routine
      // This prevents clearing when the component re-renders during state updates
      isInitialMount.current = false
      return
    } else if (
      initialExercises === undefined &&
      exercises.length === 0 &&
      !routine
    ) {
      // Only clear if we truly have no exercises and no routine
      isInitialMount.current = false
      // Don't call setExercises([]) - already empty
    } else {
      isInitialMount.current = false
    }
  }, [initialExercises, routine, exercises.length, onDataChange])

  // Update exercises when routine changes
  useEffect(() => {
    if (routine && (!initialExercises || initialExercises.length === 0)) {
      const newExercises = (routine.workout_routine_exercises || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((exercise) => {
          const sets = (exercise.sets || []).sort(
            (a, b) => a.set_number - b.set_number,
          )

          const exerciseName = exercise.exercise?.name || 'Exercise'
          const lastWorkoutExercise = lastWorkout?.workout_exercises?.find(
            (we) => we.exercise?.name === exerciseName,
          )

          return {
            id: exercise.id,
            name: exercise.exercise?.name || 'Exercise',
            sets: sets.map((routineSet, index) => {
              const lastSet = lastWorkoutExercise?.sets?.find(
                (s) => s.set_number === index + 1,
              )

              const weightInPreferredUnit = lastSet?.weight
                ? convertToPreferred(lastSet.weight)
                : null

              return {
                weight: '',
                reps: '',
                lastWorkoutWeight: weightInPreferredUnit
                  ? Math.round(weightInPreferredUnit).toString()
                  : null,
                lastWorkoutReps: lastSet?.reps?.toString() || null,
                targetRepsMin: routineSet?.reps_min ?? null,
                targetRepsMax: routineSet?.reps_max ?? null,
                targetRestSeconds: routineSet?.rest_seconds ?? null,
              }
            }),
          }
        })

      exercisesRef.current = newExercises
      setExercises(newExercises)
      onDataChange(newExercises)
    }
  }, [routine, lastWorkout, initialExercises, convertToPreferred, onDataChange])

  const handleWeightChange = useCallback(
    (exerciseIndex: number, setIndex: number, value: string) => {
      const newExercises = [...exercisesRef.current]
      const set = newExercises[exerciseIndex]?.sets[setIndex]
      if (!set) return

      set.weight = value
      commitExercises(newExercises)
    },
    [commitExercises],
  )

  const handleRepsChange = useCallback(
    (exerciseIndex: number, setIndex: number, value: string) => {
      const newExercises = [...exercisesRef.current]
      const set = newExercises[exerciseIndex]?.sets[setIndex]
      if (!set) return

      const repsWasEmpty = !set.reps.trim()
      set.reps = value
      const repsNowHasData = Boolean(set.reps.trim())

      commitExercises(newExercises)
    },
    [commitExercises],
  )

  const handleAddSet = useCallback(
    async (exerciseIndex: number) => {
      debugNext('handleAddSet:start', { exerciseIndex })
      await hapticAsync('light')
      const newExercises = [...exercisesRef.current]
      const exercise = newExercises[exerciseIndex]
      if (!exercise) {
        debugNext('handleAddSet:missingExercise', { exerciseIndex })
        return null
      }

      // Get the previous set (if it exists) to carry over targets
      const previousSet = exercise.sets[exercise.sets.length - 1]
      const newSetIndex = exercise.sets.length

      // The new set number (1-indexed)
      const newSetNumber = exercise.sets.length + 1

      // Try to fetch history for this set number
      let historyWeight: string | null = null
      let historyReps: string | null = null

      if (onFetchSetHistory) {
        try {
          const history = await onFetchSetHistory(exercise.name, newSetNumber)
          if (history) {
            historyWeight = history.weight
            historyReps = history.reps
          }
        } catch (error) {
          console.warn('[handleAddSet] Error fetching history:', error)
        }
      }

      // Create a new set with empty inputs and history data
      const newSet: SetData = {
        weight: '',
        reps: '',
        lastWorkoutWeight: historyWeight,
        lastWorkoutReps: historyReps,
        targetRepsMin: previousSet?.targetRepsMin ?? null,
        targetRepsMax: previousSet?.targetRepsMax ?? null,
        targetRestSeconds: previousSet?.targetRestSeconds ?? null,
      }

      exercise.sets.push(newSet)
      commitExercises(newExercises)
      debugNext('handleAddSet:done', {
        exerciseIndex,
        newSetIndex,
        totalSets: exercise.sets.length,
      })
      return newSetIndex
    },
    [commitExercises, debugNext, onFetchSetHistory],
  )

  const handleDeleteSet = async (exerciseIndex: number, setIndex: number) => {
    await hapticAsync('light')
    const newExercises = [...exercisesRef.current]
    const exercise = newExercises[exerciseIndex]
    if (!exercise) return

    // If only one set remains, delete the whole exercise
    if (exercise.sets.length <= 1) {
      handleDeleteExercise(exerciseIndex)
      return
    }

    exercise.sets.splice(setIndex, 1)
    commitExercises(newExercises)
  }

  const handleToggleSetType = async (
    exerciseIndex: number,
    setIndex: number,
  ) => {
    await hapticAsync('light')
    const newExercises = [...exercisesRef.current]
    const set = newExercises[exerciseIndex]?.sets[setIndex]
    if (!set) return
    // Cycle: normal → warmup (W) → body weight (B) → normal
    if (set.isWarmup) {
      set.isWarmup = false
      set.isBodyWeight = true
      set.weight = ''
      // Blur weight input before it unmounts so keypad closes
      inputRefs.current[`${exerciseIndex}-${setIndex}-weight`]?.blur()
      setFocusedInput((prev) =>
        prev?.exerciseIndex === exerciseIndex &&
        prev?.setIndex === setIndex &&
        prev?.field === 'weight'
          ? null
          : prev,
      )
    } else if (set.isBodyWeight) {
      set.isBodyWeight = false
    } else {
      set.isWarmup = true
    }
    commitExercises(newExercises)
  }

  const handleToggleComplete = useCallback(
    async (exerciseIndex: number, setIndex: number) => {
      const currentExercises = exercisesRef.current
      const exercise = currentExercises[exerciseIndex]
      const set = exercise?.sets[setIndex]
      if (!set) return

      const nextCompleted = !set.isCompleted
      await hapticAsync(nextCompleted ? 'medium' : 'light')

      const newExercises = [...currentExercises]
      const updatedSet = newExercises[exerciseIndex]?.sets[setIndex]
      if (!updatedSet) return

      updatedSet.isCompleted = nextCompleted

      if (updatedSet.isCompleted && onRestTimerStart) {
        if (updatedSet.targetRestSeconds) {
          onRestTimerStart(updatedSet.targetRestSeconds)
        } else if (autoRestEnabled && autoRestDuration) {
          onRestTimerStart(autoRestDuration)
        }
      }

      commitExercises(newExercises)
    },
    [commitExercises, onRestTimerStart, autoRestEnabled, autoRestDuration],
  )

  const parseWorkingWeightInput = useCallback((value: string): number | null => {
    const normalized = value.trim().replace(',', '.')
    if (!normalized) return null

    const numeric = Number.parseFloat(normalized)
    if (!Number.isFinite(numeric) || numeric <= 0) return null

    return numeric
  }, [])

  const inferWorkingWeightFromExercise = useCallback(
    async (exercise: ExerciseData): Promise<number | null> => {
      const workingSets = exercise.sets.filter((set) => !set.isWarmup)

      // 1) Prefer first working set with an explicit weight in this session.
      const firstEnteredWorkingWeight = workingSets.find((set) =>
        Boolean(set.weight.trim()),
      )
      if (firstEnteredWorkingWeight?.weight) {
        const parsed = parseWorkingWeightInput(firstEnteredWorkingWeight.weight)
        if (parsed) return parsed
      }

      // 2) Fallback: heaviest entered working-set weight in this session.
      const enteredWeights = workingSets
        .map((set) => parseWorkingWeightInput(set.weight))
        .filter((value): value is number => value !== null)
      if (enteredWeights.length > 0) {
        return Math.max(...enteredWeights)
      }

      // 3) Fallback: heaviest tracked weight from last workout placeholders.
      const lastWorkoutWeights = workingSets
        .map((set) => parseWorkingWeightInput(set.lastWorkoutWeight ?? ''))
        .filter((value): value is number => value !== null)
      if (lastWorkoutWeights.length > 0) {
        return Math.max(...lastWorkoutWeights)
      }

      // 4) Last attempt: fetch set-1 history if provided by parent.
      if (onFetchSetHistory) {
        try {
          const setOneHistory = await onFetchSetHistory(exercise.name, 1)
          const parsed = parseWorkingWeightInput(setOneHistory?.weight ?? '')
          if (parsed) return parsed
        } catch (error) {
          console.warn('[WarmupCalculator] Failed to fetch history fallback:', error)
        }
      }

      return null
    },
    [onFetchSetHistory, parseWorkingWeightInput],
  )

  const getMentalRoundingStep = useCallback(
    (rawWeight: number, equipment: string | null): number => {
      const equipmentNormalized = (equipment ?? '').toLowerCase()
      const isDumbbellLike =
        equipmentNormalized.includes('dumbbell') ||
        equipmentNormalized.includes('kettlebell')

      if (weightUnit === 'kg') {
        // Keep only very light DB/KB movements finer; otherwise simplify to 5kg.
        if (isDumbbellLike && rawWeight < 20) return 2.5
        return 5
      }

      // lbs: favor 5s, and simplify heavier loads to 10s.
      if (rawWeight >= 100) return 10
      return 5
    },
    [weightUnit],
  )

  const snapWarmupWeight = useCallback(
    (rawWeight: number, step: number): number => {
      const scaled = rawWeight / step
      let snapped = Math.round(scaled) * step

      if (snapped <= 0) snapped = step
      return Number(snapped.toFixed(2))
    },
    [],
  )

  const formatWarmupWeight = useCallback((weight: number): string => {
    const normalized = Number(weight.toFixed(2))
    return Number.isInteger(normalized)
      ? String(normalized)
      : normalized.toString()
  }, [])

  const closeStructuredInput = useCallback(() => {
    keypadClosingRef.current = true
    keypadCloseUntilRef.current = Date.now() + 250
    endFocusTransition()
    nextPressInFlightRef.current = false
    setFocusedInputState(null)
    onKeypadStateChange?.(null)
    onInputBlur?.()
    Keyboard.dismiss()
  }, [endFocusTransition, onInputBlur, onKeypadStateChange, setFocusedInputState])

  const handleInsertWarmupSets = useCallback(
    async (exerciseIndex: number) => {
      await hapticAsync('light')
      closeStructuredInput()
      const newExercises = [...exercisesRef.current]
      const exercise = newExercises[exerciseIndex]
      if (!exercise) return

      const workingSets = exercise.sets.filter((set) => !set.isWarmup)
      if (workingSets.length === 0) {
        Alert.alert(
          'No Working Sets',
          'Add at least one working set before inserting warm-up sets.',
        )
        return
      }

      const firstEditableWorkingSetIndex = exercise.sets.findIndex(
        (set) => !set.isWarmup && !set.isBodyWeight,
      )

      const focusWorkingWeightInput = () => {
        if (firstEditableWorkingSetIndex === -1) {
          Alert.alert(
            'Working Weight Needed',
            'Add a weighted working set for this exercise before creating warm-up sets.',
          )
          return
        }

        keypadClosingRef.current = false
        keypadCloseUntilRef.current = 0
        nextPressInFlightRef.current = false
        endFocusTransition()

        setTimeout(() => {
          const inputKey = `${exerciseIndex}-${firstEditableWorkingSetIndex}-weight`
          const input = inputRefs.current[inputKey]
          if (!input) return

          input.blur()
          requestAnimationFrame(() => {
            inputRefs.current[inputKey]?.focus()
          })
        }, 250)
      }

      const workingWeight = await inferWorkingWeightFromExercise(exercise)
      if (!workingWeight) {
        Alert.alert(
          'Working Weight Needed',
          'Enter your working weight first so we can calculate warm-up sets for you.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Working Weight', onPress: focusWorkingWeightInput },
          ],
        )
        return
      }

      await hapticAsync('medium')
      const exerciseMeta = exerciseLookup.findByNameExact(exercise.name)
      const equipment = exerciseMeta?.equipment ?? null
      let previousWarmupWeight = 0

      const warmupSets: SetData[] = DEFAULT_WARMUP_TEMPLATE.map((template, index) => {
        const rawWeight = workingWeight * template.percent
        const step = getMentalRoundingStep(rawWeight, equipment)
        let roundedWeight = snapWarmupWeight(rawWeight, step)

        // Keep progression simple and strictly increasing.
        if (roundedWeight <= previousWarmupWeight) {
          roundedWeight = Number((previousWarmupWeight + step).toFixed(2))
        }
        previousWarmupWeight = roundedWeight

        return {
          weight: formatWarmupWeight(roundedWeight),
          reps: String(template.reps),
          isWarmup: true,
          lastWorkoutWeight: null,
          lastWorkoutReps: null,
          targetRepsMin: null,
          targetRepsMax: null,
          targetRestSeconds: null,
        }
      })

      exercise.sets = [...warmupSets, ...workingSets]
      commitExercises(newExercises)
    },
    [
      closeStructuredInput,
      commitExercises,
      endFocusTransition,
      formatWarmupWeight,
      getMentalRoundingStep,
      inferWorkingWeightFromExercise,
      snapWarmupWeight,
    ],
  )

  const handleDeleteExercise = async (exerciseIndex: number) => {
    await hapticAsync('light')
    const newExercises = exercisesRef.current.filter(
      (_, index) => index !== exerciseIndex,
    )
    commitExercises(newExercises)
  }

  const focusInputWithCursor = useCallback(
    (
      exerciseIndex: number,
      setIndex: number,
      field: 'weight' | 'reps',
      reason: 'programmatic' | 'new-set' | 'modal-ready',
    ) => {
      const key = `${exerciseIndex}-${setIndex}-${field}`

      const tryFocus = (attempt: number) => {
        const input = inputRefs.current[key]
        if (!input) return

        const needsModalForceRefocus = reason === 'modal-ready' && attempt === 0

        if (needsModalForceRefocus) {
          // The iOS Modal mount often causes the underlying TextInput to lose visual focus (caret disappears)
          // even though React Native thinks it's still focused. Calling .blur() forces RN to clear its state
          // so the subsequent .focus() on the next frame actually sends a command to the native UI.
          input.blur()
          requestAnimationFrame(() => {
            // Guard: abort if the user has moved to a different field
            const cur = focusedInputRef.current
            if (!cur || cur.exerciseIndex !== exerciseIndex || cur.setIndex !== setIndex || cur.field !== field) {
              return
            }
            tryFocus(attempt + 1)
          })
          return
        }

        const value =
          field === 'weight'
            ? exercisesRef.current[exerciseIndex]?.sets?.[setIndex]?.weight ?? ''
            : exercisesRef.current[exerciseIndex]?.sets?.[setIndex]?.reps ?? ''
        const cursorPosition = value.length

        input.focus()
        input.setNativeProps({
          selection: { start: cursorPosition, end: cursorPosition },
        })

        const hasFocus = isStructuredInputCurrentlyFocused()

        if (hasFocus || attempt >= 6) return
        requestAnimationFrame(() => {
          // Guard: abort if the user has moved to a different field
          const cur = focusedInputRef.current
          if (!cur || cur.exerciseIndex !== exerciseIndex || cur.setIndex !== setIndex || cur.field !== field) {
            return
          }
          tryFocus(attempt + 1)
        })
      }

      tryFocus(0)
    },
    [isStructuredInputCurrentlyFocused],
  )

  const focusInput = useCallback(
    (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps') => {
      focusInputWithCursor(exerciseIndex, setIndex, field, 'programmatic')
    },
    [focusInputWithCursor],
  )

  const focusInputWhenReady = useCallback(
    (
      exerciseIndex: number,
      setIndex: number,
      field: 'weight' | 'reps',
      attempt = 0,
    ) => {
      const key = `${exerciseIndex}-${setIndex}-${field}`
      const input = inputRefs.current[key]

      if (input) {
        debugNext('focusInputWhenReady:success', { key, attempt })
        focusInputWithCursor(exerciseIndex, setIndex, field, 'new-set')
        return
      }

      // New set inputs may mount a frame or two after async add/history fetch completes.
      if (attempt >= 20) {
        debugNext('focusInputWhenReady:failed', { key, attempt })
        return
      }

      if (attempt === 0 || attempt % 5 === 0) {
        debugNext('focusInputWhenReady:retry', { key, attempt })
      }

      requestAnimationFrame(() => {
        focusInputWhenReady(exerciseIndex, setIndex, field, attempt + 1)
      })
    },
    [debugNext, focusInputWithCursor],
  )

  const handleNextInput = useCallback(
    async (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps') => {
      debugNext('handleNextInput:start', { exerciseIndex, setIndex, field })
      const latestExercises = exercisesRef.current

      if (field === 'weight') {
        startFocusTransition()
        debugNext('handleNextInput:weightToReps', { exerciseIndex, setIndex })
        setFocusedInputState({ exerciseIndex, setIndex, field: 'reps' })
        focusInput(exerciseIndex, setIndex, 'reps')
        return
      }

      // When moving from Reps, auto-validate the current set (mark as completed)
      const newExercises = [...exercisesRef.current]
      const currentSet = newExercises[exerciseIndex]?.sets[setIndex]
      if (currentSet && !currentSet.isCompleted) {
        currentSet.isCompleted = true
        if (onRestTimerStart) {
          if (currentSet.targetRestSeconds) {
            onRestTimerStart(currentSet.targetRestSeconds)
          } else if (autoRestEnabled && autoRestDuration) {
            onRestTimerStart(autoRestDuration)
          }
        }
        commitExercises(newExercises)
      }

      const nextSetIndex = setIndex + 1
      if (latestExercises[exerciseIndex]?.sets[nextSetIndex]) {
        startFocusTransition()
        debugNext('handleNextInput:existingNextSet', {
          exerciseIndex,
          fromSetIndex: setIndex,
          toSetIndex: nextSetIndex,
        })
        setFocusedInputState({
          exerciseIndex,
          setIndex: nextSetIndex,
          field: 'weight',
        })
        focusInput(exerciseIndex, nextSetIndex, 'weight')
        return
      }

      // At the end of an exercise, "Next" creates a new set and focuses its weight.
      if (!compactPreview && latestExercises[exerciseIndex]) {
        startFocusTransition()
        debugNext('handleNextInput:autoAddSet', { exerciseIndex, setIndex })
        const addedSetIndex = await handleAddSet(exerciseIndex)
        if (typeof addedSetIndex === 'number') {
          debugNext('handleNextInput:autoAddSet:focusNewWeight', {
            exerciseIndex,
            addedSetIndex,
          })
          setFocusedInputState({
            exerciseIndex,
            setIndex: addedSetIndex,
            field: 'weight',
          })
          focusInputWhenReady(exerciseIndex, addedSetIndex, 'weight')
          return
        }
        debugNext('handleNextInput:autoAddSet:failed', { exerciseIndex, setIndex })
      }

      const nextExerciseIndex = exerciseIndex + 1
      if (latestExercises[nextExerciseIndex]?.sets?.length > 0) {
        startFocusTransition()
        debugNext('handleNextInput:nextExercise', { nextExerciseIndex })
        setFocusedInputState({
          exerciseIndex: nextExerciseIndex,
          setIndex: 0,
          field: 'weight',
        })
        focusInput(nextExerciseIndex, 0, 'weight')
        return
      }

      debugNext('handleNextInput:dismissKeyboard')
      endFocusTransition()
      setFocusedInputState(null)
      Keyboard.dismiss()
    },
    [
      compactPreview,
      debugNext,
      endFocusTransition,
      focusInput,
      focusInputWhenReady,
      handleAddSet,
      setFocusedInputState,
      startFocusTransition,
    ],
  )

  const handleKeypadKeyPress = useCallback(
    (key: KeypadKey) => {
      const current = focusedInputRef.current
      if (!current) return

      const exercise = exercisesRef.current[current.exerciseIndex]
      const set = exercise?.sets?.[current.setIndex]
      if (!set) return

      const existingValue = current.field === 'weight' ? set.weight : set.reps
      let nextValue = existingValue ?? ''

      if (key === 'backspace') {
        nextValue = nextValue.slice(0, -1)
      } else if (key === 'dot') {
        if (current.field !== 'weight' || nextValue.includes('.')) return
        nextValue = nextValue.length === 0 ? '0.' : `${nextValue}.`
      } else {
        nextValue = `${nextValue}${key}`
      }

      if (current.field === 'weight') {
        handleWeightChange(current.exerciseIndex, current.setIndex, nextValue)
      } else {
        handleRepsChange(current.exerciseIndex, current.setIndex, nextValue)
      }
      debugKeypad('key-press', {
        key,
        exerciseIndex: current.exerciseIndex,
        setIndex: current.setIndex,
        field: current.field,
        existingValue,
        nextValue,
      })
    },
    [debugKeypad, handleRepsChange, handleWeightChange],
  )

  const handleKeypadNext = useCallback(() => {
    if (nextPressInFlightRef.current) return
    if (Date.now() - keypadOpenedAtRef.current < 140) {
      debugKeypad('next-blocked-open-guard', {
        msSinceOpen: Date.now() - keypadOpenedAtRef.current,
      })
      return
    }
    const current = focusedInputRef.current
    if (!current) return
    debugKeypad('next-press', {
      exerciseIndex: current.exerciseIndex,
      setIndex: current.setIndex,
      field: current.field,
    })
    nextPressInFlightRef.current = true
    void Promise.resolve(
      handleNextInput(current.exerciseIndex, current.setIndex, current.field),
    ).finally(() => {
      nextPressInFlightRef.current = false
    })
  }, [debugKeypad, handleNextInput])

  const handleKeypadDone = useCallback(() => {
    const current = focusedInputRef.current
    keypadClosingRef.current = true
    keypadCloseUntilRef.current = Date.now() + 380
    debugFocusTransfer('handleKeypadDone: user tapped Done - closing keypad')
    debugKeypad('done-press', {
      focused: current
        ? `${current.exerciseIndex}-${current.setIndex}-${current.field}`
        : 'no-focus',
      closeUntilInMs: Math.max(0, keypadCloseUntilRef.current - Date.now()),
    })
    if (current) {
      inputRefs.current[
        `${current.exerciseIndex}-${current.setIndex}-${current.field}`
      ]?.blur()
    }
    Keyboard.dismiss()
    endFocusTransition()
    nextPressInFlightRef.current = false
    setFocusedInputState(null)
    onKeypadStateChange?.(null)
    onInputBlur?.()
  }, [debugFocusTransfer, debugKeypad, endFocusTransition, onInputBlur, onKeypadStateChange, setFocusedInputState])

  const reportFocusedInputFrame = useCallback(
    (
      exerciseIndex: number,
      setIndex: number,
      field: 'weight' | 'reps',
      attempt = 0,
    ) => {
      const input = inputRefs.current[`${exerciseIndex}-${setIndex}-${field}`]
      if (!input || !onFocusedInputFrame) return

      input.measureInWindow((_x, y, _width, height) => {
        // During rapid set creation/layout transitions measure can briefly return zeros.
        if ((height <= 0 || y <= 0) && attempt < 8) {
          requestAnimationFrame(() => {
            // Guard: abort if the user has moved to a different field
            const cur = focusedInputRef.current
            if (!cur || cur.exerciseIndex !== exerciseIndex || cur.setIndex !== setIndex || cur.field !== field) {
              return
            }
            reportFocusedInputFrame(exerciseIndex, setIndex, field, attempt + 1)
          })
          return
        }

        if (height > 0) {
          onFocusedInputFrame({ pageY: y, height })
        }
      })
    },
    [onFocusedInputFrame],
  )

  // Stable refs so the keypad callbacks always call the latest version
  // without being included as effect dependencies (which would cause infinite loops
  // when parent re-renders with new inline arrow function props)
  const keypadHandlersRef = useRef({ handleKeypadKeyPress, handleKeypadNext, handleKeypadDone })
  keypadHandlersRef.current = { handleKeypadKeyPress, handleKeypadNext, handleKeypadDone }

  const stableOnKeyPress = useCallback((key: KeypadKey) => keypadHandlersRef.current.handleKeypadKeyPress(key), [])
  const stableOnNext = useCallback(() => keypadHandlersRef.current.handleKeypadNext(), [])
  const stableOnDone = useCallback(() => keypadHandlersRef.current.handleKeypadDone(), [])

  // Notify parent of keypad state so it can render the keypad outside any ScrollView
  useEffect(() => {
    if (compactPreview || !focusedInput || keypadClosingRef.current) {
      debugKeypad('state-close', {
        compactPreview,
        hasFocusedInput: Boolean(focusedInput),
        keypadClosing: keypadClosingRef.current,
      })
      debugFocusTransfer('effect: CLOSE keypad', {
        reason: compactPreview ? 'compactPreview' : !focusedInput ? 'no focusedInput' : 'keypadClosingRef',
        focusedInput: focusedInput ? `${focusedInput.exerciseIndex}-${focusedInput.setIndex}-${focusedInput.field}` : null,
        keypadClosingRef: keypadClosingRef.current,
      })
      onKeypadStateChange?.(null)
    } else {
      keypadOpenedAtRef.current = Date.now()
      debugKeypad('state-open', {
        field: focusedInput.field,
        exerciseIndex: focusedInput.exerciseIndex,
        setIndex: focusedInput.setIndex,
      })
      debugFocusTransfer('effect: OPEN keypad', {
        exerciseIndex: focusedInput.exerciseIndex,
        setIndex: focusedInput.setIndex,
        field: focusedInput.field,
      })
      onKeypadStateChange?.({
        field: focusedInput.field,
        onKeyPress: stableOnKeyPress,
        onNext: stableOnNext,
        onDone: stableOnDone,
        onReady: () => {
          const fi = focusedInputRef.current
          if (!fi) return
          const key = `${fi.exerciseIndex}-${fi.setIndex}-${fi.field}`
          debugKeypad('modal-ready-restore-focus', { key })
          focusInputWithCursor(fi.exerciseIndex, fi.setIndex, fi.field, 'modal-ready')
          // Measure and scroll the input into view now that the keypad is fully shown
          reportFocusedInputFrame(fi.exerciseIndex, fi.setIndex, fi.field)
        },
      })
    }
    // stableOn* are created once and never change - safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedInput, compactPreview, debugKeypad, debugFocusTransfer, onKeypadStateChange, focusInputWithCursor, reportFocusedInputFrame])

  const handleFocus = useCallback(
    (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps') => {
      const hadBlurPending = Boolean(blurTimeoutRef.current)
      const prevFocused = focusedInputRef.current
      debugFocusTransfer('handleFocus ENTER', {
        exerciseIndex,
        setIndex,
        field,
        hadBlurPending,
        prevFocused: prevFocused ? `${prevFocused.exerciseIndex}-${prevFocused.setIndex}-${prevFocused.field}` : null,
      })

      // Cancel any pending blur callback - focus transferred within component
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
        blurTimeoutRef.current = null
        debugFocusTransfer('handleFocus: cancelled blur timeout (focus moved to another field)')
      }

      if (Date.now() < keypadCloseUntilRef.current) {
        debugFocusTransfer('handleFocus: Ignore keypadCloseUntilRef (let focus through)', {
          exerciseIndex,
          setIndex,
          field,
          msUntilAllowed: keypadCloseUntilRef.current - Date.now(),
        })
        keypadCloseUntilRef.current = 0
      }

      // If we are ALREADY fully focused on this exact input, this is a native re-focus
      // (e.g. from our modal-ready blur/focus trick, or a duplicate event during a Next transition).
      // We still want to make sure it's scrolled into view, but we DON'T want to
      // reset keypad state or trigger a duplicate OPEN.
      const fi = focusedInputRef.current
      
      // If the keypad was completely closed (fi is null) but React Native still thinks we are 
      // focused on the native input, we want to NOT skip this. We must open the keypad.
      if (
        fi !== null &&
        fi?.exerciseIndex === exerciseIndex &&
        fi?.setIndex === setIndex &&
        fi?.field === field
      ) {
        debugFocusTransfer('handleFocus: SKIP duplicate (same field re-focused)')
        endFocusTransition()
        requestAnimationFrame(() => {
          const current = focusedInputRef.current
          if (
            current?.exerciseIndex === exerciseIndex &&
            current?.setIndex === setIndex &&
            current?.field === field
          ) {
            reportFocusedInputFrame(exerciseIndex, setIndex, field)
          }
        })
        return
      }

      debugFocusTransfer('handleFocus: SUCCESS - setting focusedInput', {
        exerciseIndex,
        setIndex,
        field,
        from: prevFocused ? `${prevFocused.exerciseIndex}-${prevFocused.setIndex}-${prevFocused.field}` : null,
      })
      endFocusTransition()
      nextPressInFlightRef.current = false
      keypadClosingRef.current = false
      setFocusedInputState({ exerciseIndex, setIndex, field })
      onInputFocus?.()
      requestAnimationFrame(() => {
        // Guard: only report frame if still on this input (transition may have moved us)
        const current = focusedInputRef.current
        if (
          current?.exerciseIndex === exerciseIndex &&
          current?.setIndex === setIndex &&
          current?.field === field
        ) {
          reportFocusedInputFrame(exerciseIndex, setIndex, field)
        }
      })
    },
    [debugFocusTransfer, endFocusTransition, onInputFocus, reportFocusedInputFrame, setFocusedInputState],
  )

  const handleBlur = useCallback(
    (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps') => {
      debugFocusTransfer('handleBlur ENTER (scheduling 300ms timeout)', {
        exerciseIndex,
        setIndex,
        field,
      })
      // Debounce the blur callback to allow focus to transfer between inputs
      // This prevents the double toolbar glitch on iOS
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
      blurTimeoutRef.current = setTimeout(() => {
        const focusedState = focusedInputRef.current
        debugFocusTransfer('handleBlur TIMEOUT fired', {
          blurred: { exerciseIndex, setIndex, field },
          focusedInputRef: focusedState ? `${focusedState.exerciseIndex}-${focusedState.setIndex}-${focusedState.field}` : null,
          keypadClosingRef: keypadClosingRef.current,
          focusTransitionRef: focusTransitionRef.current,
        })

        if (keypadClosingRef.current) {
          debugFocusTransfer('handleBlur: SKIP keypadClosingRef')
          blurTimeoutRef.current = null
          return
        }

        if (focusTransitionRef.current) {
          debugFocusTransfer('handleBlur: SKIP focusTransitionRef')
          blurTimeoutRef.current = null
          return
        }

        if (
          focusedState &&
          (
            focusedState.exerciseIndex !== exerciseIndex ||
            focusedState.setIndex !== setIndex ||
            focusedState.field !== field
          )
        ) {
          debugFocusTransfer('handleBlur: SKIP focus moved to another field', {
            blurred: `${exerciseIndex}-${setIndex}-${field}`,
            focused: `${focusedState.exerciseIndex}-${focusedState.setIndex}-${focusedState.field}`,
          })
          blurTimeoutRef.current = null
          return
        }

        // Don't skip when isStructuredInputCurrentlyFocused - the native input can retain
        // "ghost focus" after keypad close. We must commit so focusedInputRef becomes null,
        // allowing re-tap on same field to open keypad again.
        debugFocusTransfer('handleBlur: COMMIT - closing keypad', {
          exerciseIndex,
          setIndex,
          field,
        })
        setFocusedInputState(null)
        onKeypadStateChange?.(null)
        onInputBlur?.()
        blurTimeoutRef.current = null
      }, 300)
    },
    [debugFocusTransfer, onInputBlur, onKeypadStateChange, setFocusedInputState],
  )

  // Drag and drop handlers
  const handleLongPressExercise = useCallback(
    async (index: number) => {
      await hapticAsync('medium')
      setDraggingIndex(index)
      draggingScale.value = withSpring(1.02, {
        damping: 15,
        stiffness: 150,
      })
      draggingOpacity.value = withTiming(0.9, {
        duration: 150,
        easing: Easing.inOut(Easing.ease),
      })
    },
    [draggingScale, draggingOpacity],
  )

  const handleMoveExerciseUp = useCallback(
    async (index: number) => {
      const updated = [...exercisesRef.current]
      if (index <= 0 || index >= updated.length) return
      await hapticAsync('light')
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)

      // Compute the new order
      ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]

      // Update state and notify parent
      commitExercises(updated)
      setDraggingIndex(index - 1)
    },
    [commitExercises],
  )

  const handleMoveExerciseDown = useCallback(
    async (index: number) => {
      const updated = [...exercisesRef.current]
      if (index < 0 || index >= updated.length - 1) return
      await hapticAsync('light')
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)

      // Compute the new order
      ;[updated[index + 1], updated[index]] = [updated[index], updated[index + 1]]

      // Update state and notify parent
      commitExercises(updated)
      setDraggingIndex(index + 1)
    },
    [commitExercises],
  )

  const handleDropExercise = useCallback(async () => {
    await hapticAsync('light')
    draggingScale.value = withSpring(1, {
      damping: 10,
      stiffness: 100,
    })
    draggingOpacity.value = withTiming(1, {
      duration: 200,
      easing: Easing.inOut(Easing.ease),
    })
    setDraggingIndex(null)
  }, [draggingScale, draggingOpacity])

  const handleMenuPress = useCallback(async (index: number) => {
    await hapticAsync('light')
    setMenuExerciseIndex(index)
  }, [])

  // Single animated style for the dragging exercise
  const dragAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: draggingScale.value }],
    opacity: draggingOpacity.value,
  }))

  return (
    <>
      <View style={styles.container}>
        {exercises.map((exercise, exerciseIndex) => {
          const isDragging = draggingIndex === exerciseIndex

          return (
            <Animated.View
              key={exercise.id}
              style={[
                styles.exerciseBlock,
                isDragging && dragAnimatedStyle,
                isDragging && styles.exerciseBlockDragging,
              ]}
            >
            {/* Exercise Header */}
            <WorkoutExerciseHeader
              exercise={exercise}
              exerciseIndex={exerciseIndex}
              isDragging={isDragging}
              compactPreview={compactPreview ?? false}
              colors={colors}
              styles={styles}
              exerciseGifUrl={exerciseGifUrls[exercise.id] ?? undefined}
              totalExercises={exercises.length}
              onExerciseNamePress={onExerciseNamePress}
              onLongPressExercise={handleLongPressExercise}
              onMoveExerciseUp={handleMoveExerciseUp}
              onMoveExerciseDown={handleMoveExerciseDown}
              onDropExercise={handleDropExercise}
              onDeleteExercise={handleDeleteExercise}
              onMenuPress={handleMenuPress}
            />

            {/* Sets as inline text with inputs - hide when dragging for cleaner look */}
            {!isDragging && (
              <>
                {exercise.sets.length > 0 && (
                  <View style={styles.setHeaderRow}>
                    <Text style={[styles.setHeaderText, styles.setColSet]}>SET</Text>
                    <Text style={[styles.setHeaderText, styles.setColPrev]}>PREVIOUS</Text>
                    <Text style={[styles.setHeaderText, styles.setColInput]}>
                      {unitDisplay.toUpperCase()}
                    </Text>
                    <Text style={[styles.setHeaderText, styles.setColInput]}>REPS</Text>
                    <View style={styles.setColCheckmark} />
                  </View>
                )}
                {(() => {
                  let workingSetNumber = 0
                  return exercise.sets.map((set, setIndex) => {
                    const isWarmup = set.isWarmup === true
                    const isBodyWeight = set.isBodyWeight === true
                    if (!isWarmup) workingSetNumber++
                    const displayLabel = isWarmup
                      ? 'W'
                      : isBodyWeight
                        ? 'B'
                        : workingSetNumber

                    let targetText = ''
                    if (
                      typeof set.targetRepsMin === 'number' &&
                      typeof set.targetRepsMax === 'number'
                    ) {
                      if (set.targetRepsMin === set.targetRepsMax) {
                        targetText = ` (${set.targetRepsMin})`
                      } else {
                        targetText = ` (${set.targetRepsMin}-${set.targetRepsMax})`
                      }
                    }

                    return (
                      <WorkoutSetRow
                        key={setIndex}
                        exerciseIndex={exerciseIndex}
                        setIndex={setIndex}
                        set={set}
                        workingSetNumber={workingSetNumber}
                        isWarmup={isWarmup}
                        isBodyWeight={isBodyWeight}
                        displayLabel={displayLabel}
                        targetText={targetText}
                        isWeightFocused={focusedInput?.exerciseIndex === exerciseIndex && focusedInput?.setIndex === setIndex && focusedInput?.field === 'weight'}
                        isRepsFocused={focusedInput?.exerciseIndex === exerciseIndex && focusedInput?.setIndex === setIndex && focusedInput?.field === 'reps'}
                        isWeightSuspicious={isWeightSuspicious(set.weight)}
                        compactPreview={compactPreview ?? false}
                        unitDisplay={unitDisplay}
                        colors={colors}
                        styles={styles}
                        onToggleSetType={handleToggleSetType}
                        onToggleComplete={handleToggleComplete}
                        onWeightChange={handleWeightChange}
                        onRepsChange={handleRepsChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onPressIn={(exIdx, setIdx, fld) => {
                          // When keypad is closed, native input can retain ghost focus so onFocus won't fire.
                          // Force blur/focus cycle to wake keypad; otherwise just delegate to handleFocus.
                          if (!focusedInputRef.current) {
                            inputRefs.current[`${exIdx}-${setIdx}-${fld}`]?.blur()
                            requestAnimationFrame(() => {
                              inputRefs.current[`${exIdx}-${setIdx}-${fld}`]?.focus()
                              handleFocus(exIdx, setIdx, fld)
                            })
                          } else {
                            handleFocus(exIdx, setIdx, fld)
                          }
                        }}
                        onDeleteSet={handleDeleteSet}
                        onSelectionWeightChange={undefined}
                        onSelectionRepsChange={undefined}
                        registerWeightRef={(ref) => { inputRefs.current[`${exerciseIndex}-${setIndex}-weight`] = ref }}
                        registerRepsRef={(ref) => { inputRefs.current[`${exerciseIndex}-${setIndex}-reps`] = ref }}
                        canDelete={true}
                      />
                    )
                  })
                })()}

                {!compactPreview && (
                  <View style={styles.setActionsRow}>
                    <TouchableOpacity
                      style={styles.addSetButton}
                      onPress={() => handleAddSet(exerciseIndex)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="add"
                        size={20}
                        color={colors.textPrimary}
                      />
                      <Text style={styles.addSetText}>Add set</Text>
                    </TouchableOpacity>

                    {warmupCalculatorEnabled &&
                      !exercise.sets.some((s) => s.isWarmup) &&
                      !(exercise.sets[0]?.reps.trim()) && (
                      <TouchableOpacity
                        style={styles.addWarmupButton}
                        onPress={() => {
                          void handleInsertWarmupSets(exerciseIndex)
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="flame"
                          size={18}
                          color={colors.statusWarning}
                        />
                        <Text style={styles.addWarmupText}>Add warm-ups</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}

            {/* Compact info when dragging */}
            {isDragging && (
              <Text style={styles.dragInfo}>
                {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}
              </Text>
            )}
            </Animated.View>
          )
        })}
      </View>
      {/* Keypad is rendered by parent via onKeypadStateChange to avoid Modal focus-stealing */}
      
      <WorkoutExerciseMenuBottomSheet
        visible={menuExerciseIndex !== null}
        onClose={() => setMenuExerciseIndex(null)}
        onReorder={() => {
          if (menuExerciseIndex !== null) {
            handleLongPressExercise(menuExerciseIndex)
          }
        }}
        onReplace={() => {
          if (menuExerciseIndex !== null && onReplaceExercise) {
            onReplaceExercise(menuExerciseIndex)
          }
        }}
        onRemove={() => {
          if (menuExerciseIndex !== null) {
            handleDeleteExercise(menuExerciseIndex)
          }
        }}
      />
    </>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  compactPreview = false,
) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    exerciseBlock: {
      marginBottom: compactPreview ? 6 : 22,
    },
    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: compactPreview ? 4 : 8,
    },
    exerciseNameRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: compactPreview ? 8 : 10,
      marginRight: 8,
    },
    exerciseThumbnail: {
      width: compactPreview ? 32 : 40,
      height: compactPreview ? 32 : 40,
      borderRadius: compactPreview ? 8 : 10,
    },
    exerciseNameButton: {
      flex: 1,
    },
    exerciseName: {
      fontSize: compactPreview ? 15 : 17,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: compactPreview ? 20 : 24,
    },
    menuExerciseButton: {
      marginLeft: 8,
      padding: 4,
      flexShrink: 0,
    },
    targetText: {
      fontSize: compactPreview ? 12 : 14,
      color: colors.textSecondary,
      fontWeight: '400',
      marginTop: compactPreview ? 2 : 4,
    },
    setHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 8,
      paddingHorizontal: 4,
    },
    setHeaderText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    setColSet: {
      width: 44,
      alignItems: 'center',
    },
    setColPrev: {
      flex: 1,
      paddingHorizontal: 12,
      alignItems: 'center',
    },
    setColInput: {
      width: 68,
      alignItems: 'center',
      justifyContent: 'center',
    },
    setColCheckmark: {
      width: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: compactPreview ? 4 : 8,
      width: '100%',
      paddingHorizontal: 4,
      paddingVertical: 4,
      borderRadius: 6,
    },
    setRowCompleted: {
      backgroundColor: (colors.statusSuccess || '#34C759') + '1A', // ~10% opacity green
    },
    checkmarkButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.surfaceSubtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkmarkButtonCompleted: {
      backgroundColor: colors.statusSuccess || '#34C759',
    },
    setNumberBadge: {
      width: compactPreview ? 24 : 28,
      height: compactPreview ? 24 : 28,
      borderRadius: compactPreview ? 12 : 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    setNumberBadgeFallback: {
      backgroundColor: colors.border,
    },
    setNumberBadgeTouch: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    setNumberText: {
      fontSize: compactPreview ? 12 : 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    warmupText: {
      color: colors.statusWarning,
    },
    bodyWeightText: {
      color: colors.textSecondary,
    },
    boxInputPlaceholder: {
      width: compactPreview ? 52 : 60,
      height: compactPreview ? 32 : 36,
    },
    previousTouchable: {
      flex: 1,
      alignSelf: 'stretch',
      justifyContent: 'center',
      alignItems: 'center',
    },
    previousText: {
      fontSize: compactPreview ? 13 : 15,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    boxInput: {
      width: compactPreview ? 52 : 60,
      height: compactPreview ? 32 : 36,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle || 'transparent',
      fontSize: compactPreview ? 15 : 17,
      color: colors.textPrimary,
      textAlign: 'center',
      paddingVertical: 0,
      paddingHorizontal: 4,
    },
    boxInputFocused: {
      borderColor: colors.brandPrimary,
      borderWidth: 1.5,
    },
    boxInputWarning: {
      borderColor: colors.statusError,
      color: colors.statusError,
      borderWidth: 1.5,
    },
    swipeableContainer: {
      width: '100%',
    },
    swipeActionContainer: {
      width: 75,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    swipeDeleteButton: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.statusError || '#FF3B30',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      right: 0,
    },
    swipeDeleteText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 15,
    },
    setActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: compactPreview ? 8 : 12,
      paddingHorizontal: 4,
    },
    addSetButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 24,
      paddingVertical: 10,
    },
    addSetText: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '600',
      marginLeft: 6,
    },
    addWarmupButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 24,
      paddingVertical: 10,
    },
    addWarmupText: {
      fontSize: 15,
      color: colors.statusWarning,
      fontWeight: '600',
      marginLeft: 6,
    },
    // Drag and drop styles
    exerciseBlockDragging: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginHorizontal: -12,
      borderWidth: 1,
      borderColor: colors.brandPrimary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    dragControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    dragArrow: {
      padding: 4,
    },
    dragArrowDisabled: {
      opacity: 0.4,
    },
    dragDone: {
      marginLeft: 8,
      padding: 6,
      backgroundColor: `${colors.brandPrimary}20`,
      borderRadius: 16,
    },
    dragInfo: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
  })
