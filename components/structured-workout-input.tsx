import { EditorToolbar } from '@/components/editor-toolbar'
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
    InputAccessoryView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'

interface SetData {
  weight: string
  reps: string
  isWarmup?: boolean
  lastWorkoutWeight?: string | null
  lastWorkoutReps?: string | null
  targetRepsMin?: number | null
  targetRepsMax?: number | null
  targetRestSeconds?: number | null
}

interface ExerciseData {
  id: string
  name: string
  sets: SetData[]
}

interface StructuredWorkoutInputProps {
  routine?: WorkoutRoutineWithDetails
  lastWorkout?: WorkoutSessionWithDetails | null
  initialExercises?: ExerciseData[]
  onDataChange: (exercises: ExerciseData[]) => void
  onRestTimerStart?: (seconds: number) => void
  onInputFocus?: () => void
  onInputBlur?: () => void
  editorToolbarProps?: Parameters<typeof EditorToolbar>[0]
  /**
   * Callback to fetch history data for a specific set when adding new sets.
   * Returns the last workout's weight/reps for the given exercise and set number.
   */
  onFetchSetHistory?: (
    exerciseName: string,
    setNumber: number,
  ) => Promise<{ weight: string | null; reps: string | null } | null>
}

export function StructuredWorkoutInput({
  routine,
  lastWorkout,
  initialExercises,
  onDataChange,
  onRestTimerStart,
  onInputFocus,
  onInputBlur,
  editorToolbarProps,
  onFetchSetHistory,
}: StructuredWorkoutInputProps) {
  const colors = useThemedColors()
  const { weightUnit, convertToPreferred } = useWeightUnits()
  const styles = createStyles(colors)
  const isInitialMount = useRef(true)
  const inputRefs = useRef<{ [key: string]: TextInput | null }>({})
  const [focusedInput, setFocusedInput] = useState<{
    exerciseIndex: number
    setIndex: number
    field: 'weight' | 'reps'
  } | null>(null)

  // Get the display unit text (kg or lbs)
  const unitDisplay = weightUnit === 'kg' ? 'kg' : 'lbs'

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

  // Update exercises when initialExercises changes
  useEffect(() => {
    if (initialExercises && initialExercises.length > 0) {
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

      setExercises(newExercises)
      onDataChange(newExercises)
    }
  }, [routine, lastWorkout, initialExercises, convertToPreferred, onDataChange])

  const handleWeightChange = (
    exerciseIndex: number,
    setIndex: number,
    value: string,
  ) => {
    const newExercises = [...exercises]
    const set = newExercises[exerciseIndex].sets[setIndex]

    set.weight = value

    setExercises(newExercises)
    onDataChange(newExercises)
  }

  const handleRepsChange = (
    exerciseIndex: number,
    setIndex: number,
    value: string,
  ) => {
    const newExercises = [...exercises]
    const set = newExercises[exerciseIndex].sets[setIndex]
    const repsWasEmpty = !set.reps.trim()

    set.reps = value
    const repsNowHasData = Boolean(set.reps.trim())

    // Start rest timer when user enters reps (goes from empty to having data)
    if (repsWasEmpty && repsNowHasData && set.targetRestSeconds && onRestTimerStart) {
      onRestTimerStart(set.targetRestSeconds)
    }

    setExercises(newExercises)
    onDataChange(newExercises)
  }

  const handleAddSet = useCallback(
    async (exerciseIndex: number) => {
      await hapticAsync('light')
      const newExercises = [...exercises]
      const exercise = newExercises[exerciseIndex]

      // Get the weight from the previous set (if it exists)
      const previousSet = exercise.sets[exercise.sets.length - 1]
      const prefillWeight = previousSet?.weight || ''

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

      // Create a new set with prefilled weight and history data
      const newSet: SetData = {
        weight: prefillWeight,
        reps: '',
        lastWorkoutWeight: historyWeight,
        lastWorkoutReps: historyReps,
        targetRepsMin: previousSet?.targetRepsMin ?? null,
        targetRepsMax: previousSet?.targetRepsMax ?? null,
        targetRestSeconds: previousSet?.targetRestSeconds ?? null,
      }

      exercise.sets.push(newSet)
      setExercises(newExercises)
      onDataChange(newExercises)
    },
    [exercises, onFetchSetHistory, onDataChange],
  )

  const handleDeleteSet = async (exerciseIndex: number, setIndex: number) => {
    await hapticAsync('light')
    const newExercises = [...exercises]
    const exercise = newExercises[exerciseIndex]

    // Don't allow deleting if only one set remains
    if (exercise.sets.length <= 1) {
      return
    }

    exercise.sets.splice(setIndex, 1)
    setExercises(newExercises)
    onDataChange(newExercises)
  }

  const handleToggleWarmup = async (exerciseIndex: number, setIndex: number) => {
    await hapticAsync('light')
    const newExercises = [...exercises]
    const set = newExercises[exerciseIndex].sets[setIndex]
    set.isWarmup = !set.isWarmup
    setExercises(newExercises)
    onDataChange(newExercises)
  }

  const handleDeleteExercise = async (exerciseIndex: number) => {
    await hapticAsync('light')
    const newExercises = exercises.filter((_, index) => index !== exerciseIndex)
    setExercises(newExercises)
    onDataChange(newExercises)
  }

  const focusNextInput = (
    exerciseIndex: number,
    setIndex: number,
    field: 'weight' | 'reps',
  ) => {
    if (field === 'weight') {
      // Move to reps field of the same set
      const repsKey = `${exerciseIndex}-${setIndex}-reps`
      inputRefs.current[repsKey]?.focus()
    } else if (field === 'reps') {
      // Move to weight field of next set
      const nextSetIndex = setIndex + 1
      if (nextSetIndex < exercises[exerciseIndex].sets.length) {
        // Next set in same exercise
        const weightKey = `${exerciseIndex}-${nextSetIndex}-weight`
        inputRefs.current[weightKey]?.focus()
      } else if (exerciseIndex + 1 < exercises.length) {
        // First set of next exercise
        const weightKey = `${exerciseIndex + 1}-0-weight`
        inputRefs.current[weightKey]?.focus()
      }
    }
  }

  const handleManualNext = () => {
    if (!focusedInput) return
    focusNextInput(
      focusedInput.exerciseIndex,
      focusedInput.setIndex,
      focusedInput.field,
    )
  }

  const handleFocus = useCallback(
    (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps') => {
      setFocusedInput({ exerciseIndex, setIndex, field })
      onInputFocus?.()
    },
    [onInputFocus],
  )

  const handleBlur = useCallback(() => {
    setFocusedInput(null)
    onInputBlur?.()
  }, [onInputBlur])

  const inputAccessoryViewID = 'structured-workout-accessory-view'

  return (
    <View style={styles.container}>
      {/* Input Accessory View for toolbar above keyboard */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={inputAccessoryViewID}>
          <View style={styles.accessoryContainer}>
            <View style={styles.nextButtonContainer}>
              <TouchableOpacity
                onPress={handleManualNext}
                style={styles.nextButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.nextButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
            {editorToolbarProps && (
              <View style={styles.toolbarContainer}>
                <EditorToolbar {...editorToolbarProps} />
              </View>
            )}
          </View>
        </InputAccessoryView>
      )}

      {exercises.map((exercise, exerciseIndex) => (
        <View key={exercise.id} style={styles.exerciseBlock}>
          {/* Exercise Name with delete button */}
          <View style={styles.exerciseHeader}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            <TouchableOpacity
              style={styles.deleteExerciseButton}
              onPress={() => handleDeleteExercise(exerciseIndex)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={colors.statusError} />
            </TouchableOpacity>
          </View>

          {/* Sets as inline text with inputs */}
          {(() => {
            let workingSetNumber = 0
            return exercise.sets.map((set, setIndex) => {
              const isWarmup = set.isWarmup === true
              if (!isWarmup) workingSetNumber++
              const displayLabel = isWarmup ? 'W' : workingSetNumber

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
                <View key={setIndex} style={styles.setRow}>
                    <TouchableOpacity
                      style={[styles.setNumberBadge, isWarmup && styles.warmupBadge]}
                      onPress={() => handleToggleWarmup(exerciseIndex, setIndex)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.setNumberText, isWarmup && styles.warmupText]}>
                        {displayLabel}
                      </Text>
                    </TouchableOpacity>
                    <TextInput
                      ref={(ref) => {
                        inputRefs.current[
                          `${exerciseIndex}-${setIndex}-weight`
                        ] = ref
                      }}
                      style={styles.inlineInput}
                      placeholder={
                        set.lastWorkoutWeight ? set.lastWorkoutWeight : '___'
                      }
                      placeholderTextColor={
                        set.lastWorkoutWeight
                          ? colors.textTertiary
                          : colors.textPlaceholder
                      }
                      keyboardType="decimal-pad"
                      value={set.weight}
                      onChangeText={(value) =>
                        handleWeightChange(exerciseIndex, setIndex, value)
                      }
                      onSubmitEditing={() =>
                        focusNextInput(exerciseIndex, setIndex, 'weight')
                      }
                      returnKeyType="next"
                      cursorColor={colors.brandPrimary}
                      selectionColor={colors.brandPrimary}
                      onFocus={() =>
                        handleFocus(exerciseIndex, setIndex, 'weight')
                      }
                      onBlur={handleBlur}
                      inputAccessoryViewID={inputAccessoryViewID}
                    />
                    <Text style={styles.setText}> {unitDisplay} x </Text>
                    <TextInput
                      ref={(ref) => {
                        inputRefs.current[
                          `${exerciseIndex}-${setIndex}-reps`
                        ] = ref
                      }}
                      style={styles.inlineInput}
                      placeholder={
                        set.lastWorkoutReps ? set.lastWorkoutReps : '___'
                      }
                      placeholderTextColor={
                        set.lastWorkoutReps
                          ? colors.textTertiary
                          : colors.textPlaceholder
                      }
                      keyboardType="number-pad"
                      value={set.reps}
                      onChangeText={(value) =>
                        handleRepsChange(exerciseIndex, setIndex, value)
                      }
                      onSubmitEditing={() =>
                        focusNextInput(exerciseIndex, setIndex, 'reps')
                      }
                      returnKeyType="next"
                      cursorColor={colors.brandPrimary}
                      selectionColor={colors.brandPrimary}
                      onFocus={() => handleFocus(exerciseIndex, setIndex, 'reps')}
                      onBlur={handleBlur}
                      inputAccessoryViewID={inputAccessoryViewID}
                    />
                    <Text style={styles.setText}> reps</Text>
                    {targetText && (
                      <Text style={styles.targetText}>{targetText}</Text>
                    )}
                    <View style={styles.deleteSetButtonContainer}>
                      {setIndex === exercise.sets.length - 1 &&
                        exercise.sets.length > 1 && (
                          <TouchableOpacity
                            style={styles.deleteSetButton}
                            onPress={() =>
                              handleDeleteSet(exerciseIndex, setIndex)
                            }
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name="close-circle"
                              size={18}
                              color={colors.textTertiary}
                            />
                          </TouchableOpacity>
                        )}
                    </View>
                  </View>
                )
              })
          })()}

          {/* Add Set Button */}
          <TouchableOpacity
            style={styles.addSetButton}
            onPress={() => handleAddSet(exerciseIndex)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="add-circle-outline"
              size={18}
              color={colors.brandPrimary}
            />
            <Text style={styles.addSetText}>Add set</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    exerciseBlock: {
      marginBottom: 20,
    },
    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    exerciseName: {
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 24,
    },
    deleteExerciseButton: {
      marginLeft: 8,
      padding: 4,
      flexShrink: 0,
    },
    targetText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '400',
      marginTop: 4,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
      lineHeight: 24,
      width: '100%',
    },
    setNumberBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    warmupBadge: {
      backgroundColor: `${colors.statusWarning}25`,
    },
    setNumberText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    warmupText: {
      color: colors.statusWarning,
    },
    setText: {
      fontSize: 17,
      color: colors.textPrimary,
      lineHeight: 24,
    },
    inlineInput: {
      minWidth: 40,
      paddingHorizontal: 2,
      paddingTop: 0,
      paddingBottom: 0,
      fontSize: 17,
      color: colors.textPrimary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      textAlign: 'center',
    },
    inlineInputWithValue: {
      color: colors.textSecondary,
      fontWeight: '500',
    },
    deleteSetButtonContainer: {
      width: 28,
      marginLeft: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteSetButton: {
      padding: 4,
    },
    addSetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    addSetText: {
      fontSize: 15,
      color: colors.brandPrimary,
      marginLeft: 4,
      fontWeight: '500',
    },
    // Accessory View Styles
    accessoryContainer: {
      backgroundColor: colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    nextButtonContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
    },
    nextButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.brandPrimary,
      borderRadius: 16,
    },
    nextButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFF',
    },
    toolbarContainer: {
      // The toolbar itself handles its own layout/styles, just wrapping it
    },
  })
