import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { SlideInView } from '@/components/slide-in-view'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useExerciseSelection } from '@/hooks/useExerciseSelection'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database, OwnershipError } from '@/lib/database'
import { haptic } from '@/lib/haptics'
import {
  deleteWorkoutImage,
  uploadWorkoutImage,
} from '@/lib/utils/image-upload'
import { calculateWorkoutStats, formatVolume } from '@/lib/utils/workout-stats'
import { Exercise, WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
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
} from 'react-native'
import AnimatedReanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
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

function formatDurationCompact(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}min`
}

export default function EditWorkoutScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>()
  const router = useRouter()
  const colors = useThemedColors()
  const { weightUnit, convertToPreferred, convertInputToKg } = useWeightUnits()
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()

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
  const [, setEditingExerciseId] = useState<string | null>(null)
  const [, setIsAddingExercise] = useState(false)
  const { registerCallback } = useExerciseSelection()

  // Image management states
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null)
  const [imageDeleted, setImageDeleted] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const imageOpacity = useRef(new Animated.Value(0)).current

  // Date editing states
  const [editedDate, setEditedDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Duration editing states (stored in seconds, edited as h:m:s)
  const [editedDurationHours, setEditedDurationHours] = useState('')
  const [editedDurationMinutes, setEditedDurationMinutes] = useState('')
  const [editedDurationSeconds, setEditedDurationSeconds] = useState('')

  // Drag and drop state
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const draggingScale = useSharedValue(1)
  const draggingOpacity = useSharedValue(1)

  // Slide in view state
  const [shouldExit, setShouldExit] = useState(false)

  const handleDragStart = useCallback(
    (index: number) => {
      setDraggingIndex(index)
      draggingScale.value = withSpring(1.02, {
        mass: 1,
        damping: 15,
        stiffness: 250,
      })
      draggingOpacity.value = withTiming(0.9, {
        duration: 150,
      })
      haptic('medium')
    },
    [draggingScale, draggingOpacity],
  )

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index > 0 && workout?.workout_exercises) {
        setWorkout((prev) => {
          if (!prev || !prev.workout_exercises) return prev

          const newExercises = [...prev.workout_exercises]
          const temp = newExercises[index]
          newExercises[index] = newExercises[index - 1]
          newExercises[index - 1] = temp

          // Update order_index
          newExercises.forEach((ex, i) => {
            ex.order_index = i
          })

          return {
            ...prev,
            workout_exercises: newExercises,
          }
        })
        setDraggingIndex(index - 1)
        haptic('light')
      }
    },
    [workout],
  )

  const handleMoveDown = useCallback(
    (index: number) => {
      if (
        workout?.workout_exercises &&
        index < workout.workout_exercises.length - 1
      ) {
        setWorkout((prev) => {
          if (!prev || !prev.workout_exercises) return prev

          const newExercises = [...prev.workout_exercises]
          const temp = newExercises[index]
          newExercises[index] = newExercises[index + 1]
          newExercises[index + 1] = temp

          // Update order_index
          newExercises.forEach((ex, i) => {
            ex.order_index = i
          })

          return {
            ...prev,
            workout_exercises: newExercises,
          }
        })
        setDraggingIndex(index + 1)
        haptic('light')
      }
    },
    [workout],
  )

  const handleDragEnd = useCallback(() => {
    draggingScale.value = withSpring(1, {
      mass: 1,
      damping: 15,
      stiffness: 250,
    })
    draggingOpacity.value = withTiming(1, {
      duration: 150,
    })
    setDraggingIndex(null)
    haptic('medium')
  }, [draggingScale, draggingOpacity])

  const dragAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: draggingScale.value }],
    opacity: draggingOpacity.value,
  }))

  const handleExit = useCallback(() => {
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const handleOwnershipViolation = useCallback(
    (message = 'You can only edit your own workouts.') => {
      Alert.alert('Access denied', message, [
        {
          text: 'OK',
          onPress: handleExit,
        },
      ])
    },
    [handleExit],
  )

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
      if (!user?.id) {
        handleOwnershipViolation()
        return
      }

      const data = await database.workoutSessions.getOwnedById(
        workoutId,
        user.id,
      )
      setWorkout(data)
      setEditedTitle(data.type || '')
      setEditedNotes(data.notes || '')

      // Expand all exercises by default
      if (data.workout_exercises) {
        setExpandedExercises(new Set(data.workout_exercises.map((we) => we.id)))
      }

      // Initialize edited date from workout date
      if (data.date) {
        setEditedDate(new Date(data.date))
      }
      // Initialize duration from workout
      if (data.duration !== null && data.duration !== undefined) {
        const totalSeconds = Math.max(0, Math.floor(data.duration))
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60
        setEditedDurationHours(hours > 0 ? String(hours) : '')
        setEditedDurationMinutes(String(minutes))
        setEditedDurationSeconds(String(seconds))
      }
    } catch (error) {
      console.error('Error loading workout:', error)
      if (error instanceof OwnershipError) {
        handleOwnershipViolation(error.message)
        return
      }
      Alert.alert('Error', 'Failed to load workout')
      handleExit()
    } finally {
      setIsLoading(false)
    }
  }, [handleExit, handleOwnershipViolation, user?.id, workoutId])

  // Date picker handlers
  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false)
      }
      if (event.type === 'set' && selectedDate) {
        setEditedDate(selectedDate)
      }
    },
    [],
  )

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDisplayTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  useEffect(() => {
    loadWorkout()
  }, [loadWorkout])

  useEffect(() => {
    if (workoutId) {
      trackEvent(AnalyticsEvents.EDIT_WORKOUT_VIEWED, { workout_id: workoutId })
    }
  }, [workoutId, trackEvent])

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
      registerCallback((selectedExercise: Exercise | Exercise[]) => {
        const exercise = Array.isArray(selectedExercise)
          ? selectedExercise[0]
          : selectedExercise
        if (exercise) {
          handleSelectExercise(exercise, workoutExerciseId)
        }
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

  const handleAddNewExercise = useCallback(
    async (selectedExercise: Exercise) => {
      if (!workout || !workoutId) return
      if (!user?.id || workout.user_id !== user.id) {
        handleOwnershipViolation()
        return
      }

      try {
        // Calculate the next order index
        const activeExercises = workout.workout_exercises?.filter(
          (we) => !deletedExerciseIds.has(we.id),
        )
        const nextOrderIndex = activeExercises?.length || 0

        // Create the new workout exercise in the database
        const newWorkoutExercise = await database.workoutExercises.create(
          workoutId,
          selectedExercise.id,
          nextOrderIndex,
        )

        // Smooth animation for exercise addition
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)

        // Update local state
        setWorkout((prevWorkout) => {
          if (!prevWorkout) return prevWorkout

          return {
            ...prevWorkout,
            workout_exercises: [
              ...(prevWorkout.workout_exercises || []),
              {
                ...newWorkoutExercise,
                exercise: selectedExercise,
                sets: newWorkoutExercise.sets || [],
              },
            ],
          }
        })

        // Expand the newly added exercise
        setExpandedExercises((prev) => new Set(prev).add(newWorkoutExercise.id))
        setIsAddingExercise(false)
      } catch (error) {
        console.error('Error adding exercise:', error)
        Alert.alert('Error', 'Failed to add exercise. Please try again.')
        setIsAddingExercise(false)
      }
    },
    [
      deletedExerciseIds,
      handleOwnershipViolation,
      user?.id,
      workout,
      workoutId,
    ],
  )

  const handleAddExercise = useCallback(() => {
    if (!workout || !user?.id || workout.user_id !== user.id) {
      handleOwnershipViolation()
      return
    }

    setIsAddingExercise(true)

    // Register callback for when exercise is selected
    registerCallback((selectedExercise: Exercise | Exercise[]) => {
      if (Array.isArray(selectedExercise)) {
        selectedExercise.forEach((ex) => handleAddNewExercise(ex))
      } else {
        handleAddNewExercise(selectedExercise)
      }
    })

    // Navigate to select-exercise page
    router.push({
      pathname: '/select-exercise',
      params: {},
    })
  }, [
    handleAddNewExercise,
    handleOwnershipViolation,
    registerCallback,
    router,
    user?.id,
    workout,
  ])

  const handleSave = useCallback(async () => {
    if (!workoutId || !workout) return
    if (!user?.id || workout.user_id !== user.id) {
      handleOwnershipViolation()
      return
    }

    try {
      setIsSaving(true)

      // 1. Update workout session (title, notes, image, and date)
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

      // Handle date updates
      if (editedDate) {
        updates.date = editedDate.toISOString()
      }

      // Handle duration updates - calculate total seconds
      const hours = parseInt(editedDurationHours) || 0
      const minutes = parseInt(editedDurationMinutes) || 0
      const seconds = parseInt(editedDurationSeconds) || 0
      const totalDuration = hours * 3600 + minutes * 60 + seconds
      updates.duration = totalDuration > 0 ? totalDuration : null

      await database.workoutSessions.update(workoutId, user.id, updates)

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

      // 4.5 Update exercise order
      if (workout?.workout_exercises) {
        const orderPromises = workout.workout_exercises
          .filter((we) => !deletedExerciseIds.has(we.id))
          .map((we, index) => {
            // Update the order_index in the database
            return database.workoutExercises.updateOrder(we.id, index)
          })
        await Promise.all(orderPromises)
      }

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
      if (error instanceof OwnershipError) {
        handleOwnershipViolation(error.message)
        return
      }
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
    editedDate,
    editedDurationHours,
    editedDurationMinutes,
    editedDurationSeconds,
    handleOwnershipViolation,
    imageDeleted,
    handleExit,
    user?.id,
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
      if (!workout || !user?.id || workout.user_id !== user.id) {
        handleOwnershipViolation()
        return
      }

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
  const NAVBAR_HEIGHT = 76
  const styles = createStyles(colors)

  const stats = workout ? calculateWorkoutStats(workout, weightUnit) : null
  const volumeFormatted = stats
    ? formatVolume(stats.totalVolume, weightUnit)
    : { value: 0, unit: weightUnit }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
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
      <View style={styles.container}>
        <BlurredHeader>
          <BaseNavbar
            leftContent={
              <NavbarIsland>
                <TouchableOpacity
                  onPress={() => handleExit()}
                  style={styles.headerButton}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </NavbarIsland>
            }
            centerContent={<Text style={styles.headerTitle}>Edit Workout</Text>}
            rightContent={
              <LiquidGlassSurface style={styles.saveButtonGlass}>
                <TouchableOpacity
                  onPress={handleSave}
                  style={styles.saveButtonTouchable}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.brandPrimary}
                    />
                  ) : (
                    <Ionicons
                      name="checkmark"
                      size={24}
                      color={colors.brandPrimary}
                    />
                  )}
                </TouchableOpacity>
              </LiquidGlassSurface>
            }
          />
        </BlurredHeader>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingTop: insets.top + NAVBAR_HEIGHT }}
            scrollIndicatorInsets={{ top: insets.top + NAVBAR_HEIGHT }}
            showsVerticalScrollIndicator={false}
          >
            {/* Title Section */}
            <View style={styles.titleSection}>
              <View style={styles.titleInputContainer}>
                <TextInput
                  style={styles.titleInput}
                  value={editedTitle}
                  onChangeText={setEditedTitle}
                  placeholder="Workout Title"
                  placeholderTextColor={colors.textPlaceholder}
                  maxLength={50}
                />
                {editedTitle.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setEditedTitle('')}
                    style={styles.clearTitleButton}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Stats Section */}
            {stats && (
              <View style={styles.statsSection}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Duration</Text>
                  <Text style={styles.statValue}>
                    {formatDurationCompact(stats.durationSeconds)}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Volume</Text>
                  <Text style={styles.statValue}>
                    {volumeFormatted.value.toLocaleString()}{' '}
                    {volumeFormatted.unit}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Sets</Text>
                  <Text style={styles.statValue}>{stats.totalSets}</Text>
                </View>
              </View>
            )}

            {/* Date Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabelSmall}>When</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateTextBlue}>
                  {editedDate
                    ? `${formatDisplayDate(editedDate)}, ${formatDisplayTime(
                        editedDate,
                      )}`
                    : 'Select date'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date Picker Modal (iOS) / Inline (Android) */}
            {Platform.OS === 'ios' ? (
              <Modal
                visible={showDatePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View style={styles.datePickerModalOverlay}>
                  <View style={styles.datePickerModalContent}>
                    <View style={styles.datePickerHeader}>
                      <TouchableOpacity
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.datePickerCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={styles.datePickerTitle}>Select Date</Text>
                      <TouchableOpacity
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.datePickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={editedDate || new Date()}
                      mode="datetime"
                      display="spinner"
                      onChange={handleDateChange}
                      maximumDate={new Date()}
                      textColor={colors.textPrimary}
                    />
                  </View>
                </View>
              </Modal>
            ) : (
              showDatePicker && (
                <DateTimePicker
                  value={editedDate || new Date()}
                  mode="datetime"
                  display="default"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                />
              )
            )}

            {/* Photo Section */}
            <View style={styles.section}>
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
                          color={colors.brandPrimary}
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
                          color={colors.brandPrimary}
                        />
                      ) : (
                        <>
                          <Ionicons
                            name="camera-outline"
                            size={18}
                            color={colors.brandPrimary}
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
                        color={colors.statusError}
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
                    <ActivityIndicator
                      size="small"
                      color={colors.brandPrimary}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="image-outline"
                        size={24}
                        color={colors.textPrimary}
                      />
                      <Text style={styles.addPhotoText}>Add a photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Description Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabelSmall}>Description</Text>
              <TextInput
                style={[styles.inputNoBorder, styles.textArea]}
                value={editedNotes}
                onChangeText={setEditedNotes}
                placeholder="How did your workout go? Leave some notes here..."
                placeholderTextColor={colors.textPlaceholder}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Exercises Section */}
            <View style={styles.section}>
              {workout.workout_exercises
                ?.filter((we) => !deletedExerciseIds.has(we.id))
                .map((workoutExercise, index) => {
                  const isExpanded = expandedExercises.has(workoutExercise.id)
                  const isDragging = draggingIndex === index
                  const activeSets = workoutExercise.sets?.filter(
                    (s) => !deletedSetIds.has(s.id),
                  )
                  return (
                    <AnimatedReanimated.View
                      key={workoutExercise.id}
                      style={[
                        styles.exerciseCard,
                        isDragging && dragAnimatedStyle,
                        isDragging && styles.exerciseCardDragging,
                      ]}
                    >
                      {/* Exercise Header */}
                      <TouchableOpacity
                        style={[
                          styles.exerciseHeader,
                          isDragging && styles.exerciseHeaderDragging,
                        ]}
                        onPress={() =>
                          !isDragging && toggleExercise(workoutExercise.id)
                        }
                        onLongPress={() => handleDragStart(index)}
                        delayLongPress={200}
                        activeOpacity={0.8}
                      >
                        <View style={styles.exerciseHeaderLeft}>
                          <ExerciseMediaThumbnail
                            gifUrl={workoutExercise.exercise?.gif_url}
                            style={styles.exerciseThumbnail}
                            isCustom={!!workoutExercise.exercise?.created_by}
                          />
                          <Text
                            style={styles.exerciseName}
                            numberOfLines={isDragging ? 1 : undefined}
                            ellipsizeMode={isDragging ? 'tail' : undefined}
                          >
                            {workoutExercise.exercise?.name || 'Exercise'}
                          </Text>
                        </View>
                        {!isDragging && (
                          <View style={styles.exerciseHeaderRight}>
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation()
                                // Show options menu for edit/delete
                                Alert.alert('Options', 'Select an action', [
                                  {
                                    text: 'Edit Exercise',
                                    onPress: () =>
                                      handleEditExercise(workoutExercise.id),
                                  },
                                  {
                                    text: 'Delete Exercise',
                                    onPress: () =>
                                      deleteExercise(workoutExercise.id),
                                    style: 'destructive',
                                  },
                                  { text: 'Cancel', style: 'cancel' },
                                ])
                              }}
                              style={styles.optionsButton}
                            >
                              <Ionicons
                                name="ellipsis-vertical"
                                size={20}
                                color={colors.textPrimary}
                              />
                            </TouchableOpacity>
                          </View>
                        )}

                        {isDragging && (
                          <View style={styles.dragControls}>
                            <TouchableOpacity
                              onPress={() => handleMoveUp(index)}
                              style={[
                                styles.dragArrow,
                                index === 0 && styles.dragArrowDisabled,
                              ]}
                              disabled={index === 0}
                            >
                              <Ionicons
                                name="chevron-up"
                                size={24}
                                color={
                                  index === 0
                                    ? colors.textPlaceholder
                                    : colors.textPrimary
                                }
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleMoveDown(index)}
                              style={[
                                styles.dragArrow,
                                index ===
                                  (workout.workout_exercises?.length || 0) -
                                    1 && styles.dragArrowDisabled,
                              ]}
                              disabled={
                                index ===
                                (workout.workout_exercises?.length || 0) - 1
                              }
                            >
                              <Ionicons
                                name="chevron-down"
                                size={24}
                                color={
                                  index ===
                                  (workout.workout_exercises?.length || 0) - 1
                                    ? colors.textPlaceholder
                                    : colors.textPrimary
                                }
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={handleDragEnd}
                              style={styles.dragDone}
                            >
                              <Ionicons
                                name="checkmark-circle"
                                size={28}
                                color={colors.brandPrimary}
                              />
                            </TouchableOpacity>
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Sets (Expanded) */}
                      {isExpanded && !isDragging && (
                        <View style={styles.setsContainer}>
                          {/* Sets Table Header */}
                          <View style={styles.setsTableHeader}>
                            <View style={styles.setHeaderSetCol}>
                              <Text style={styles.setHeaderText}>Set</Text>
                            </View>
                            <View style={styles.setHeaderInputCol}>
                              <Text style={styles.setHeaderText}>
                                Weight ({weightUnit})
                              </Text>
                            </View>
                            <View style={styles.setHeaderInputCol}>
                              <Text style={styles.setHeaderText}>Reps</Text>
                            </View>
                            <View style={styles.setHeaderDeleteCol} />
                          </View>

                          {/* Sets Rows */}
                          {(() => {
                            let workingSetNumber = 0
                            return (
                              activeSets?.map((set) => {
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

                                const isWarmup = set.is_warmup === true
                                if (!isWarmup) {
                                  workingSetNumber += 1
                                }
                                const displayLabel = isWarmup
                                  ? 'W'
                                  : String(workingSetNumber)

                                return (
                                  <View key={set.id} style={styles.setRow}>
                                    <View style={styles.setNumberCell}>
                                      <View
                                        style={[
                                          styles.setNumberBadge,
                                          isWarmup && styles.warmupBadge,
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.setNumberBadgeText,
                                            isWarmup && styles.warmupText,
                                          ]}
                                        >
                                          {displayLabel}
                                        </Text>
                                      </View>
                                    </View>
                                    <TextInput
                                      style={styles.setInput}
                                      value={weightValue}
                                      onChangeText={(val) =>
                                        updateSet(set.id, 'weight', val)
                                      }
                                      keyboardType="decimal-pad"
                                      placeholder="BW"
                                      placeholderTextColor={
                                        colors.textPlaceholder
                                      }
                                    />
                                    <TextInput
                                      style={styles.setInput}
                                      value={repsValue}
                                      onChangeText={(val) =>
                                        updateSet(set.id, 'reps', val)
                                      }
                                      keyboardType="decimal-pad"
                                      placeholder="--"
                                      placeholderTextColor={
                                        colors.textPlaceholder
                                      }
                                    />
                                    <TouchableOpacity
                                      onPress={() => deleteSet(set.id)}
                                      style={styles.deleteSetButton}
                                    >
                                      <Ionicons
                                        name="close-circle"
                                        size={20}
                                        color={colors.statusError}
                                      />
                                    </TouchableOpacity>
                                  </View>
                                )
                              }) ?? null
                            )
                          })()}

                          {/* Add Set Button */}
                          <TouchableOpacity
                            style={styles.addSetButton}
                            onPress={() => addSet(workoutExercise.id)}
                          >
                            <Text style={styles.addSetText}>+ Add Set</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </AnimatedReanimated.View>
                  )
                })}

              {/* Add Exercise Button */}
              <TouchableOpacity
                style={styles.addExerciseButton}
                onPress={handleAddExercise}
              >
                <Text style={styles.addExerciseText}>+ Add Exercise</Text>
              </TouchableOpacity>
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
      backgroundColor: colors.bg,
    },
    keyboardView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.bg,
    },
    headerButton: {
      zIndex: 1,
    },
    saveButtonGlass: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonTouchable: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    content: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    section: {
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    titleSection: {
      padding: 16,
      paddingBottom: 8,
    },
    titleInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    titleInput: {
      flex: 1,
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      paddingVertical: 0,
    },
    clearTitleButton: {
      padding: 4,
    },
    statsSection: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      alignItems: 'center',
    },
    statItem: {
      marginRight: 24,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    statValue: {
      fontSize: 16,
      color: colors.brandPrimary,
    },
    sectionLabelSmall: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    dateTextBlue: {
      fontSize: 16,
      color: colors.brandPrimary,
    },
    inputNoBorder: {
      fontSize: 16,
      color: colors.textPrimary,
      padding: 0,
    },
    textArea: {
      minHeight: 40,
      textAlignVertical: 'top',
    },
    datePickerModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    datePickerModalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 20,
    },
    datePickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    datePickerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    datePickerCancelText: {
      fontSize: 17,
      color: colors.textSecondary,
    },
    datePickerDoneText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    imageContainer: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginTop: 8,
    },
    imageWrapper: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: colors.surfaceSubtle,
    },
    workoutImage: {
      width: '100%',
      height: '100%',
    },
    imageLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
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
      borderRadius: 12,
    },
    changeButton: {
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.brandPrimary,
    },
    changeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    deleteButton: {
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.statusError,
    },
    deleteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.statusError,
    },
    addPhotoButton: {
      backgroundColor: colors.bg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      paddingVertical: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
      width: 120,
      height: 120,
    },
    addPhotoText: {
      fontSize: 14,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    exerciseCard: {
      backgroundColor: colors.bg,
      marginBottom: 24,
    },
    exerciseCardDragging: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 10,
      zIndex: 100,
    },
    exerciseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    exerciseHeaderDragging: {
      paddingHorizontal: 12,
    },
    exerciseHeaderLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    dragControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    dragArrow: {
      padding: 4,
    },
    dragArrowDisabled: {
      opacity: 0.5,
    },
    dragDone: {
      padding: 4,
      marginLeft: 4,
    },
    exerciseThumbnail: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#f0f0f0',
    },
    exerciseHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    optionsButton: {
      padding: 4,
    },
    setsContainer: {
      paddingTop: 4,
    },
    setsTableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    setHeaderSetCol: {
      width: 40,
      alignItems: 'center',
    },
    setHeaderInputCol: {
      flex: 1,
      alignItems: 'center',
    },
    setHeaderDeleteCol: {
      width: 30,
    },
    setHeaderText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    setNumberCell: {
      width: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    setNumberBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    warmupBadge: {
      backgroundColor: `${colors.statusWarning}25`,
    },
    setNumberBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    warmupText: {
      color: colors.statusWarning,
    },
    setInput: {
      flex: 1,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      padding: 10,
      fontSize: 14,
      color: colors.textPrimary,
      textAlign: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    deleteSetButton: {
      width: 30,
      alignItems: 'center',
    },
    addSetButton: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    addSetText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    addExerciseButton: {
      backgroundColor: colors.brandPrimary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 16,
      marginBottom: 32,
    },
    addExerciseText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  })
