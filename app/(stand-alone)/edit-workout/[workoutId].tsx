import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useExerciseSelection } from '@/hooks/useExerciseSelection'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import {
  deleteWorkoutImage,
  uploadWorkoutImage,
} from '@/lib/utils/image-upload'
import { Exercise, WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// Constants
const IMAGE_QUALITY = 0.8
const IMAGE_FADE_DURATION = 200
const IMAGE_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images' as any,
  allowsEditing: false,
  quality: IMAGE_QUALITY,
}

export default function EditWorkoutScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>()
  const router = useRouter()
  const colors = useThemedColors()
  const { weightUnit, convertToPreferred, convertInputToKg } = useWeightUnits()
  const { user } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [workout, setWorkout] = useState<WorkoutSessionWithDetails | null>(null)
  const [editedTitle, setEditedTitle] = useState('')
  const [editedNotes, setEditedNotes] = useState('')
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(
    new Set(),
  )

  // Track edited sets: { setId: { reps, weight } } - store as strings to allow typing
  const [editedSets, setEditedSets] = useState<
    Record<string, { reps?: string; weight?: string }>
  >({})
  const [deletedSetIds, setDeletedSetIds] = useState<Set<string>>(new Set())
  const [deletedExerciseIds, setDeletedExerciseIds] = useState<Set<string>>(
    new Set(),
  )
  const [editedExercises, setEditedExercises] = useState<
    Record<string, string>
  >({}) // workoutExerciseId -> new exerciseId
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null,
  )
  const { registerCallback } = useExerciseSelection()

  // Image management states
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null)
  const [imageDeleted, setImageDeleted] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const imageOpacity = useRef(new Animated.Value(0)).current

  // Slide in view state
  const [shouldExit, setShouldExit] = useState(false)

  const handleExit = useCallback(() => {
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const handleImageSelected = useCallback(
    async (uri: string) => {
      if (!user) return

      try {
        setIsUploadingImage(true)
        const url = await uploadWorkoutImage(uri, user.id)
        imageOpacity.setValue(0)
        setEditedImageUrl(url)
        setImageDeleted(false)
      } catch (error) {
        console.error('Error uploading image:', error)
        Alert.alert(
          'Upload Failed',
          'Failed to upload image. Please try again.',
        )
      } finally {
        setIsUploadingImage(false)
      }
    },
    [user, imageOpacity],
  )

  const launchLibrary = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (permission.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Photo library permission is required to select photos.',
      )
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync(
      IMAGE_PICKER_OPTIONS,
    )
    if (!result.canceled && result.assets[0]) {
      await handleImageSelected(result.assets[0].uri)
    }
  }, [handleImageSelected])

  const pickImage = useCallback(() => {
    // Directly launch library picker for editing
    launchLibrary()
  }, [launchLibrary])

  const handleDeleteImage = useCallback(() => {
    Alert.alert('Delete Photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          imageOpacity.setValue(0)
          setEditedImageUrl(null)
          setImageDeleted(true)
        },
      },
    ])
  }, [imageOpacity])

  const loadWorkout = useCallback(async () => {
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
      handleExit()
    } finally {
      setIsLoading(false)
    }
  }, [handleExit, workoutId])

  useEffect(() => {
    loadWorkout()
  }, [loadWorkout])

  const handleSelectExercise = useCallback(
    async (selectedExercise: Exercise, workoutExerciseId: string) => {
      try {
        // Update local state
        setEditedExercises((prev) => ({
          ...prev,
          [workoutExerciseId]: selectedExercise.id,
        }))

        // Update workout state optimistically
        setWorkout((prevWorkout) => {
          if (!prevWorkout) return prevWorkout

          return {
            ...prevWorkout,
            workout_exercises: prevWorkout.workout_exercises?.map((we) =>
              we.id === workoutExerciseId
                ? {
                    ...we,
                    exercise_id: selectedExercise.id,
                    exercise: selectedExercise,
                  }
                : we,
            ),
          }
        })

        setEditingExerciseId(null)
      } catch (error) {
        console.error('Error selecting exercise:', error)
        Alert.alert('Error', 'Failed to update exercise. Please try again.')
      }
    },
    [],
  )

  const handleEditExercise = useCallback(
    (workoutExerciseId: string) => {
      setEditingExerciseId(workoutExerciseId)

      // Register callback for when exercise is selected
      registerCallback((selectedExercise: Exercise) => {
        handleSelectExercise(selectedExercise, workoutExerciseId)
      })

      // Get current exercise name for highlighting
      const currentExercise = workout?.workout_exercises?.find(
        (we) => we.id === workoutExerciseId,
      )?.exercise

      // Navigate to select-exercise page
      router.push({
        pathname: '/select-exercise',
        params: {
          currentExerciseName: currentExercise?.name || '',
        },
      })
    },
    [registerCallback, handleSelectExercise, workout, router],
  )

  const handleSave = useCallback(async () => {
    if (!workoutId) return

    try {
      setIsSaving(true)

      // 1. Update workout session (title, notes, and image)
      const updates: Record<string, any> = {}

      const titleValue = editedTitle.trim()
      const notesValue = editedNotes.trim()

      // Always update title and notes (including setting to null if cleared)
      updates.type = titleValue || null
      updates.notes = notesValue || null

      // Handle image updates - explicitly set to null if deleted
      if (imageDeleted) {
        updates.image_url = null
      } else if (editedImageUrl) {
        updates.image_url = editedImageUrl
      }

      await database.workoutSessions.update(workoutId, updates)

      // Delete old image from storage if it was replaced or deleted
      if (
        workout?.image_url &&
        (imageDeleted ||
          (editedImageUrl && editedImageUrl !== workout.image_url))
      ) {
        await deleteWorkoutImage(workout.image_url)
      }

      // 2. Delete exercises (and their sets will cascade delete)
      const deleteExercisePromises = Array.from(deletedExerciseIds).map((id) =>
        database.workoutExercises.delete(id),
      )
      await Promise.all(deleteExercisePromises)

      // 3. Delete sets
      const deleteSetPromises = Array.from(deletedSetIds).map((id) =>
        database.sets.delete(id),
      )
      await Promise.all(deleteSetPromises)

      // 4. Update edited exercises
      const updateExercisePromises = Object.entries(editedExercises).map(
        ([workoutExerciseId, newExerciseId]) => {
          // Only update if the exercise hasn't been deleted
          if (!deletedExerciseIds.has(workoutExerciseId)) {
            return database.workoutExercises.update(
              workoutExerciseId,
              newExerciseId,
            )
          }
          return Promise.resolve()
        },
      )
      await Promise.all(updateExercisePromises)

      // 5. Update edited sets
      const updateSetPromises = Object.entries(editedSets).map(
        ([setId, values]) => {
          // Only update if the set hasn't been deleted
          if (!deletedSetIds.has(setId)) {
            const updates: { reps?: number; weight?: number | null } = {}

            // Parse reps if it was edited
            if (values.reps !== undefined) {
              const parsed = values.reps.trim()
              if (parsed === '') {
                updates.reps = undefined
              } else {
                const reps = parseFloat(parsed)
                if (!isNaN(reps)) {
                  updates.reps = reps
                }
              }
            }

            // Parse weight if it was edited
            if (values.weight !== undefined) {
              const weight =
                values.weight === '' ? null : parseFloat(values.weight)
              if (weight === null || !isNaN(weight)) {
                // Convert from preferred unit back to kg
                updates.weight =
                  weight !== null ? convertInputToKg(weight) : null
              }
            }

            // Only update if there are valid changes
            if (Object.keys(updates).length > 0) {
              return database.sets.update(setId, updates)
            }
          }
          return Promise.resolve()
        },
      )
      await Promise.all(updateSetPromises)

      handleExit()
    } catch (error) {
      console.error('Error saving workout:', error)
      Alert.alert('Error', 'Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [
    convertInputToKg,
    deletedExerciseIds,
    deletedSetIds,
    editedExercises,
    editedNotes,
    editedSets,
    editedTitle,
    editedImageUrl,
    imageDeleted,
    handleExit,
    workout,
    workoutId,
  ])

  const toggleExercise = useCallback((exerciseId: string) => {
    setExpandedExercises((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(exerciseId)) {
        newSet.delete(exerciseId)
      } else {
        newSet.add(exerciseId)
      }
      return newSet
    })
  }, [])

  const getSetValue = (
    setId: string,
    field: 'reps' | 'weight',
    originalValue: number | null,
  ): string => {
    // Check if this set has been edited
    if (editedSets[setId] && editedSets[setId][field] !== undefined) {
      return editedSets[setId][field] || ''
    }
    // Return original value as string, converting weight from kg to preferred unit
    if (field === 'weight' && originalValue !== null) {
      const converted = convertToPreferred(originalValue)
      return converted !== null
        ? converted.toFixed(weightUnit === 'kg' ? 1 : 0)
        : ''
    }
    return originalValue !== null ? String(originalValue) : ''
  }

  const updateSet = (
    setId: string,
    field: 'reps' | 'weight',
    value: string,
  ) => {
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
    // Smooth animation for set removal
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
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
            // Smooth animation for exercise removal
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
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
        (we) => we.id === workoutExerciseId,
      )

      if (!workoutExercise) return

      // Get active sets (not deleted)
      const activeSets =
        workoutExercise.sets?.filter((s) => !deletedSetIds.has(s.id)) || []

      // Calculate next set number
      const nextSetNumber = activeSets.length + 1

      // Use last set's values as defaults, or use sensible defaults
      const lastSet = activeSets[activeSets.length - 1]
      const defaultReps = lastSet?.reps ?? null
      const defaultWeight = lastSet?.weight || null

      // Create the new set
      const newSet = await database.sets.create(workoutExerciseId, {
        set_number: nextSetNumber,
        reps: defaultReps ?? undefined,
        weight: defaultWeight,
      })

      // Smooth animation for set addition
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)

      // Update local state instead of reloading
      setWorkout((prevWorkout) => {
        if (!prevWorkout) return prevWorkout

        return {
          ...prevWorkout,
          workout_exercises: prevWorkout.workout_exercises?.map((we) =>
            we.id === workoutExerciseId
              ? {
                  ...we,
                  sets: [...(we.sets || []), newSet],
                }
              : we,
          ),
        }
      })

      // Ensure the exercise is expanded
      setExpandedExercises((prev) => new Set(prev).add(workoutExerciseId))
    } catch (error) {
      console.error('Error adding set:', error)
      Alert.alert('Error', 'Failed to add set. Please try again.')
    }
  }

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

  if (!workout) {
    return null
  }

  return (
    <SlideInView
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
      style={styles.container}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => handleExit()}
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

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
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

            {/* Photo Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Photo</Text>
              {!imageDeleted && (editedImageUrl || workout.image_url) ? (
                <View style={styles.imageContainer}>
                  <View style={styles.imageWrapper}>
                    <Animated.Image
                      source={{
                        uri: editedImageUrl || workout.image_url || undefined,
                      }}
                      style={[styles.workoutImage, { opacity: imageOpacity }]}
                      resizeMode="cover"
                      onLoadStart={() => setImageLoading(true)}
                      onLoad={() => {
                        setImageLoading(false)
                        Animated.timing(imageOpacity, {
                          toValue: 1,
                          duration: IMAGE_FADE_DURATION,
                          useNativeDriver: true,
                        }).start()
                      }}
                      onError={(error) => {
                        console.error(
                          'Failed to load workout image:',
                          error.nativeEvent.error,
                        )
                        setImageLoading(false)
                      }}
                    />
                    {imageLoading && (
                      <View style={styles.imageLoadingOverlay}>
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.imageButtons}>
                    <TouchableOpacity
                      style={[styles.imageButton, styles.changeButton]}
                      onPress={pickImage}
                      disabled={isUploadingImage}
                    >
                      {isUploadingImage ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      ) : (
                        <>
                          <Ionicons
                            name="camera-outline"
                            size={18}
                            color={colors.primary}
                          />
                          <Text style={styles.changeButtonText}>
                            Change Photo
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.imageButton, styles.deleteButton]}
                      onPress={handleDeleteImage}
                      disabled={isUploadingImage}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.error}
                      />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={pickImage}
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons
                        name="camera-outline"
                        size={24}
                        color={colors.primary}
                      />
                      <Text style={styles.addPhotoText}>Add Photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Exercises Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Exercises</Text>
              {workout.workout_exercises
                ?.filter((we) => !deletedExerciseIds.has(we.id))
                .map((workoutExercise, index) => {
                  const isExpanded = expandedExercises.has(workoutExercise.id)
                  const activeSets = workoutExercise.sets?.filter(
                    (s) => !deletedSetIds.has(s.id),
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
                            onPress={(e) => {
                              e.stopPropagation()
                              handleEditExercise(workoutExercise.id)
                            }}
                            style={styles.editExerciseButton}
                          >
                            <Ionicons
                              name="create-outline"
                              size={18}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation()
                              deleteExercise(workoutExercise.id)
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
                            <Text style={styles.setHeaderText}>Set</Text>
                            <Text style={styles.setHeaderText}>Reps</Text>
                            <Text style={styles.setHeaderText}>
                              Weight ({weightUnit})
                            </Text>
                            <Text style={styles.setHeaderText}></Text>
                          </View>

                          {/* Sets Rows */}
                          {activeSets?.map((set, setIndex) => {
                            const repsValue = getSetValue(
                              set.id,
                              'reps',
                              set.reps,
                            )
                            const weightValue = getSetValue(
                              set.id,
                              'weight',
                              set.weight,
                            )

                            return (
                              <View key={set.id} style={styles.setRow}>
                                <Text style={styles.setNumber}>
                                  {setIndex + 1}
                                </Text>
                                <TextInput
                                  style={styles.setInput}
                                  value={repsValue}
                                  onChangeText={(val) =>
                                    updateSet(set.id, 'reps', val)
                                  }
                                  keyboardType="decimal-pad"
                                  placeholder="--"
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
    keyboardView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
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
      backgroundColor: colors.background,
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
    imageContainer: {
      backgroundColor: colors.white,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    imageWrapper: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: colors.backgroundLight,
    },
    workoutImage: {
      width: '100%',
      height: '100%',
    },
    imageLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
    },
    imageButtons: {
      flexDirection: 'row',
      padding: 12,
      gap: 12,
    },
    imageButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    changeButton: {
      backgroundColor: colors.backgroundLight,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    changeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    deleteButton: {
      backgroundColor: colors.backgroundLight,
      borderWidth: 1,
      borderColor: colors.error,
    },
    deleteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.error,
    },
    addPhotoButton: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      paddingVertical: 32,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    addPhotoText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
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
    editExerciseButton: {
      padding: 4,
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
