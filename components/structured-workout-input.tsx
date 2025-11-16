import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import {
  WorkoutRoutineWithDetails,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Audio } from 'expo-av'
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

const resolveExerciseRestTarget = (exercise: ExerciseData): number | null => {
  const firstSetWithRest = exercise.sets.find(
    (set) => typeof set.targetRestSeconds === 'number' && set.targetRestSeconds > 0,
  )

  return firstSetWithRest?.targetRestSeconds ?? null
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
  const inputRefs = useRef<{ [key: string]: TextInput | null }>({})

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

  const [restTimerStarts, setRestTimerStarts] = useState<
    Record<string, number>
  >({})
  const [activeSetIndex, setActiveSetIndex] = useState<
    Record<string, number>
  >({})
  const [restTimerTick, setRestTimerTick] = useState(0)
  const [restReady, setRestReady] = useState<Record<string, boolean>>({})
  const [activeRestTargets, setActiveRestTargets] = useState<
    Record<string, number | null>
  >({})

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

useEffect(() => {
  setRestTimerStarts((prev) => {
    const activeIds = new Set(exercises.map((exercise) => exercise.id))
    const next = { ...prev }
    let changed = false

    Object.keys(next).forEach((id) => {
      if (!activeIds.has(id)) {
        delete next[id]
        changed = true
      }
    })

    return changed ? next : prev
  })
}, [exercises])

  useEffect(() => {
    setRestReady((prev) => {
      const activeIds = new Set(exercises.map((exercise) => exercise.id))
      const next = { ...prev }
      let changed = false

      Object.keys(next).forEach((id) => {
        if (!activeIds.has(id)) {
          delete next[id]
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
      setRestTimerTick((tick) => tick + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [restTimerStarts])

  useEffect(() => {
    setActiveRestTargets((prev) => {
      const next = { ...prev }
      let changed = false
      const activeIds = new Set(exercises.map((exercise) => exercise.id))

      Object.keys(next).forEach((id) => {
        if (!activeIds.has(id)) {
          delete next[id]
          changed = true
        }
      })

      return changed ? next : prev
    })

    setRestTimerStarts((prev) => {
      const next = { ...prev }
      let changed = false
      const activeIds = new Set(exercises.map((exercise) => exercise.id))

      Object.keys(next).forEach((id) => {
        if (!activeIds.has(id)) {
          delete next[id]
          changed = true
        }
      })

      return changed ? next : prev
    })

    setActiveSetIndex((prev) => {
      const next = { ...prev }
      let changed = false
      const activeIds = new Set(exercises.map((exercise) => exercise.id))

      Object.keys(next).forEach((id) => {
        if (!activeIds.has(id)) {
          delete next[id]
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [exercises])

  const getRestSeconds = useCallback(
    (exerciseId: string) => {
      const start = restTimerStarts[exerciseId]
      if (!start) return 0
      return Math.max(0, Math.floor((Date.now() - start) / 1000))
    },
    [restTimerStarts],
  )

  const playRestCompleteAlert = useCallback(async () => {
    // Two long vibrations pattern - like a stopwatch ending
    // First long vibration
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    }, 100)
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    }, 200)

    // Second long vibration after a pause
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    }, 500)
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    }, 600)
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    }, 700)

    // Play stopwatch-style completion sound - two quick beeps
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      })

      // First beep
      const { sound: sound1 } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
        { shouldPlay: true, volume: 1.0 },
      )

      // Second beep after short delay
      setTimeout(async () => {
        try {
          const { sound: sound2 } = await Audio.Sound.createAsync(
            { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
            { shouldPlay: true, volume: 1.0 },
          )

          sound2.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              void sound2.unloadAsync()
            }
          })
        } catch (e) {
          // Ignore second beep error
        }
      }, 200)

      // Unload first sound after playing
      sound1.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          void sound1.unloadAsync()
        }
      })
    } catch (error) {
      // If sound fails, just continue with haptics
      console.log('Sound not available, using haptics only')
    }
  }, [])

  const restartRestTimer = useCallback(
    (exerciseId: string, targetSeconds: number | null, setIndex: number) => {
      setRestTimerStarts((prev) => ({
        ...prev,
        [exerciseId]: Date.now(),
      }))

      setActiveRestTargets((prev) => ({
        ...prev,
        [exerciseId]: targetSeconds,
      }))

      setActiveSetIndex((prev) => ({
        ...prev,
        [exerciseId]: setIndex,
      }))

      setRestReady((prev) => {
        if (!(exerciseId in prev) || prev[exerciseId] === false) {
          return prev
        }
        return {
          ...prev,
          [exerciseId]: false,
        }
      })
    },
    [],
  )

  useEffect(() => {
    if (exercises.length === 0) {
      return
    }

    exercises.forEach((exercise) => {
      const activeTarget = activeRestTargets[exercise.id]

      if (!activeTarget) {
        if (restReady[exercise.id]) {
          setRestReady((prev) => {
            if (!prev[exercise.id]) {
              return prev
            }
            const next = { ...prev }
            delete next[exercise.id]
            return next
          })
        }
        return
      }

      const elapsed = getRestSeconds(exercise.id)
      const hasAlerted = restReady[exercise.id] ?? false

      if (elapsed >= activeTarget && !hasAlerted) {
        void playRestCompleteAlert()
        setRestReady((prev) => ({ ...prev, [exercise.id]: true }))
        setActiveRestTargets((prev) => ({
          ...prev,
          [exercise.id]: null,
        }))
      } else if (elapsed < activeTarget && hasAlerted) {
        setRestReady((prev) => {
          if (!prev[exercise.id]) {
            return prev
          }
          const next = { ...prev }
          next[exercise.id] = false
          return next
        })
      }
    })
  }, [
    activeRestTargets,
    exercises,
    getRestSeconds,
    playRestCompleteAlert,
    restReady,
    restTimerTick,
  ])

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

    // Start timer when user enters reps (goes from empty to having data)
    if (repsWasEmpty && repsNowHasData) {
      restartRestTimer(
        newExercises[exerciseIndex].id,
        set.targetRestSeconds ?? null,
        setIndex,
      )
    }

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
      targetRestSeconds: null,
    }

    exercise.sets.push(newSet)
    setExercises(newExercises)
    onDataChange(newExercises)
  }

  const handleDeleteSet = async (exerciseIndex: number, setIndex: number) => {
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

  const focusNextInput = (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps') => {
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

  return (
    <View style={styles.container}>
      {exercises.map((exercise, exerciseIndex) => {
        const restSeconds = getRestSeconds(exercise.id)
        const exerciseRestTargetSeconds =
          activeRestTargets[exercise.id] ?? resolveExerciseRestTarget(exercise)
        const isRestTimerReady =
          Boolean(exerciseRestTargetSeconds) && Boolean(restReady[exercise.id])

        return (
          <View key={exercise.id} style={styles.exerciseBlock}>
            {/* Exercise Name with delete button */}
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <TouchableOpacity
                style={styles.deleteExerciseButton}
                onPress={() => handleDeleteExercise(exerciseIndex)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color={colors.error} />
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

              // Check if this is the active set for the timer
              const isActiveSet = activeSetIndex[exercise.id] === setIndex
              const isTimerRunning = isActiveSet && restTimerStarts[exercise.id]
              const showTimer = set.targetRestSeconds // Always show if there's a target

              // Calculate remaining time (countdown)
              let displayTime = set.targetRestSeconds || 0
              let isAtZero = false

              if (isTimerRunning && set.targetRestSeconds) {
                const remaining = set.targetRestSeconds - restSeconds
                displayTime = Math.max(0, remaining) // Stop at 0, don't go negative
                isAtZero = remaining <= 0
              }

              return (
                <View key={setIndex} style={styles.setRow}>
                  <Text style={styles.setText}>Set {setIndex + 1}: </Text>
                  <TextInput
                    ref={(ref) => {
                      inputRefs.current[`${exerciseIndex}-${setIndex}-weight`] = ref
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
                    onSubmitEditing={() => focusNextInput(exerciseIndex, setIndex, 'weight')}
                    returnKeyType="next"
                    cursorColor={colors.primary}
                    selectionColor={colors.primary}
                    includeFontPadding={false}
                  />
                  <Text style={styles.setText}> {unitDisplay} x </Text>
                  <TextInput
                    ref={(ref) => {
                      inputRefs.current[`${exerciseIndex}-${setIndex}-reps`] = ref
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
                    onSubmitEditing={() => focusNextInput(exerciseIndex, setIndex, 'reps')}
                    returnKeyType="next"
                    cursorColor={colors.primary}
                    selectionColor={colors.primary}
                    includeFontPadding={false}
                  />
                  <Text style={styles.setText}> reps</Text>
                  {targetText && (
                    <Text style={styles.targetText}>{targetText}</Text>
                  )}
                  {showTimer && (
                    <View style={styles.timerContainer}>
                      <Text
                        style={[
                          styles.timerText,
                          isAtZero && styles.timerTextReady,
                        ]}
                      >
                        {formatRestDuration(displayTime)}
                      </Text>
                      {isAtZero && (
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={colors.primary}
                          style={styles.checkIcon}
                        />
                      )}
                    </View>
                  )}
                  <View style={styles.deleteSetButtonContainer}>
                    {setIndex === exercise.sets.length - 1 &&
                      exercise.sets.length > 1 && (
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
    exerciseName: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 24,
    },
    deleteExerciseButton: {
      marginLeft: 8,
      padding: 4,
    },
    timerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 'auto',
      gap: 4,
      minWidth: 80,
      justifyContent: 'flex-end',
    },
    timerText: {
      fontSize: 15,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
      fontWeight: '500',
    },
    timerTextReady: {
      color: colors.primary,
      fontWeight: '600',
    },
    timerTextOverTime: {
      color: '#FF6B35',
      fontWeight: '600',
    },
    timerTargetText: {
      fontSize: 14,
      color: colors.textTertiary,
      fontWeight: '400',
    },
    checkIcon: {
      marginLeft: 2,
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
      width: '100%',
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
    deleteSetButtonContainer: {
      width: 34,
      marginLeft: 8,
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
      color: colors.primary,
      marginLeft: 4,
      fontWeight: '500',
    },
  })
