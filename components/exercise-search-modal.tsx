import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Exercise } from '@/types/database.types'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
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
  const [searchQuery, setSearchQuery] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const translateY = useSharedValue(0)

  const styles = createStyles(colors)

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      translateY.value = 0
    }
  }, [visible, translateY])

  // Load exercises when modal opens or search query changes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('')
      setExercises([])
      return
    }

    const loadExercises = async () => {
      try {
        setIsLoading(true)
        if (searchQuery.trim()) {
          const results = await database.exercises.findByName(searchQuery.trim())
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

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

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
          <Animated.View style={[styles.bottomSheet, animatedStyle]}>
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

          {/* Results */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : exercises.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="barbell-outline"
                size={48}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'No exercises found'
                  : 'Start typing to search'}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.exerciseList}>
              {exercises.map((exercise) => {
                const isCurrentExercise = exercise.name === currentExerciseName
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
                          isCurrentExercise && styles.exerciseItemTextSelected,
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
      paddingBottom: 34,
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
  })
