import { ExerciseSearchModal } from '@/components/exercise-search-modal'
import { Paywall } from '@/components/paywall'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

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
  draggingScale: Animated.SharedValue<number>
  draggingOpacity: Animated.SharedValue<number>
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
            <Text
              style={styles.exerciseName}
              numberOfLines={isDragging ? 1 : undefined}
              ellipsizeMode={isDragging ? 'tail' : undefined}
            >
              {exercise.exerciseName}
            </Text>
            <Text style={styles.setCount}>{exercise.sets.length} sets</Text>
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
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.error}
                  />
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
              <Text style={[styles.setHeaderText, styles.setHeaderDelete]}>
              </Text>
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
                  onPress={() => onRemoveSet(index, setIndex)}
                  style={styles.deleteSetButton}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.error}
                  />
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
  const [exerciseSearchModalVisible, setExerciseSearchModalVisible] = useState(
    false,
  )

  // Drag and drop state
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  // Shared values for animations
  const draggingScale = useSharedValue(1)
  const draggingOpacity = useSharedValue(1)

  useEffect(() => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create routines')
      router.back()
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
                })),
                notes: re.notes,
              }
            })
          setExercises(templates)
        } catch (error) {
          console.error('Error loading routine:', error)
          Alert.alert('Error', 'Failed to load routine')
          router.back()
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
          const name = workout.type || workout.notes?.split('\n')[0] || 'New Routine'
          setRoutineName(name)
          setRoutineNotes(workout.notes || '')

          // Build exercise templates
          const templates: ExerciseTemplate[] = (
            workout.workout_exercises || []
          ).map((we) => ({
            exerciseId: we.exercise_id,
            exerciseName: we.exercise?.name || 'Exercise',
            sets: (we.sets || []).map(() => ({ repsMin: '', repsMax: '' })),
            notes: we.notes,
          }))
          setExercises(templates)
        } catch (error) {
          console.error('Error loading workout:', error)
          Alert.alert('Error', 'Failed to load workout')
          router.back()
        } finally {
          setIsLoading(false)
        }
      }

      loadWorkout()
      return
    }

    // Otherwise start with empty routine
    setIsLoading(false)
  }, [from, routineId, user, router])

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

          return {
            routine_exercise_id: routineExerciseId,
            set_number: setIndex + 1,
            reps_min: finalMin,
            reps_max: finalMax,
          }
        })
      })

      if (routineSets.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_routine_sets')
          .insert(routineSets)

        if (setsError) throw setsError
      }

      Alert.alert(
        'Success',
        isEditMode
          ? 'Routine updated successfully!'
          : 'Routine created successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ],
      )
    } catch (error) {
      console.error('Error saving routine:', error)
      Alert.alert('Error', 'Failed to save routine. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [
    routineName,
    routineNotes,
    exercises,
    user,
    router,
    isEditMode,
    routineId,
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
          onPress: () => router.back(),
        },
      ],
    )
  }, [router])

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
        sets: [...updated[exerciseIndex].sets, { repsMin: '', repsMax: '' }],
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

  const handleAddExercise = useCallback(() => {
    setExerciseSearchModalVisible(true)
  }, [])

  const handleSelectExercise = useCallback((selectedExercise: Exercise) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExercises((prev) => [
      ...prev,
      {
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        sets: [{ repsMin: '', repsMax: '' }], // Start with 1 set
        notes: null,
      },
    ])
    setExerciseSearchModalVisible(false)
  }, [])

  // Handle long press to start dragging
  const handleLongPress = useCallback((index: number) => {
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
  }, [draggingScale, draggingOpacity])

  // Handle moving an exercise up
  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) {
        console.log(`[Drag] Already at top, cannot move up`)
        return
      }
      const newIndex = index - 1
      console.log(`[Drag] MOVE UP: exercise ${index} -> ${newIndex}`)
      setExercises((prev) => {
        const updated = [...prev]
        ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
        return updated
      })
      setDraggingIndex(newIndex)
    },
    [],
  )

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
        ;[updated[index + 1], updated[index]] = [updated[index], updated[index + 1]]
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

  const styles = createStyles(colors)

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? 'Edit Routine' : 'Create Routine'}
          </Text>
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
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                  Tap "Add Exercise" to build your routine
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Exercise Search Modal */}
      <ExerciseSearchModal
        visible={exerciseSearchModalVisible}
        onClose={() => setExerciseSearchModalVisible(false)}
        onSelectExercise={handleSelectExercise}
      />

      {/* Paywall Modal */}
      <Paywall
        visible={showPaywall}
        onClose={() => {
          setShowPaywall(false)
          router.back()
        }}
        title="Try Pro for FREE!"
        message="Routines are a Pro feature"
      />
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      minWidth: 60,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
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
    },
    section: {
      padding: 16,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
