import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { Paywall } from '@/components/paywall'
import { ProBadge } from '@/components/pro-badge'
import { SlideInView } from '@/components/slide-in-view'
import { useSubscription } from '@/contexts/subscription-context'
import { useExercises } from '@/hooks/useExercises'
import { useExerciseSelection } from '@/hooks/useExerciseSelection'
import { useThemedColors } from '@/hooks/useThemedColors'
import { fuzzySearchExercises, hasExactOrFuzzyMatch } from '@/lib/utils/fuzzy-search'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
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

// Memoized exercise row for optimal FlashList performance
const ExerciseItem = memo(function ExerciseItem({
  exercise,
  isCurrentExercise,
  onSelect,
  colors,
}: {
  exercise: Exercise
  isCurrentExercise: boolean
  onSelect: () => void
  colors: ReturnType<typeof useThemedColors>
}) {
  return (
    <TouchableOpacity
      style={[
        styles.exerciseItem,
        isCurrentExercise && { backgroundColor: colors.primaryLight },
      ]}
      onPress={onSelect}
      disabled={isCurrentExercise}
    >
      <ExerciseMediaThumbnail
        gifUrl={exercise.gif_url}
        style={styles.exerciseThumbnail}
      />
      <View style={styles.exerciseItemContent}>
        <Text
          style={[
            styles.exerciseItemText,
            { color: colors.text },
            isCurrentExercise && { fontWeight: '600', color: colors.primary },
          ]}
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        {exercise.muscle_group && (
          <Text style={[styles.exerciseMuscleGroup, { color: colors.textSecondary }]}>
            {exercise.muscle_group}
          </Text>
        )}
      </View>
      {isCurrentExercise && (
        <Ionicons name="checkmark" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  )
})

export default function SelectExerciseScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const { currentExerciseName } = useLocalSearchParams<{ currentExerciseName?: string }>()
  const { callCallback } = useExerciseSelection()
  const { isProMember } = useSubscription()

  const [searchQuery, setSearchQuery] = useState('')
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([])
  const [showPaywall, setShowPaywall] = useState(false)
  const [shouldExit, setShouldExit] = useState(false)
  const insets = useSafeAreaInsets()

  // Use cached exercises hook
  const { exercises, muscleGroups, isLoading, searchExercises } = useExercises({
    initialLoad: true,
  })

  const trimmedQuery = searchQuery.trim()
  const normalizedQuery = trimmedQuery.toLowerCase()
  const hasMuscleFilter = selectedMuscleGroups.length > 0

  // Debounced filtered results with fuzzy search
  const filteredExercises = useMemo(() => {
    let result = exercises

    // Apply fuzzy search filter (handles typos, plurals, word order)
    if (trimmedQuery) {
      result = fuzzySearchExercises(result, trimmedQuery)
    }

    // Apply muscle group filter
    if (hasMuscleFilter) {
      const selectedSet = new Set(selectedMuscleGroups)
      result = result.filter((e) => e.muscle_group && selectedSet.has(e.muscle_group))
    }

    return result
  }, [exercises, trimmedQuery, hasMuscleFilter, selectedMuscleGroups])

  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return false
    return hasExactOrFuzzyMatch(exercises, trimmedQuery)
  }, [exercises, trimmedQuery])

  const emptyStateText = useMemo(() => {
    if (trimmedQuery) {
      return hasMuscleFilter
        ? `No exercises found for "${trimmedQuery}" in selected groups`
        : `No exercises found for "${trimmedQuery}"`
    }
    if (hasMuscleFilter) {
      return 'No exercises match the selected muscle groups'
    }
    return 'Start typing to search'
  }, [trimmedQuery, hasMuscleFilter])

  // Handle keyboard events
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    )
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    )

    return () => {
      keyboardWillShow.remove()
      keyboardWillHide.remove()
    }
  }, [])

  const handleSelectExercise = useCallback(
    (exercise: Exercise) => {
      callCallback(exercise)
      router.back()
    },
    [callCallback, router]
  )

  const handleCreateExercise = useCallback(() => {
    const name = trimmedQuery
    if (!name) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (!isProMember) {
      setShowPaywall(true)
      return
    }

    router.push({
      pathname: '/create-exercise',
      params: { exerciseName: name },
    })
  }, [trimmedQuery, router, isProMember])

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const toggleMuscleGroup = useCallback((group: string) => {
    setSelectedMuscleGroups((prev) =>
      prev.includes(group) ? prev.filter((item) => item !== group) : [...prev, group]
    )
  }, [])

  const clearMuscleGroups = useCallback(() => {
    setSelectedMuscleGroups([])
  }, [])

  // FlashList render item
  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => {
      const isCurrentExercise = item.name === currentExerciseName
      return (
        <ExerciseItem
          exercise={item}
          isCurrentExercise={isCurrentExercise}
          onSelect={() => handleSelectExercise(item)}
          colors={colors}
        />
      )
    },
    [currentExerciseName, handleSelectExercise, colors]
  )

  const keyExtractor = useCallback((item: Exercise) => item.id, [])

  // Create exercise header component
  const ListHeader = useMemo(() => {
    if (!trimmedQuery || hasExactMatch || isLoading) return null

    return (
      <View style={styles.createExerciseContainer}>
        <TouchableOpacity
          style={[styles.createExerciseItem, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
          onPress={handleCreateExercise}
        >
          <Ionicons name="add-circle" size={20} color={colors.primary} />
          <View style={styles.exerciseItemContent}>
            <Text style={[styles.createExerciseText, { color: colors.primary }]}>
              Create &quot;{trimmedQuery}&quot;
            </Text>
            <Text style={[styles.exerciseMuscleGroup, { color: colors.textSecondary }]}>
              New exercise
            </Text>
          </View>
          {!isProMember && <ProBadge size="small" />}
        </TouchableOpacity>
      </View>
    )
  }, [trimmedQuery, hasExactMatch, isLoading, colors, handleCreateExercise, isProMember])

  // Empty state component
  const ListEmpty = useMemo(() => {
    if (isLoading) return null

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="barbell-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
          {emptyStateText}
        </Text>
      </View>
    )
  }, [isLoading, colors, emptyStateText])

  return (
    <SlideInView
      style={{ flex: 1 }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Select Exercise</Text>
          <View style={styles.backButton} />
        </View>

        {/* Search Input */}
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.backgroundLight, color: colors.text }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search exercises..."
          placeholderTextColor={colors.textPlaceholder}
          autoCapitalize="words"
        />

        {/* Muscle Filter */}
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
                { borderColor: colors.border, backgroundColor: colors.backgroundLight },
                !hasMuscleFilter && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
              ]}
              onPress={clearMuscleGroups}
            >
              <Text
                style={[
                  styles.muscleFilterChipText,
                  { color: colors.textSecondary },
                  !hasMuscleFilter && { color: colors.primary },
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
                    { borderColor: colors.border, backgroundColor: colors.backgroundLight },
                    isSelected && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                  ]}
                  onPress={() => toggleMuscleGroup(group)}
                >
                  <Text
                    style={[
                      styles.muscleFilterChipText,
                      { color: colors.textSecondary },
                      isSelected && { color: colors.primary },
                    ]}
                  >
                    {group}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}

        {/* Exercise List */}
        <View style={styles.listContainer}>
          <FlashList
            data={filteredExercises}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: keyboardHeight + 20, paddingHorizontal: 16 }}
          />
        </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
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
    letterSpacing: 0.3,
  },
  searchInput: {
    margin: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
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
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muscleFilterChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  exerciseItemContent: {
    flex: 1,
  },
  exerciseItemText: {
    fontSize: 16,
    marginBottom: 2,
  },
  exerciseThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
  },
  exerciseMuscleGroup: {
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  createExerciseContainer: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  createExerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  createExerciseText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
})
