import { BaseNavbar } from '@/components/base-navbar'
import { Paywall } from '@/components/paywall'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useExerciseSelection } from '@/hooks/useExerciseSelection'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Picker } from '@react-native-picker/picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  Image,
} from 'react-native'
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EXERCISE_IMAGE_URL } from '@/constants/assets'

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface SetTemplate {
  repsMin: string // Store as string to allow empty/partial input
  repsMax: string
  restSeconds: number | null // Store as total seconds, null if not set
}

interface ExerciseTemplate {
  exerciseId: string
  exerciseName: string
  sets: SetTemplate[]
  notes: string | null
}

interface ExerciseItemProps {
  exercise: ExerciseTemplate
  index: number
  isExpanded: boolean
  isDragging: boolean
  colors: any
  draggingScale: SharedValue<number>
  draggingOpacity: SharedValue<number>
  onToggle: (index: number) => void
  onRemove: (index: number) => void
  onAddSet: (index: number) => void
  onRemoveSet: (exerciseIndex: number, setIndex: number) => void
  onUpdateReps: (
    exerciseIndex: number,
    setIndex: number,
    field: 'repsMin' | 'repsMax',
    value: string,
  ) => void
  onOpenRestPicker: (exerciseIndex: number, setIndex: number) => void
  formatRestTime: (seconds: number | null) => string
  onLongPress: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onDrop: () => void
  styles: any
}

const ExerciseItem = React.memo((props: ExerciseItemProps) => {
  const {
    exercise,
    index,
    isExpanded,
    isDragging,
    colors,
    draggingScale,
    draggingOpacity,
    onToggle,
    onRemove,
    onAddSet,
    onRemoveSet,
    onUpdateReps,
    onOpenRestPicker,
    formatRestTime,
    onLongPress,
    onMoveUp,
    onMoveDown,
    onDrop,
    styles,
  } = props

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: isDragging ? draggingScale.value : 1 }],
    opacity: isDragging ? draggingOpacity.value : 1,
  }))

  return (
    <Animated.View
      style={[
        styles.exerciseCard,
        animatedCardStyle,
        isDragging && styles.exerciseCardDragging,
      ]}
    >
      {/* Exercise Header */}
      <TouchableOpacity
        style={styles.exerciseHeader}
        onPress={() => onToggle(index)}
        onLongPress={() => onLongPress(index)}
        delayLongPress={500}
        activeOpacity={0.7}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandle}>
          <Ionicons
            name="reorder-three"
            size={22}
            color={isDragging ? colors.primary : colors.textSecondary}
          />
        </View>

        <View
          style={[
            styles.exerciseHeaderLeft,
            isDragging && styles.exerciseHeaderLeftDragging,
          ]}
        >
          <Image
            source={{ uri: EXERCISE_IMAGE_URL }}
            style={styles.exerciseThumbnail}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text
              style={styles.exerciseName}
              numberOfLines={isDragging ? 1 : undefined}
              ellipsizeMode={isDragging ? 'tail' : undefined}
            >
              {exercise.exerciseName}
            </Text>
            <Text style={styles.setCount}>{exercise.sets.length} sets</Text>
          </View>
        </View>
        <View style={styles.exerciseHeaderRight}>
          {!isDragging && (
            <>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation()
                  onRemove(index)
                }}
                style={styles.deleteExerciseButton}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </>
          )}
        </View>
      </TouchableOpacity>

      {/* Minimal drag controls */}
      {isDragging && (
        <View style={styles.dragControls}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation()
              onMoveUp(index)
            }}
            style={styles.dragArrow}
            activeOpacity={0.5}
          >
            <Ionicons name="chevron-up" size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation()
              onMoveDown(index)
            }}
            style={styles.dragArrow}
            activeOpacity={0.5}
          >
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation()
              onDrop()
            }}
            style={styles.dragDone}
            activeOpacity={0.5}
          >
            <Ionicons name="checkmark" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* Sets (Expanded) */}
      {isExpanded && (
        <View style={styles.setsContainer}>
          {/* Sets Table Header */}
          <View style={styles.setsTableHeader}>
            <Text style={[styles.setHeaderText, styles.setHeaderNumber]}>
              Set
            </Text>
            <Text style={[styles.setHeaderText, styles.setHeaderInput]}>
              Min Reps
            </Text>
            <Text style={[styles.setHeaderText, styles.setHeaderInput]}>
              Max Reps
            </Text>
            <Text style={[styles.setHeaderText, styles.setHeaderRest]}>
              Rest (M:S)
            </Text>
            <Text style={[styles.setHeaderText, styles.setHeaderDelete]}></Text>
          </View>

          {/* Sets Rows */}
          {exercise.sets.map((set, setIndex) => (
            <View key={setIndex} style={styles.setRow}>
              <Text style={styles.setNumber}>{setIndex + 1}</Text>
              <TextInput
                style={styles.setInput}
                value={set.repsMin}
                onChangeText={(value) =>
                  onUpdateReps(index, setIndex, 'repsMin', value)
                }
                keyboardType="number-pad"
                placeholder="--"
                placeholderTextColor={colors.textPlaceholder}
                maxLength={3}
              />
              <TextInput
                style={styles.setInput}
                value={set.repsMax}
                onChangeText={(value) =>
                  onUpdateReps(index, setIndex, 'repsMax', value)
                }
                keyboardType="number-pad"
                placeholder="--"
                placeholderTextColor={colors.textPlaceholder}
                maxLength={3}
              />
              <TouchableOpacity
                onPress={() => onOpenRestPicker(index, setIndex)}
                style={styles.restInputButton}
              >
                <Text
                  style={[
                    styles.restInputText,
                    !set.restSeconds && styles.restInputTextPlaceholder,
                  ]}
                >
                  {set.restSeconds ? formatRestTime(set.restSeconds) : 'Rest'}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onRemoveSet(index, setIndex)}
                style={styles.deleteSetButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Set Button */}
          <TouchableOpacity
            style={styles.addSetButton}
            onPress={() => onAddSet(index)}
          >
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.addSetText}>Add Set</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  )
})

ExerciseItem.displayName = 'ExerciseItem'

export default function CreateRoutineScreen() {
  const { from, routineId } = useLocalSearchParams<{
    from?: string
    routineId?: string
  }>()
  const router = useRouter()
  const colors = useThemedColors()
  const { user } = useAuth()
  const { isProMember } = useSubscription()

  const isEditMode = !!routineId

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [routineName, setRoutineName] = useState('')
  const [routineNotes, setRoutineNotes] = useState('')
  const [exercises, setExercises] = useState<ExerciseTemplate[]>([])
  const [expandedExercises, setExpandedExercises] = useState<Set<number>>(
    new Set(),
  )
  const [restPickerVisible, setRestPickerVisible] = useState(false)
  const [restPickerExerciseIndex, setRestPickerExerciseIndex] = useState<
    number | null
  >(null)
  const [restPickerSetIndex, setRestPickerSetIndex] = useState<number | null>(
    null,
  )
  const [restPickerMinutes, setRestPickerMinutes] = useState(0)
  const [restPickerSeconds, setRestPickerSeconds] = useState(0)

  // Drag and drop state
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  // Shared values for animations
  const draggingScale = useSharedValue(1)
  const draggingOpacity = useSharedValue(1)

  // Slide in view state
  const [shouldExit, setShouldExit] = useState(false)

  const handleExit = useCallback(() => {
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  // Exercise selection hook
  const { registerCallback } = useExerciseSelection()

  // Helper: Format seconds to MM:SS display
  const formatRestTime = useCallback((seconds: number | null): string => {
    if (seconds === null || seconds === 0) return ''
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Calculate estimated duration dynamically
  const estimatedDuration = useMemo(() => {
    const DEFAULT_REST_SECONDS = 90
    const SET_EXECUTION_SECONDS = 45
    const EXERCISE_TRANSITION_SECONDS = 30

    const exerciseCount = exercises.length
    const setCount = exercises.reduce((sum, ex) => sum + ex.sets.length, 0)

    const totalRestSeconds = exercises.reduce((sum, ex) => {
      return (
        sum +
        ex.sets.reduce((setSum, set) => {
          return setSum + (set.restSeconds ?? DEFAULT_REST_SECONDS)
        }, 0)
      )
    }, 0)

    const totalSetExecutionSeconds = setCount * SET_EXECUTION_SECONDS
    const totalTransitionSeconds = exerciseCount * EXERCISE_TRANSITION_SECONDS

    const estDurationSeconds =
      totalSetExecutionSeconds + totalRestSeconds + totalTransitionSeconds
    const estDurationMinutes = Math.ceil(estDurationSeconds / 60)
    const estDurationHours = Math.floor(estDurationMinutes / 60)
    const estDurationMinsRemainder = estDurationMinutes % 60

    return estDurationHours > 0
      ? `${estDurationHours}h ${estDurationMinsRemainder}min`
      : `${estDurationMinutes}min`
  }, [exercises])

  useEffect(() => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create routines')
      handleExit()
      return
    }

    // Check if user has Pro membership for routines
    if (!isProMember && !isEditMode) {
      setShowPaywall(true)
      setIsLoading(false)
      return
    }

    // If editing existing routine, load it
    if (routineId) {
      const loadRoutine = async () => {
        try {
          const routine = await database.workoutRoutines.getById(routineId)

          setRoutineName(routine.name)
          setRoutineNotes(routine.notes || '')

          // Build exercise templates from routine exercises
          const templates: ExerciseTemplate[] = (
            routine.workout_routine_exercises || []
          )
            .sort((a, b) => a.order_index - b.order_index)
            .map((re) => {
              const sets = (re.sets || []).sort(
                (a, b) => a.set_number - b.set_number,
              )
              return {
                exerciseId: re.exercise_id,
                exerciseName: re.exercise?.name || 'Exercise',
                sets: sets.map((s) => ({
                  repsMin: s.reps_min?.toString() || '',
                  repsMax: s.reps_max?.toString() || '',
                  restSeconds: s.rest_seconds ?? null,
                })),
                notes: re.notes,
              }
            })
          setExercises(templates)
        } catch (error) {
          console.error('Error loading routine:', error)
          Alert.alert('Error', 'Failed to load routine')
          handleExit()
        } finally {
          setIsLoading(false)
        }
      }

      loadRoutine()
      return
    }

    // If creating from workout, load workout data
    if (from) {
      const loadWorkout = async () => {
        try {
          const workout = await database.workoutSessions.getById(from)

          // Pre-fill name with workout title/type
          const name =
            workout.type || workout.notes?.split('\n')[0] || 'New Routine'
          setRoutineName(name)
          setRoutineNotes(workout.notes || '')

          // Build exercise templates
          const templates: ExerciseTemplate[] = (
            workout.workout_exercises || []
          ).map((we) => ({
            exerciseId: we.exercise_id,
            exerciseName: we.exercise?.name || 'Exercise',
            sets: (we.sets || []).map(() => ({
              repsMin: '',
              repsMax: '',
              restSeconds: null,
            })),
            notes: we.notes,
          }))
          setExercises(templates)
        } catch (error) {
          console.error('Error loading workout:', error)
          Alert.alert('Error', 'Failed to load workout')
          handleExit()
        } finally {
          setIsLoading(false)
        }
      }

      loadWorkout()
      return
    }

    // Otherwise start with empty routine
    setIsLoading(false)
  }, [from, routineId, user, router, isProMember, isEditMode, handleExit])

  const handleSave = useCallback(async () => {
    if (!routineName.trim()) {
      Alert.alert('Missing Name', 'Please enter a name for your routine')
      return
    }

    if (exercises.length === 0) {
      Alert.alert('No Exercises', 'Please add at least one exercise')
      return
    }

    // Validate rep ranges
    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i]
      for (let j = 0; j < exercise.sets.length; j++) {
        const set = exercise.sets[j]
        const repsMin = set.repsMin.trim()
          ? parseInt(set.repsMin.trim(), 10)
          : null
        const repsMax = set.repsMax.trim()
          ? parseInt(set.repsMax.trim(), 10)
          : null

        // If both values are provided, min must be <= max
        if (repsMin !== null && repsMax !== null && repsMin > repsMax) {
          Alert.alert(
            'Invalid Rep Range',
            `${exercise.exerciseName}, Set ${
              j + 1
            }: Minimum reps (${repsMin}) cannot be greater than maximum reps (${repsMax}).`,
          )
          return
        }
      }
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to save routines')
      return
    }

    // Check for duplicate routine name
    try {
      const existingRoutines = await database.workoutRoutines.getAll(user.id)
      const duplicateName = existingRoutines.find(
        (r) =>
          r.name.toLowerCase() === routineName.trim().toLowerCase() &&
          // When editing, exclude the current routine from the duplicate check
          (!isEditMode || r.id !== routineId),
      )

      if (duplicateName) {
        Alert.alert(
          'Duplicate Name',
          `You already have a routine named "${duplicateName.name}". Please choose a different name.`,
        )
        return
      }
    } catch (error) {
      console.error('Error checking for duplicate routine name:', error)
      // Continue with save even if duplicate check fails
    }

    setIsSaving(true)

    try {
      let routineIdToUse: string

      if (isEditMode && routineId) {
        // Update existing routine
        await database.workoutRoutines.update(routineId, {
          name: routineName.trim(),
          notes: routineNotes.trim() || undefined,
        })

        // Delete existing exercises and sets (cascade will handle sets)
        await supabase
          .from('workout_routine_exercises')
          .delete()
          .eq('routine_id', routineId)

        routineIdToUse = routineId
      } else {
        // Create new routine
        const routine = await database.workoutRoutines.create(
          user.id,
          routineName.trim(),
          routineNotes.trim() || undefined,
        )
        routineIdToUse = routine.id
      }

      // Insert routine exercises
      const routineExercises = exercises.map((ex, index) => ({
        routine_id: routineIdToUse,
        exercise_id: ex.exerciseId,
        order_index: index,
        notes: ex.notes,
      }))

      const {
        data: insertedExercises,
        error: exercisesError,
      } = await supabase
        .from('workout_routine_exercises')
        .insert(routineExercises)
        .select()

      if (exercisesError) throw exercisesError

      const insertedExerciseByOrder = new Map<number, string>()
      insertedExercises?.forEach((exercise: any) => {
        if (typeof exercise.order_index === 'number') {
          insertedExerciseByOrder.set(exercise.order_index, exercise.id)
        }
      })

      // Insert routine sets with optional rep ranges
      const routineSets = exercises.flatMap((ex, exIndex) => {
        const routineExerciseId = insertedExerciseByOrder.get(exIndex)
        if (!routineExerciseId) {
          console.warn('[create-routine] Missing routine exercise for index', {
            routineId: routineIdToUse,
            exerciseIndex: exIndex,
          })
          return []
        }
        return ex.sets.map((set, setIndex) => {
          const repsMin = set.repsMin.trim()
            ? parseInt(set.repsMin.trim(), 10)
            : null
          const repsMax = set.repsMax.trim()
            ? parseInt(set.repsMax.trim(), 10)
            : null

          // If only one value is provided, use it for both min and max
          const finalMin = repsMin ?? repsMax
          const finalMax = repsMax ?? repsMin

          const restSeconds = set.restSeconds

          // Validate rest seconds range
          if (restSeconds !== null && (restSeconds < 0 || restSeconds > 3600)) {
            throw new Error(
              `Rest time must be between 0 and 60 minutes (${
                ex.exerciseName
              }, Set ${setIndex + 1})`,
            )
          }

          return {
            routine_exercise_id: routineExerciseId,
            set_number: setIndex + 1,
            reps_min: finalMin,
            reps_max: finalMax,
            rest_seconds: restSeconds,
          }
        })
      })

      if (routineSets.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_routine_sets')
          .insert(routineSets)

        if (setsError) throw setsError
      }

      // If routine was created from an existing workout, link that workout to this routine
      // This ensures the workout will be found by getLastForRoutine() and shown as placeholders
      if (from && !isEditMode) {
        const { error: linkError } = await supabase
          .from('workout_sessions')
          .update({ routine_id: routineIdToUse })
          .eq('id', from)
          .eq('user_id', user.id)

        if (linkError) {
          console.error(
            '[create-routine] Failed to link workout to routine:',
            linkError,
          )
          // Don't throw - routine was created successfully, this is just a nice-to-have
        }
      }

      Alert.alert(
        'Success',
        isEditMode
          ? 'Routine updated successfully!'
          : 'Routine created successfully!',
        [
          {
            text: 'OK',
            onPress: () => handleExit(),
          },
        ],
      )
    } catch (error) {
      console.error('Error saving routine:', error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to save routine. Please try again.'
      Alert.alert('Error', errorMessage)
    } finally {
      setIsSaving(false)
    }
  }, [
    routineName,
    routineNotes,
    exercises,
    user,
    handleExit,
    isEditMode,
    routineId,
    from,
  ])

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Discard Changes?',
      'Are you sure you want to discard this routine?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => handleExit(),
        },
      ],
    )
  }, [handleExit])

  const toggleExercise = useCallback((index: number) => {
    setExpandedExercises((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }, [])

  const handleRemoveExercise = useCallback((index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExercises((prev) => prev.filter((_, i) => i !== index))
    // Also remove from expanded set
    setExpandedExercises((prev) => {
      const newSet = new Set(prev)
      newSet.delete(index)
      return newSet
    })
  }, [])

  const handleAddSet = useCallback((exerciseIndex: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExercises((prev) => {
      const updated = [...prev]
      updated[exerciseIndex] = {
        ...updated[exerciseIndex],
        sets: [
          ...updated[exerciseIndex].sets,
          { repsMin: '', repsMax: '', restSeconds: null },
        ],
      }
      return updated
    })
    // Ensure the exercise is expanded
    setExpandedExercises((prev) => new Set(prev).add(exerciseIndex))
  }, [])

  const handleRemoveSet = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setExercises((prev) => {
        const updated = [...prev]
        if (updated[exerciseIndex].sets.length <= 1) return prev // Keep at least 1 set
        updated[exerciseIndex] = {
          ...updated[exerciseIndex],
          sets: updated[exerciseIndex].sets.filter((_, i) => i !== setIndex),
        }
        return updated
      })
    },
    [],
  )

  const handleUpdateReps = useCallback(
    (
      exerciseIndex: number,
      setIndex: number,
      field: 'repsMin' | 'repsMax',
      value: string,
    ) => {
      // Only allow numbers
      if (value && !/^\d*$/.test(value)) return

      setExercises((prev) => {
        const updated = [...prev]
        const updatedSets = [...updated[exerciseIndex].sets]
        updatedSets[setIndex] = {
          ...updatedSets[setIndex],
          [field]: value,
        }
        updated[exerciseIndex] = {
          ...updated[exerciseIndex],
          sets: updatedSets,
        }
        return updated
      })
    },
    [],
  )

  const handleOpenRestPicker = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      const set = exercises[exerciseIndex]?.sets[setIndex]
      if (set?.restSeconds !== null && set?.restSeconds !== undefined) {
        const mins = Math.floor(set.restSeconds / 60)
        const secs = set.restSeconds % 60
        setRestPickerMinutes(mins)
        setRestPickerSeconds(secs)
      } else {
        setRestPickerMinutes(0)
        setRestPickerSeconds(0)
      }
      setRestPickerExerciseIndex(exerciseIndex)
      setRestPickerSetIndex(setIndex)
      setRestPickerVisible(true)
    },
    [exercises],
  )

  const handleConfirmRestPicker = useCallback(() => {
    if (restPickerExerciseIndex === null || restPickerSetIndex === null) {
      return
    }

    const totalSeconds = restPickerMinutes * 60 + restPickerSeconds

    setExercises((prev) => {
      const updated = [...prev]
      const updatedSets = [...updated[restPickerExerciseIndex!].sets]
      updatedSets[restPickerSetIndex!] = {
        ...updatedSets[restPickerSetIndex!],
        restSeconds: totalSeconds > 0 ? totalSeconds : null,
      }
      updated[restPickerExerciseIndex!] = {
        ...updated[restPickerExerciseIndex!],
        sets: updatedSets,
      }
      return updated
    })

    setRestPickerVisible(false)
    setRestPickerExerciseIndex(null)
    setRestPickerSetIndex(null)
  }, [
    restPickerExerciseIndex,
    restPickerSetIndex,
    restPickerMinutes,
    restPickerSeconds,
  ])

  const handleCancelRestPicker = useCallback(() => {
    setRestPickerVisible(false)
    setRestPickerExerciseIndex(null)
    setRestPickerSetIndex(null)
  }, [])

  const handleSelectExercise = useCallback((selectedExercise: Exercise) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExercises((prev) => [
      ...prev,
      {
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        sets: [{ repsMin: '', repsMax: '', restSeconds: null }], // Start with 1 set
        notes: null,
      },
    ])
  }, [])

  const handleAddExercise = useCallback(() => {
    // Register callback for when exercise is selected
    registerCallback(handleSelectExercise)

    // Navigate to select-exercise page
    router.push('/select-exercise')
  }, [registerCallback, handleSelectExercise, router])

  // Handle long press to start dragging
  const handleLongPress = useCallback(
    (index: number) => {
      console.log(`[Drag] LONG PRESS activated on exercise ${index}`)
      setDraggingIndex(index)
      draggingScale.value = withSpring(1.02, {
        damping: 15,
        stiffness: 150,
      })
      draggingOpacity.value = withTiming(0.95, {
        duration: 150,
        easing: Easing.inOut(Easing.ease),
      })
    },
    [draggingScale, draggingOpacity],
  )

  // Handle moving an exercise up
  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) {
      console.log(`[Drag] Already at top, cannot move up`)
      return
    }
    const newIndex = index - 1
    console.log(`[Drag] MOVE UP: exercise ${index} -> ${newIndex}`)
    setExercises((prev) => {
      const updated = [...prev]
      ;[updated[index - 1], updated[index]] = [
        updated[index],
        updated[index - 1],
      ]
      return updated
    })
    setDraggingIndex(newIndex)
  }, [])

  // Handle moving an exercise down
  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= exercises.length - 1) {
        console.log(`[Drag] Already at bottom, cannot move down`)
        return
      }
      const newIndex = index + 1
      console.log(`[Drag] MOVE DOWN: exercise ${index} -> ${newIndex}`)
      setExercises((prev) => {
        const updated = [...prev]
        ;[updated[index + 1], updated[index]] = [
          updated[index],
          updated[index + 1],
        ]
        return updated
      })
      setDraggingIndex(newIndex)
    },
    [exercises.length],
  )

  // Handle dropping/releasing
  const handleDropExercise = useCallback(() => {
    console.log(`[Drag] DROP completed`)
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

  const insets = useSafeAreaInsets()
  const styles = createStyles(colors)

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    )
  }

  return (
    <SlideInView
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
      style={styles.container}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <BaseNavbar
          leftContent={
            <>
              <TouchableOpacity
                onPress={handleCancel}
                style={styles.headerButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {isEditMode ? 'Edit Routine' : 'Create Routine'}
              </Text>
            </>
          }
          rightContent={
            <TouchableOpacity
              onPress={handleSave}
              style={styles.headerButton}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          }
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Name Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Routine Name</Text>
              <TextInput
                style={styles.input}
                value={routineName}
                onChangeText={setRoutineName}
                placeholder="e.g., Push Day, Upper Body, etc."
                placeholderTextColor={colors.textPlaceholder}
                autoCapitalize="words"
              />
              {/* Estimated Duration */}
              {exercises.length > 0 && (
                <View style={styles.durationContainer}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.durationText}>
                    Est. Duration: {estimatedDuration}
                  </Text>
                </View>
              )}
            </View>

            {/* Notes Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={routineNotes}
                onChangeText={setRoutineNotes}
                placeholder="Add any notes or description about this routine..."
                placeholderTextColor={colors.textPlaceholder}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Exercises */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Exercises</Text>
              </View>
              {exercises.map((exercise, exerciseIndex) => {
                const isExpanded = expandedExercises.has(exerciseIndex)
                const isDragging = draggingIndex === exerciseIndex

                return (
                  <ExerciseItem
                    key={exerciseIndex}
                    exercise={exercise}
                    index={exerciseIndex}
                    isExpanded={isExpanded}
                    isDragging={isDragging}
                    colors={colors}
                    draggingScale={draggingScale}
                    draggingOpacity={draggingOpacity}
                    onToggle={toggleExercise}
                    onRemove={handleRemoveExercise}
                    onAddSet={handleAddSet}
                    onRemoveSet={handleRemoveSet}
                    onUpdateReps={handleUpdateReps}
                    onOpenRestPicker={handleOpenRestPicker}
                    formatRestTime={formatRestTime}
                    onLongPress={handleLongPress}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onDrop={handleDropExercise}
                    styles={styles}
                  />
                )
              })}

              {/* Add Exercise Button */}
              <TouchableOpacity
                style={styles.addExerciseButton}
                onPress={handleAddExercise}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={24}
                  color={colors.primary}
                />
                <Text style={styles.addExerciseText}>Add Exercise</Text>
              </TouchableOpacity>

              {/* Empty State */}
              {exercises.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="barbell-outline"
                    size={48}
                    color={colors.textPlaceholder}
                  />
                  <Text style={styles.emptyTitle}>No Exercises Yet</Text>
                  <Text style={styles.emptyMessage}>
                    Tap &quot;Add Exercise&quot; to build your routine
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Paywall Modal */}
        <Paywall
          visible={showPaywall}
          onClose={() => {
            setShowPaywall(false)
            handleExit()
          }}
          title="Try Pro for FREE!"
          message="Routines are a Pro feature"
        />

        {/* Rest Time Picker Modal */}
        <Modal
          visible={restPickerVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={handleCancelRestPicker}
        >
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerModalHeader}>
                <TouchableOpacity
                  onPress={handleCancelRestPicker}
                  style={styles.pickerModalButton}
                >
                  <Text style={styles.pickerModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerModalTitle}>Rest Time</Text>
                <TouchableOpacity
                  onPress={handleConfirmRestPicker}
                  style={styles.pickerModalButton}
                >
                  <Text style={styles.pickerModalConfirmText}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>Minutes</Text>
                  <Picker
                    selectedValue={restPickerMinutes}
                    onValueChange={(itemValue) =>
                      setRestPickerMinutes(itemValue)
                    }
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {Array.from({ length: 61 }, (_, i) => i).map((min) => (
                      <Picker.Item
                        key={min}
                        label={min.toString()}
                        value={min}
                      />
                    ))}
                  </Picker>
                </View>
                <View style={styles.pickerDivider} />
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>Seconds</Text>
                  <Picker
                    selectedValue={restPickerSeconds}
                    onValueChange={(itemValue) =>
                      setRestPickerSeconds(itemValue)
                    }
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {Array.from({ length: 60 }, (_, i) => i).map((sec) => (
                      <Picker.Item
                        key={sec}
                        label={sec.toString().padStart(2, '0')}
                        value={sec}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SlideInView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.white,
    },
    flex: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    headerButton: {
      zIndex: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
      pointerEvents: 'none',
    },
    cancelText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    saveText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'right',
    },
    content: {
      flex: 1,
      backgroundColor: colors.background,
    },
    section: {
      padding: 16,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.white,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 16,
      lineHeight: 20,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    durationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      gap: 6,
    },
    durationText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    exerciseCard: {
      backgroundColor: colors.white,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    exerciseCardDragging: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    exerciseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
    },
    dragHandle: {
      paddingLeft: 8,
      paddingRight: 16,
      paddingVertical: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    exerciseHeaderLeft: {
      flex: 1,
      marginRight: 12,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
    },
    exerciseThumbnail: {
      width: 40,
      height: 40,
      marginRight: 12,
      borderRadius: 4,
    },
    exerciseHeaderLeftDragging: {
      marginRight: 120,
    },
    exerciseHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
      flexShrink: 1,
    },
    setCount: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    deleteExerciseButton: {
      padding: 4,
    },
    dragControls: {
      position: 'absolute',
      right: 12,
      top: 16,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dragArrow: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
    },
    dragDone: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      marginLeft: 2,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
      paddingLeft: 4,
    },
    setsContainer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 16,
      paddingTop: 12,
    },
    setsTableHeader: {
      flexDirection: 'row',
      marginBottom: 8,
      gap: 8,
    },
    setHeaderText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    setHeaderNumber: {
      width: 40,
    },
    setHeaderInput: {
      flex: 1,
    },
    setHeaderRest: {
      width: 100,
    },
    setHeaderDelete: {
      width: 30,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    setNumber: {
      width: 40,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    setInput: {
      flex: 1,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
      padding: 10,
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    restInputButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: 100,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    restInputText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    restInputTextPlaceholder: {
      color: colors.textPlaceholder,
      fontWeight: '400',
    },
    pickerModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    pickerModalContent: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    pickerModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerModalButton: {
      minWidth: 60,
    },
    pickerModalCancelText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    pickerModalTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    pickerModalConfirmText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'right',
    },
    pickerContainer: {
      flexDirection: 'row',
      height: 220,
      paddingHorizontal: 20,
      paddingVertical: 16,
      alignItems: 'center',
    },
    pickerColumn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      minWidth: 0,
    },
    pickerDivider: {
      width: 1,
      backgroundColor: colors.border,
      marginHorizontal: 12,
      height: 180,
      alignSelf: 'center',
    },
    pickerLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    picker: {
      width: '100%',
      height: 180,
      maxWidth: '100%',
    },
    pickerItem: {
      fontSize: 22,
      color: colors.text,
      fontWeight: '500',
    },
    deleteSetButton: {
      width: 30,
      alignItems: 'center',
    },
    addSetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      marginTop: 8,
    },
    addSetText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    addExerciseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 12,
    },
    addExerciseText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyMessage: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  })
