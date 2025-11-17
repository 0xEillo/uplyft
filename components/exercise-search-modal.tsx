import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

interface ExerciseSearchModalProps {
  visible: boolean
  onClose: () => void
  onSelectExercise: (exercise: Exercise) => void
  currentExerciseName?: string
}

export function ExerciseSearchModal({
  visible,
  onClose,
  onSelectExercise,
  currentExerciseName,
}: ExerciseSearchModalProps) {
  const colors = useThemedColors()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [muscleGroups, setMuscleGroups] = useState<string[]>([])
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([])
  const translateY = useSharedValue(0)

  const styles = createStyles(colors)
  const trimmedQuery = searchQuery.trim()
  const normalizedQuery = trimmedQuery.toLowerCase()
  const hasExactMatch = trimmedQuery
    ? exercises.some(
        (exercise) => exercise.name.toLowerCase() === normalizedQuery,
      )
    : false
  const hasMuscleFilter = selectedMuscleGroups.length > 0
  const filteredExercises = useMemo(() => {
    if (!hasMuscleFilter) return exercises
    const selectedSet = new Set(selectedMuscleGroups)
    return exercises.filter((exercise) => {
      if (!exercise.muscle_group) return false
      return selectedSet.has(exercise.muscle_group)
    })
  }, [exercises, selectedMuscleGroups, hasMuscleFilter])
  const emptyStateText = (() => {
    if (trimmedQuery) {
      return hasMuscleFilter
        ? `No exercises found for "${trimmedQuery}" in selected groups`
        : `No exercises found for "${trimmedQuery}"`
    }
    if (hasMuscleFilter) {
      return 'No exercises match the selected muscle groups'
    }
    return 'Start typing to search'
  })()

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      translateY.value = 0
    }
  }, [visible, translateY])

  // Handle keyboard events
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height)
      },
    )
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0)
      },
    )

    return () => {
      keyboardWillShow.remove()
      keyboardWillHide.remove()
    }
  }, [])

  // Load exercises when modal opens or search query changes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('')
      setExercises([])
      setKeyboardHeight(0)
      setSelectedMuscleGroups([])
      Keyboard.dismiss()
      return
    }

    const loadExercises = async () => {
      try {
        setIsLoading(true)
        if (trimmedQuery) {
          const results = await database.exercises.findByName(trimmedQuery)
          setExercises(results)
        } else {
          const allExercises = await database.exercises.getAll()
          setExercises(allExercises)
        }
      } catch (error) {
        console.error('Error loading exercises:', error)
        setExercises([])
      } finally {
        setIsLoading(false)
      }
    }

    // Debounce search
    const timeoutId = setTimeout(loadExercises, 300)
    return () => clearTimeout(timeoutId)
  }, [visible, searchQuery])

  useEffect(() => {
    if (!visible) return

    let isMounted = true
    const fetchMuscleGroups = async () => {
      try {
        const groups = await database.exercises.getMuscleGroups()
        if (isMounted) {
          setMuscleGroups(groups)
        }
      } catch (error) {
        console.error('Error loading muscle groups:', error)
      }
    }

    fetchMuscleGroups()

    return () => {
      isMounted = false
    }
  }, [visible])

  const closeSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 1000) {
        translateY.value = withTiming(500, { duration: 200 }, () => {
          runOnJS(closeSheet)()
        })
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
        })
      }
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const handleSelectExercise = useCallback(
    (exercise: Exercise) => {
      onSelectExercise(exercise)
      onClose()
    },
    [onSelectExercise, onClose],
  )

  const handleCreateExercise = useCallback(async () => {
    const name = trimmedQuery
    if (!name || isCreating) return

    if (!user) {
      Alert.alert(
        'Login Required',
        'You must be logged in to create exercises.',
      )
      return
    }

    try {
      setIsCreating(true)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const newExercise = await database.exercises.getOrCreate(name, user.id)
      setExercises((prev) => {
        if (prev.some((exercise) => exercise.id === newExercise.id)) {
          return prev
        }
        return [newExercise, ...prev]
      })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      handleSelectExercise(newExercise)
    } catch (error) {
      console.error('Error creating exercise:', error)
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to create exercise. Please try again.',
      )
    } finally {
      setIsCreating(false)
    }
  }, [trimmedQuery, isCreating, user, handleSelectExercise])

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const toggleMuscleGroup = useCallback((group: string) => {
    setSelectedMuscleGroups((prev) => {
      if (prev.includes(group)) {
        return prev.filter((item) => item !== group)
      }
      return [...prev, group]
    })
  }, [])

  const clearMuscleGroups = useCallback(() => {
    setSelectedMuscleGroups([])
  }, [])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.container}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <View style={styles.backdrop} />
        </Pressable>

        {/* Bottom Sheet */}
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.bottomSheet,
              animatedStyle,
              { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 34 },
            ]}
          >
            {/* Handle */}
            <View style={styles.sheetHandle}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Exercise</Text>
            </View>

            {/* Search Input */}
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search exercises..."
              placeholderTextColor={colors.textPlaceholder}
              autoCapitalize="words"
            />

            {muscleGroups.length > 0 && (
              <View style={styles.muscleFilterContainer}>
                <TouchableOpacity
                  style={[
                    styles.muscleFilterChip,
                    !hasMuscleFilter && styles.muscleFilterChipActive,
                  ]}
                  onPress={clearMuscleGroups}
                >
                  <Text
                    style={[
                      styles.muscleFilterChipText,
                      !hasMuscleFilter && styles.muscleFilterChipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {muscleGroups.map((group) => {
                  const isSelected = selectedMuscleGroups.includes(group)
                  return (
                    <TouchableOpacity
                      key={group}
                      style={[
                        styles.muscleFilterChip,
                        isSelected && styles.muscleFilterChipActive,
                      ]}
                      onPress={() => toggleMuscleGroup(group)}
                    >
                      <Text
                        style={[
                          styles.muscleFilterChipText,
                          isSelected && styles.muscleFilterChipTextActive,
                        ]}
                      >
                        {group}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {/* Results */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : filteredExercises.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="barbell-outline"
                  size={48}
                  color={colors.textTertiary}
                />
                <Text style={styles.emptyText}>{emptyStateText}</Text>
                {trimmedQuery && !hasExactMatch && (
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleCreateExercise}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons
                          name="add-circle"
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={styles.createButtonText}>
                          Create "{trimmedQuery}"
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <ScrollView
                style={styles.exerciseList}
                keyboardShouldPersistTaps="handled"
              >
                {trimmedQuery && !hasExactMatch && (
                  <TouchableOpacity
                    style={styles.createExerciseItem}
                    onPress={handleCreateExercise}
                    disabled={isCreating}
                  >
                    <Ionicons
                      name="add-circle"
                      size={20}
                      color={colors.primary}
                    />
                    <View style={styles.exerciseItemContent}>
                      <Text style={styles.createExerciseText}>
                        Create "{trimmedQuery}"
                      </Text>
                      <Text style={styles.exerciseMuscleGroup}>
                        New exercise
                      </Text>
                    </View>
                    {isCreating && (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
                {filteredExercises.map((exercise) => {
                  const isCurrentExercise =
                    exercise.name === currentExerciseName
                  return (
                    <TouchableOpacity
                      key={exercise.id}
                      style={[
                        styles.exerciseItem,
                        isCurrentExercise && styles.exerciseItemSelected,
                      ]}
                      onPress={() => handleSelectExercise(exercise)}
                      disabled={isCurrentExercise}
                    >
                      <View style={styles.exerciseItemContent}>
                        <Text
                          style={[
                            styles.exerciseItemText,
                            isCurrentExercise &&
                              styles.exerciseItemTextSelected,
                          ]}
                        >
                          {exercise.name}
                        </Text>
                        {exercise.muscle_group && (
                          <Text style={styles.exerciseMuscleGroup}>
                            {exercise.muscle_group}
                          </Text>
                        )}
                      </View>
                      {isCurrentExercise && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    bottomSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '80%',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 12,
    },
    sheetHandle: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 4,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    sheetHeader: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 8,
      paddingHorizontal: 24,
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.3,
    },
    searchInput: {
      margin: 16,
      marginBottom: 8,
      padding: 12,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
      fontSize: 16,
      color: colors.text,
    },
    muscleFilterContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    muscleFilterChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      marginRight: 8,
      marginBottom: 8,
    },
    muscleFilterChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    muscleFilterChipText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    muscleFilterChipTextActive: {
      color: colors.primary,
    },
    exerciseList: {
      paddingHorizontal: 16,
    },
    exerciseItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
      marginBottom: 4,
    },
    exerciseItemSelected: {
      backgroundColor: colors.primaryLight,
    },
    exerciseItemContent: {
      flex: 1,
    },
    exerciseItemText: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 2,
    },
    exerciseItemTextSelected: {
      fontWeight: '600',
      color: colors.primary,
    },
    exerciseMuscleGroup: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    loadingContainer: {
      paddingVertical: 60,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      paddingVertical: 60,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 12,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 16,
      paddingVertical: 12,
      paddingHorizontal: 18,
      backgroundColor: colors.primaryLight,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    createExerciseItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
      marginBottom: 8,
      gap: 12,
    },
    createExerciseText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 2,
    },
  })
