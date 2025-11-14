import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import {
  WorkoutRoutineWithDetails,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

interface SetData {
  weight: string
  reps: string
  lastWorkoutWeight?: string | null
  lastWorkoutReps?: string | null
  targetRepsMin?: number | null
  targetRepsMax?: number | null
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
}

const formatRestDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))

  // If under 1 minute, show just seconds
  if (safeSeconds < 60) {
    return `${safeSeconds}`
  }

  // If 1 minute or more, show M:SS
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60

  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function StructuredWorkoutInput({
  routine,
  lastWorkout,
  initialExercises,
  onDataChange,
}: StructuredWorkoutInputProps) {
  const colors = useThemedColors()
  const { weightUnit, convertToPreferred } = useWeightUnits()
  const styles = createStyles(colors)
  const isInitialMount = useRef(true)

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
            }
          }),
        }
      })
  })

  const [restTimerStarts, setRestTimerStarts] = useState<Record<string, number>>(
    {},
  )
  const previousSetCountsRef = useRef(new Map<string, number>())
  const [, forceTimerTick] = useState(0)

  // Update exercises when initialExercises changes
  useEffect(() => {
    if (initialExercises && initialExercises.length > 0) {
      setExercises(initialExercises)
      // Don't call onDataChange on initial mount - parent already has the data
      if (!isInitialMount.current) {
        onDataChange(initialExercises)
      }
      isInitialMount.current = false
    } else if (initialExercises === undefined && exercises.length > 0 && !routine) {
      // Don't clear exercises if initialExercises becomes undefined but we have exercises and no routine
      // This prevents clearing when the component re-renders during state updates
      isInitialMount.current = false
      return
    } else if (initialExercises === undefined && exercises.length === 0 && !routine) {
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
              }
            }),
          }
        })
      
      setExercises(newExercises)
      onDataChange(newExercises)
    }
  }, [routine, lastWorkout, initialExercises, convertToPreferred, onDataChange])

  useEffect(() => {
    setRestTimerStarts((prev) => {
      let changed = false
      const next = { ...prev }
      const activeIds = new Set<string>()

      exercises.forEach((exercise) => {
        const key = exercise.id
        activeIds.add(key)
        const prevCount = previousSetCountsRef.current.get(key)
        const currentCount = exercise.sets.length

        if (prevCount === undefined || currentCount > prevCount) {
          next[key] = Date.now()
          changed = true
        }

        previousSetCountsRef.current.set(key, currentCount)
      })

      Object.keys(prev).forEach((key) => {
        if (!activeIds.has(key)) {
          delete next[key]
          previousSetCountsRef.current.delete(key)
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [exercises])

  useEffect(() => {
    if (Object.keys(restTimerStarts).length === 0) {
      return
    }

    const interval = setInterval(() => {
      forceTimerTick((tick) => tick + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [restTimerStarts])

  const getRestSeconds = useCallback(
    (exerciseId: string) => {
      const start = restTimerStarts[exerciseId]
      if (!start) return 0
      return Math.max(0, Math.floor((Date.now() - start) / 1000))
    },
    [restTimerStarts],
  )

  const handleWeightChange = (
    exerciseIndex: number,
    setIndex: number,
    value: string,
  ) => {
    const newExercises = [...exercises]
    newExercises[exerciseIndex].sets[setIndex].weight = value
    setExercises(newExercises)
    onDataChange(newExercises)
  }

  const handleRepsChange = (
    exerciseIndex: number,
    setIndex: number,
    value: string,
  ) => {
    const newExercises = [...exercises]
    newExercises[exerciseIndex].sets[setIndex].reps = value
    setExercises(newExercises)
    onDataChange(newExercises)
  }

  const handleAddSet = async (exerciseIndex: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newExercises = [...exercises]
    const exercise = newExercises[exerciseIndex]
    
    // Create a new empty set
    const newSet: SetData = {
      weight: '',
      reps: '',
      lastWorkoutWeight: null,
      lastWorkoutReps: null,
      targetRepsMin: null,
      targetRepsMax: null,
    }
    
    exercise.sets.push(newSet)
    setExercises(newExercises)
    onDataChange(newExercises)
  }

  const handleDeleteSet = async (
    exerciseIndex: number,
    setIndex: number,
  ) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
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

  const handleDeleteExercise = async (exerciseIndex: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newExercises = exercises.filter((_, index) => index !== exerciseIndex)
    setExercises(newExercises)
    onDataChange(newExercises)
  }

  return (
    <View style={styles.container}>
      {exercises.map((exercise, exerciseIndex) => {
        return (
          <View key={exercise.id} style={styles.exerciseBlock}>
            {/* Exercise Name with delete button */}
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseTitleRow}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.restTimerText}>
                  {formatRestDuration(getRestSeconds(exercise.id))}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteExerciseButton}
                onPress={() => handleDeleteExercise(exerciseIndex)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.error}
                />
              </TouchableOpacity>
            </View>

            {/* Sets as inline text with inputs */}
            {exercise.sets.map((set, setIndex) => {
              // Format target text for this set
              let targetText = ''
              if (set.targetRepsMin !== null && set.targetRepsMax !== null) {
                if (set.targetRepsMin === set.targetRepsMax) {
                  targetText = ` (${set.targetRepsMin})`
                } else {
                  targetText = ` (${set.targetRepsMin}-${set.targetRepsMax})`
                }
              }

              return (
                <View key={setIndex} style={styles.setRow}>
                  <Text style={styles.setText}>Set {setIndex + 1}: </Text>
                  <TextInput
                    style={styles.inlineInput}
                    placeholder={set.lastWorkoutWeight ? set.lastWorkoutWeight : '___'}
                    placeholderTextColor={set.lastWorkoutWeight ? colors.textTertiary : colors.textPlaceholder}
                    keyboardType="decimal-pad"
                    value={set.weight}
                    onChangeText={(value) =>
                      handleWeightChange(exerciseIndex, setIndex, value)
                    }
                    returnKeyType="next"
                    cursorColor={colors.primary}
                    selectionColor={colors.primary}
                    includeFontPadding={false}
                  />
                  <Text style={styles.setText}> {unitDisplay} x </Text>
                  <TextInput
                    style={styles.inlineInput}
                    placeholder={set.lastWorkoutReps ? set.lastWorkoutReps : '___'}
                    placeholderTextColor={set.lastWorkoutReps ? colors.textTertiary : colors.textPlaceholder}
                    keyboardType="number-pad"
                    value={set.reps}
                    onChangeText={(value) =>
                      handleRepsChange(exerciseIndex, setIndex, value)
                    }
                    returnKeyType="next"
                    cursorColor={colors.primary}
                    selectionColor={colors.primary}
                    includeFontPadding={false}
                  />
                  <Text style={styles.setText}> reps</Text>
                  {targetText && (
                    <Text style={styles.targetText}>{targetText}</Text>
                  )}
                  {setIndex === exercise.sets.length - 1 && exercise.sets.length > 1 && (
                    <TouchableOpacity
                      style={styles.deleteSetButton}
                      onPress={() => handleDeleteSet(exerciseIndex, setIndex)}
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
              )
            })}
            
            {/* Add Set Button */}
            <TouchableOpacity
              style={styles.addSetButton}
              onPress={() => handleAddSet(exerciseIndex)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.addSetText}>Add set</Text>
            </TouchableOpacity>
          </View>
        )
      })}
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
    exerciseTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 8,
    },
    exerciseName: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 24,
      flex: 1,
    },
    deleteExerciseButton: {
      marginLeft: 8,
      padding: 4,
    },
    targetText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
      lineHeight: 24,
    },
    setText: {
      fontSize: 17,
      color: colors.text,
      lineHeight: 24,
    },
    inlineInput: {
      minWidth: 50,
      paddingHorizontal: 8,
      paddingTop: 0,
      paddingBottom: 0,
      fontSize: 17,
      color: colors.text,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      textAlign: 'center',
    },
    inlineInputWithValue: {
      color: colors.textSecondary,
      fontWeight: '500',
    },
    deleteSetButton: {
      marginLeft: 8,
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
      color: colors.primary,
      marginLeft: 4,
      fontWeight: '500',
    },
    restTimerText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
  })
