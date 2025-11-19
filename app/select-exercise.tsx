import { Paywall } from '@/components/paywall'
import { ProBadge } from '@/components/pro-badge'
import { SlideInView } from '@/components/slide-in-view'
import { useSubscription } from '@/contexts/subscription-context'
import { useExerciseSelection } from '@/hooks/useExerciseSelection'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function SelectExerciseScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const { currentExerciseName } = useLocalSearchParams<{
    currentExerciseName?: string
  }>()
  const { callCallback } = useExerciseSelection()
  const { isProMember } = useSubscription()

  const [searchQuery, setSearchQuery] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [muscleGroups, setMuscleGroups] = useState<string[]>([])
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([])
  const [showPaywall, setShowPaywall] = useState(false)
  const [shouldExit, setShouldExit] = useState(false)
  const insets = useSafeAreaInsets()

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

  // Load exercises when screen opens or search query changes
  useEffect(() => {
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
  }, [searchQuery, trimmedQuery])

  useEffect(() => {
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
  }, [])

  const handleSelectExercise = useCallback(
    (exercise: Exercise) => {
      callCallback(exercise)
      router.back()
    },
    [callCallback, router],
  )

  const handleCreateExercise = useCallback(() => {
    const name = trimmedQuery
    if (!name) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Check if user has PRO subscription
    if (!isProMember) {
      setShowPaywall(true)
      return
    }

    router.push({
      pathname: '/create-exercise',
      params: {
        exerciseName: name,
      },
    })
  }, [trimmedQuery, router, isProMember])

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShouldExit(true)
  }

  const handleExitComplete = () => {
    router.back()
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
    <SlideInView
      style={{ flex: 1 }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Exercise</Text>
          <View style={styles.backButton} />
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.muscleFilterScrollView}
            contentContainerStyle={styles.muscleFilterContainer}
          >
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
          </ScrollView>
        )}

        {/* Create Exercise Button */}
        {trimmedQuery && !hasExactMatch && !isLoading && (
          <View style={styles.createExerciseContainer}>
            <TouchableOpacity
              style={styles.createExerciseItem}
              onPress={handleCreateExercise}
            >
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <View style={styles.exerciseItemContent}>
                <Text style={styles.createExerciseText}>
                  Create &quot;{trimmedQuery}&quot;
                </Text>
                <Text style={styles.exerciseMuscleGroup}>New exercise</Text>
              </View>
              {!isProMember && <ProBadge size="small" />}
            </TouchableOpacity>
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
          </View>
        ) : (
          <ScrollView
            style={styles.exerciseList}
            contentContainerStyle={{ paddingBottom: keyboardHeight + 20 }}
            keyboardShouldPersistTaps="handled"
          >
            {filteredExercises.map((exercise) => {
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

        {/* Paywall Modal */}
        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          title="Create Custom Exercises"
          message="Creating custom exercises is a PRO feature."
        />
      </View>
    </SlideInView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
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
    muscleFilterScrollView: {
      maxHeight: 50,
    },
    muscleFilterContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    muscleFilterChip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      marginRight: 8,
      alignItems: 'center',
      justifyContent: 'center',
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
      flex: 1,
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
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
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
    createExerciseContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
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
