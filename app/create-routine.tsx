import { ExerciseSearchModal } from '@/components/exercise-search-modal'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
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

export default function CreateRoutineScreen() {
  const { from, routineId } = useLocalSearchParams<{ from?: string; routineId?: string }>()
  const router = useRouter()
  const colors = useThemedColors()
  const { user } = useAuth()

  const isEditMode = !!routineId

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [routineName, setRoutineName] = useState('')
  const [routineNotes, setRoutineNotes] = useState('')
  const [exercises, setExercises] = useState<ExerciseTemplate[]>([])
  const [expandedExercises, setExpandedExercises] = useState<Set<number>>(
    new Set(),
  )
  const [exerciseSearchModalVisible, setExerciseSearchModalVisible] =
    useState(false)

  useEffect(() => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create routines')
      router.back()
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
          const templates: ExerciseTemplate[] = (routine.workout_routine_exercises || [])
            .sort((a, b) => a.order_index - b.order_index)
            .map((re) => {
              const sets = (re.sets || []).sort((a, b) => a.set_number - b.set_number)
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
          const name = workout.notes || workout.type || 'New Routine'
          setRoutineName(name)
          setRoutineNotes(workout.notes || '')

          // Build exercise templates
          const templates: ExerciseTemplate[] = workout.workout_exercises.map(
            (we) => ({
              exerciseId: we.exercise_id,
              exerciseName: we.exercise?.name || 'Exercise',
              sets: we.sets.map(() => ({ repsMin: '', repsMax: '' })),
              notes: we.notes,
            }),
          )
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
        const repsMin = set.repsMin.trim() ? parseInt(set.repsMin.trim(), 10) : null
        const repsMax = set.repsMax.trim() ? parseInt(set.repsMax.trim(), 10) : null

        // If both values are provided, min must be <= max
        if (repsMin !== null && repsMax !== null && repsMin > repsMax) {
          Alert.alert(
            'Invalid Rep Range',
            `${exercise.exerciseName}, Set ${j + 1}: Minimum reps (${repsMin}) cannot be greater than maximum reps (${repsMax}).`,
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
          (!isEditMode || r.id !== routineId)
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

      const { data: insertedExercises, error: exercisesError } = await supabase
        .from('workout_routine_exercises')
        .insert(routineExercises)
        .select()

      if (exercisesError) throw exercisesError

      // Insert routine sets with optional rep ranges
      const routineSets = exercises.flatMap((ex, exIndex) => {
        const routineExerciseId = insertedExercises[exIndex].id
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
        isEditMode ? 'Routine updated successfully!' : 'Routine created successfully!',
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
  }, [routineName, routineNotes, exercises, user, router, isEditMode, routineId])

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

          {/* Notes Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={routineNotes}
              onChangeText={setRoutineNotes}
              placeholder="Add any notes about this routine..."
              placeholderTextColor={colors.textPlaceholder}
              multiline
              numberOfLines={3}
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
              return (
                <View key={exerciseIndex} style={styles.exerciseCard}>
                  {/* Exercise Header */}
                  <TouchableOpacity
                    style={styles.exerciseHeader}
                    onPress={() => toggleExercise(exerciseIndex)}
                  >
                    <View style={styles.exerciseHeaderLeft}>
                      <Text style={styles.exerciseName}>
                        {exercise.exerciseName}
                      </Text>
                      <Text style={styles.setCount}>
                        {exercise.sets.length} sets
                      </Text>
                    </View>
                    <View style={styles.exerciseHeaderRight}>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation()
                          handleRemoveExercise(exerciseIndex)
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
                    </View>
                  </TouchableOpacity>

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
                              handleUpdateReps(
                                exerciseIndex,
                                setIndex,
                                'repsMin',
                                value,
                              )
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
                              handleUpdateReps(
                                exerciseIndex,
                                setIndex,
                                'repsMax',
                                value,
                              )
                            }
                            keyboardType="number-pad"
                            placeholder="--"
                            placeholderTextColor={colors.textPlaceholder}
                            maxLength={3}
                          />
                          <TouchableOpacity
                            onPress={() => handleRemoveSet(exerciseIndex, setIndex)}
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
                        onPress={() => handleAddSet(exerciseIndex)}
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
                </View>
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
    },
    exerciseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
    },
    exerciseHeaderLeft: {
      flex: 1,
    },
    exerciseHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    setCount: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    deleteExerciseButton: {
      padding: 4,
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
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: colors.backgroundLight,
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
