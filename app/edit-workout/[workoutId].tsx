import { useThemedColors } from '@/hooks/useThemedColors'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function EditWorkoutScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [workout, setWorkout] = useState<WorkoutSessionWithDetails | null>(null)
  const [editedTitle, setEditedTitle] = useState('')
  const [editedNotes, setEditedNotes] = useState('')
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(
    new Set(),
  )

  // Track edited sets: { setId: { reps, weight } } - store as strings to allow typing
  const [editedSets, setEditedSets] = useState<Record<string, { reps?: string; weight?: string }>>({})
  const [deletedSetIds, setDeletedSetIds] = useState<Set<string>>(new Set())
  const [deletedExerciseIds, setDeletedExerciseIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadWorkout()
  }, [workoutId])

  const loadWorkout = async () => {
    if (!workoutId) return

    try {
      setIsLoading(true)
      const data = await database.workoutSessions.getById(workoutId)
      setWorkout(data)
      setEditedTitle(data.type || '')
      setEditedNotes(data.notes || '')
    } catch (error) {
      console.error('Error loading workout:', error)
      Alert.alert('Error', 'Failed to load workout')
      router.back()
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!workoutId) return

    try {
      setIsSaving(true)

      // 1. Update workout session (title and notes)
      await database.workoutSessions.update(workoutId, {
        type: editedTitle.trim() || undefined,
        notes: editedNotes.trim() || undefined,
      })

      // 2. Delete exercises (and their sets will cascade delete)
      const deleteExercisePromises = Array.from(deletedExerciseIds).map((id) =>
        database.workoutExercises.delete(id)
      )
      await Promise.all(deleteExercisePromises)

      // 3. Delete sets
      const deleteSetPromises = Array.from(deletedSetIds).map((id) =>
        database.sets.delete(id)
      )
      await Promise.all(deleteSetPromises)

      // 4. Update edited sets
      const updateSetPromises = Object.entries(editedSets).map(([setId, values]) => {
        // Only update if the set hasn't been deleted
        if (!deletedSetIds.has(setId)) {
          const updates: { reps?: number; weight?: number | null } = {}

          // Parse reps if it was edited
          if (values.reps !== undefined) {
            const reps = values.reps === '' ? 0 : parseFloat(values.reps)
            if (!isNaN(reps)) {
              updates.reps = reps
            }
          }

          // Parse weight if it was edited
          if (values.weight !== undefined) {
            const weight = values.weight === '' ? null : parseFloat(values.weight)
            if (weight === null || !isNaN(weight)) {
              updates.weight = weight
            }
          }

          // Only update if there are valid changes
          if (Object.keys(updates).length > 0) {
            return database.sets.update(setId, updates)
          }
        }
        return Promise.resolve()
      })
      await Promise.all(updateSetPromises)

      router.back()
    } catch (error) {
      console.error('Error saving workout:', error)
      Alert.alert('Error', 'Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleExercise = (exerciseId: string) => {
    setExpandedExercises((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(exerciseId)) {
        newSet.delete(exerciseId)
      } else {
        newSet.add(exerciseId)
      }
      return newSet
    })
  }

  const getSetValue = (setId: string, field: 'reps' | 'weight', originalValue: number | null): string => {
    // Check if this set has been edited
    if (editedSets[setId] && editedSets[setId][field] !== undefined) {
      return editedSets[setId][field] || ''
    }
    // Return original value as string
    return originalValue !== null ? String(originalValue) : ''
  }

  const updateSet = (setId: string, field: 'reps' | 'weight', value: string) => {
    setEditedSets((prev) => {
      const currentSet = prev[setId] || {}

      return {
        ...prev,
        [setId]: {
          ...currentSet,
          [field]: value, // Store the raw string value
        },
      }
    })
  }

  const deleteSet = (setId: string) => {
    setDeletedSetIds((prev) => new Set(prev).add(setId))
  }

  const deleteExercise = (exerciseId: string) => {
    Alert.alert(
      'Delete Exercise',
      'Are you sure you want to delete this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeletedExerciseIds((prev) => new Set(prev).add(exerciseId))
          },
        },
      ],
    )
  }

  const addSet = async (workoutExerciseId: string) => {
    try {
      // Find the workout exercise
      const workoutExercise = workout?.workout_exercises?.find(
        (we) => we.id === workoutExerciseId
      )

      if (!workoutExercise) return

      // Get active sets (not deleted)
      const activeSets = workoutExercise.sets?.filter(
        (s) => !deletedSetIds.has(s.id)
      ) || []

      // Calculate next set number
      const nextSetNumber = activeSets.length + 1

      // Use last set's values as defaults, or use sensible defaults
      const lastSet = activeSets[activeSets.length - 1]
      const defaultReps = lastSet?.reps || 8
      const defaultWeight = lastSet?.weight || null

      // Create the new set
      await database.sets.create(workoutExerciseId, {
        set_number: nextSetNumber,
        reps: defaultReps,
        weight: defaultWeight,
      })

      // Reload the workout to show the new set
      await loadWorkout()

      // Ensure the exercise is expanded
      setExpandedExercises((prev) => new Set(prev).add(workoutExerciseId))
    } catch (error) {
      console.error('Error adding set:', error)
      Alert.alert('Error', 'Failed to add set. Please try again.')
    }
  }

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

  if (!workout) {
    return null
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Workout</Text>
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
          {/* Title Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={editedTitle}
              onChangeText={setEditedTitle}
              placeholder="Workout Title"
              placeholderTextColor={colors.textPlaceholder}
              maxLength={50}
            />
          </View>

          {/* Notes Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editedNotes}
              onChangeText={setEditedNotes}
              placeholder="Workout notes..."
              placeholderTextColor={colors.textPlaceholder}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Exercises Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Exercises</Text>
            {workout.workout_exercises
              ?.filter((we) => !deletedExerciseIds.has(we.id))
              .map((workoutExercise, index) => {
                const isExpanded = expandedExercises.has(workoutExercise.id)
                const activeSets = workoutExercise.sets?.filter(
                  (s) => !deletedSetIds.has(s.id)
                )
                return (
                  <View key={workoutExercise.id} style={styles.exerciseCard}>
                    {/* Exercise Header */}
                    <TouchableOpacity
                      style={styles.exerciseHeader}
                      onPress={() => toggleExercise(workoutExercise.id)}
                    >
                      <View style={styles.exerciseHeaderLeft}>
                        <Text style={styles.exerciseName}>
                          {workoutExercise.exercise?.name || 'Exercise'}
                        </Text>
                        <Text style={styles.setCount}>
                          {activeSets?.length || 0} sets
                        </Text>
                      </View>
                      <View style={styles.exerciseHeaderRight}>
                        <TouchableOpacity
                          onPress={() => deleteExercise(workoutExercise.id)}
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
                          <Text style={styles.setHeaderText}>Set</Text>
                          <Text style={styles.setHeaderText}>Reps</Text>
                          <Text style={styles.setHeaderText}>Weight (kg)</Text>
                          <Text style={styles.setHeaderText}></Text>
                        </View>

                        {/* Sets Rows */}
                        {activeSets?.map((set, setIndex) => {
                          const repsValue = getSetValue(set.id, 'reps', set.reps)
                          const weightValue = getSetValue(set.id, 'weight', set.weight)

                          return (
                            <View key={set.id} style={styles.setRow}>
                              <Text style={styles.setNumber}>{setIndex + 1}</Text>
                              <TextInput
                                style={styles.setInput}
                                value={repsValue}
                                onChangeText={(val) =>
                                  updateSet(set.id, 'reps', val)
                                }
                                keyboardType="number-pad"
                                placeholder="-"
                                placeholderTextColor={colors.textPlaceholder}
                              />
                              <TextInput
                                style={styles.setInput}
                                value={weightValue}
                                onChangeText={(val) =>
                                  updateSet(set.id, 'weight', val)
                                }
                                keyboardType="decimal-pad"
                                placeholder="BW"
                                placeholderTextColor={colors.textPlaceholder}
                              />
                              <TouchableOpacity
                                onPress={() => deleteSet(set.id)}
                                style={styles.deleteSetButton}
                              >
                                <Ionicons
                                  name="close-circle"
                                  size={20}
                                  color={colors.error}
                                />
                              </TouchableOpacity>
                            </View>
                          )
                        })}

                        {/* Add Set Button */}
                        <TouchableOpacity
                          style={styles.addSetButton}
                          onPress={() => addSet(workoutExercise.id)}
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
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
      padding: 16,
      fontSize: 16,
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
    },
    setHeaderText: {
      flex: 1,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      textAlign: 'center',
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
  })
