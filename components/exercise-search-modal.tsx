import { useAuth } from '@/contexts/auth-context'
import { useExercises } from '@/hooks/useExercises'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { fuzzySearchExercises, hasExactOrFuzzyMatch } from '@/lib/utils/fuzzy-search'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { FlashList, FlashListRef } from '@shopify/flash-list'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ExerciseMediaThumbnail } from './ExerciseMedia'

interface ExerciseSearchModalProps {
  visible: boolean
  onClose: () => void
  onSelectExercise?: (exercise: Exercise) => void
  onMultiSelect?: (exercises: Exercise[]) => void
  multiSelect?: boolean
  currentExerciseName?: string
}

// Memoized exercise row component for FlashList
const ExerciseRow = memo(function ExerciseRow({
  exercise,
  isSelected,
  onSelect,
  onInfo,
  colors,
}: {
  exercise: Exercise
  isSelected: boolean
  onSelect: () => void
  onInfo: () => void
  colors: ReturnType<typeof useThemedColors>
}) {
  return (
    <View
      style={[
        styles.row,
        isSelected && { backgroundColor: colors.primary + '08' },
      ]}
    >
      <TouchableOpacity style={styles.rowContentContainer} onPress={onSelect}>
        <View style={styles.rowContent}>
          <ExerciseMediaThumbnail
            gifUrl={exercise.gif_url}
            style={styles.exerciseThumbnail}
          />
          <View style={styles.exerciseInfo}>
            <Text
              style={[
                styles.rowTitle,
                { color: isSelected ? colors.primary : colors.text },
                isSelected && styles.rowTitleSelected,
              ]}
              numberOfLines={1}
            >
              {exercise.name}
            </Text>
            <View style={styles.rowMeta}>
              {exercise.muscle_group && (
                <Text
                  style={[styles.rowSubtitle, { color: colors.textTertiary }]}
                >
                  {exercise.muscle_group}
                </Text>
              )}
              {exercise.muscle_group && exercise.equipment && (
                <Text style={[styles.rowDot, { color: colors.textTertiary }]}>
                  •
                </Text>
              )}
              {exercise.equipment && (
                <Text
                  style={[styles.rowSubtitle, { color: colors.textTertiary }]}
                >
                  {exercise.equipment}
                </Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.rowActions}>
        {isSelected && (
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={colors.primary}
            style={styles.checkIcon}
          />
        )}
        <TouchableOpacity
          onPress={onInfo}
          style={styles.infoButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="information-circle-outline"
            size={24}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  )
})

export function ExerciseSearchModal({
  visible,
  onClose,
  onSelectExercise,
  onMultiSelect,
  multiSelect = false,
  currentExerciseName,
}: ExerciseSearchModalProps) {
  const colors = useThemedColors()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()

  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const listRef = useRef<FlashListRef<Exercise>>(null)
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(
    new Set(),
  )
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([])
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])

  // Use the cached exercises hook
  const {
    exercises,
    recentExercises,
    muscleGroups,
    equipmentTypes,
    isLoading,
    addExercise,
  } = useExercises({ userId: user?.id, initialLoad: visible })

  const translateY = useSharedValue(0)
  const isKeyboardVisible = useSharedValue(false)

  const trimmedQuery = searchQuery.trim()
  const normalizedQuery = trimmedQuery.toLowerCase()

  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return false
    return hasExactOrFuzzyMatch(exercises, trimmedQuery)
  }, [exercises, trimmedQuery])

  const hasFilters =
    selectedMuscleGroups.length > 0 || selectedEquipment.length > 0

  // Memoized filtered exercises with fuzzy search
  const filteredExercises = useMemo(() => {
    // Apply fuzzy search first (handles typos, plurals, word order)
    let result = trimmedQuery
      ? fuzzySearchExercises(exercises, trimmedQuery)
      : exercises

    // Apply muscle group filter
    if (selectedMuscleGroups.length > 0) {
      result = result.filter(
        (exercise) =>
          exercise.muscle_group &&
          selectedMuscleGroups.includes(exercise.muscle_group),
      )
    }

    // Apply equipment filter
    if (selectedEquipment.length > 0) {
      result = result.filter((exercise) => {
        if (
          exercise.equipment &&
          selectedEquipment.includes(exercise.equipment)
        ) {
          return true
        }
        if (exercise.equipments && Array.isArray(exercise.equipments)) {
          return exercise.equipments.some((eq) =>
            selectedEquipment.includes(eq),
          )
        }
        return false
      })
    }

    return result
  }, [exercises, trimmedQuery, selectedMuscleGroups, selectedEquipment])

  // Scroll to top when results change or filters are applied
  useEffect(() => {
    if (visible) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false })
    }
  }, [trimmedQuery, selectedMuscleGroups, selectedEquipment, visible])

  const emptyStateText = useMemo(() => {
    if (trimmedQuery) {
      return hasFilters
        ? `No exercises found for "${trimmedQuery}" with selected filters`
        : `No exercises found for "${trimmedQuery}"`
    }
    if (hasFilters) {
      return 'No exercises match the selected filters'
    }
    return 'Start typing to search or use filters'
  }, [trimmedQuery, hasFilters])

  // Effects
  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      translateY.value = 0
    }
  }, [visible, translateY])

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height)
        isKeyboardVisible.value = true
      },
    )
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0)
        isKeyboardVisible.value = false
      },
    )
    return () => {
      keyboardWillShow.remove()
      keyboardWillHide.remove()
    }
  }, [isKeyboardVisible])

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('')
      setSelectedMuscleGroups([])
      setSelectedEquipment([])
      setSelectedExerciseIds(new Set())
      Keyboard.dismiss()
    }
  }, [visible])

  const handleInfoPress = useCallback(
    (exerciseId: string) => {
      Haptics.selectionAsync()
      onClose()
      router.push(`/exercise/${exerciseId}`)
    },
    [onClose],
  )

  const closeSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }, [onClose])

  const handleBackdropPress = useCallback(() => {
    if (keyboardHeight > 0) {
      Keyboard.dismiss()
    } else {
      closeSheet()
    }
  }, [keyboardHeight, closeSheet])

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss()
  }, [])

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 1000) {
        if (isKeyboardVisible.value) {
          // Extra soft spring for keyboard dismissal
          translateY.value = withSpring(0, { damping: 30, stiffness: 40 })
          runOnJS(dismissKeyboard)()
        } else {
          translateY.value = withTiming(500, { duration: 300 }, () => {
            runOnJS(closeSheet)()
          })
        }
      } else {
        // Extra soft reset spring
        translateY.value = withSpring(0, { damping: 30, stiffness: 40 })
      }
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const handleSelectExercise = useCallback(
    (exercise: Exercise) => {
      Keyboard.dismiss()
      Haptics.selectionAsync()

      if (multiSelect) {
        setSelectedExerciseIds((prev) => {
          const next = new Set(prev)
          if (next.has(exercise.id)) {
            next.delete(exercise.id)
          } else {
            next.add(exercise.id)
          }
          return next
        })
      } else {
        onSelectExercise?.(exercise)
        onClose()
      }
    },
    [multiSelect, onSelectExercise, onClose],
  )

  const handleDone = useCallback(() => {
    if (multiSelect && onMultiSelect) {
      const selected = exercises.filter((e) => selectedExerciseIds.has(e.id))
      if (selected.length > 0) {
        onMultiSelect(selected)
      }
      onClose()
    }
  }, [multiSelect, onMultiSelect, exercises, selectedExerciseIds, onClose])

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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const newExercise = await database.exercises.getOrCreate(name, user.id)
      addExercise(newExercise)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      handleSelectExercise(newExercise)
    } catch (error) {
      console.error('Error creating exercise:', error)
      Alert.alert('Error', 'Failed to create exercise.')
    } finally {
      setIsCreating(false)
    }
  }, [trimmedQuery, isCreating, user, handleSelectExercise, addExercise])

  const toggleMuscleGroup = useCallback((group: string) => {
    Keyboard.dismiss()
    Haptics.selectionAsync()
    setSelectedMuscleGroups((prev) =>
      prev.includes(group) ? prev.filter((i) => i !== group) : [...prev, group],
    )
  }, [])

  const toggleEquipment = useCallback((type: string) => {
    Keyboard.dismiss()
    Haptics.selectionAsync()
    setSelectedEquipment((prev) =>
      prev.includes(type) ? prev.filter((i) => i !== type) : [...prev, type],
    )
  }, [])

  // Render item for FlashList
  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => {
      const isSelected = multiSelect
        ? selectedExerciseIds.has(item.id)
        : item.name === currentExerciseName

      return (
        <ExerciseRow
          exercise={item}
          isSelected={isSelected}
          onSelect={() => handleSelectExercise(item)}
          onInfo={() => handleInfoPress(item.id)}
          colors={colors}
        />
      )
    },
    [
      multiSelect,
      selectedExerciseIds,
      currentExerciseName,
      handleSelectExercise,
      handleInfoPress,
      colors,
    ],
  )

  const keyExtractor = useCallback((item: Exercise) => item.id, [])

  // Header component for the list (create button + sections)
  const ListHeader = useMemo(() => {
    const showCreateButton = trimmedQuery && !hasExactMatch
    const showRecentSection =
      !trimmedQuery && !hasFilters && recentExercises.length > 0

    if (!showCreateButton && !showRecentSection) return null

    return (
      <View>
        {showCreateButton && (
          <TouchableOpacity
            style={[
              styles.createRow,
              { backgroundColor: colors.primary + '10' },
            ]}
            onPress={handleCreateExercise}
          >
            <View
              style={[styles.createIcon, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="add" size={24} color={colors.white} />
            </View>
            <View>
              <Text style={[styles.createRowText, { color: colors.text }]}>
                Create &quot;{trimmedQuery}&quot;
              </Text>
              <Text
                style={[
                  styles.createRowSubtext,
                  { color: colors.textSecondary },
                ]}
              >
                New custom exercise
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {showRecentSection && (
          <>
            <Text
              style={[
                styles.sectionHeader,
                {
                  color: colors.textSecondary,
                  backgroundColor: colors.backgroundLight,
                },
              ]}
            >
              Recently Used
            </Text>
            {recentExercises.map((exercise) => {
              const isSelected = multiSelect
                ? selectedExerciseIds.has(exercise.id)
                : exercise.name === currentExerciseName

              return (
                <ExerciseRow
                  key={exercise.id}
                  exercise={exercise}
                  isSelected={isSelected}
                  onSelect={() => handleSelectExercise(exercise)}
                  onInfo={() => handleInfoPress(exercise.id)}
                  colors={colors}
                />
              )
            })}
            <Text
              style={[
                styles.sectionHeader,
                {
                  color: colors.textSecondary,
                  backgroundColor: colors.backgroundLight,
                },
              ]}
            >
              All Exercises
            </Text>
          </>
        )}
      </View>
    )
  }, [
    trimmedQuery,
    hasExactMatch,
    hasFilters,
    recentExercises,
    multiSelect,
    selectedExerciseIds,
    currentExerciseName,
    colors,
    handleCreateExercise,
    handleSelectExercise,
    handleInfoPress,
  ])

  const EmptyComponent = useMemo(
    () => (
      <View style={styles.centerContainer}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {emptyStateText}
        </Text>
        {trimmedQuery && !hasExactMatch && (
          <TouchableOpacity
            style={[
              styles.createButton,
              { backgroundColor: colors.primary + '15' },
            ]}
            onPress={handleCreateExercise}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text
                style={[styles.createButtonText, { color: colors.primary }]}
              >
                Create &quot;{trimmedQuery}&quot;
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    ),
    [
      emptyStateText,
      trimmedQuery,
      hasExactMatch,
      isCreating,
      colors,
      handleCreateExercise,
    ],
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeSheet}
    >
      <GestureHandlerRootView style={styles.container}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
        >
          <View style={styles.backdrop} />
        </Pressable>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.bottomSheet,
              { backgroundColor: colors.white },
              animatedStyle,
              { paddingBottom: Math.max(insets.bottom, keyboardHeight) },
            ]}
          >
            <View style={styles.sheetHandle}>
              <View style={styles.handle} />
            </View>

            <View style={styles.header}>
              <View style={styles.headerLeftSpacer} />
              <Text style={[styles.title, { color: colors.text }]}>
                Select Exercise
              </Text>
              <View style={styles.headerRight}>
                {multiSelect && selectedExerciseIds.size > 0 && (
                  <TouchableOpacity onPress={handleDone}>
                    <Text
                      style={[
                        styles.classesDoneText,
                        { color: colors.primary },
                      ]}
                    >
                      Done ({selectedExerciseIds.size})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View
              style={[
                styles.searchContainer,
                { backgroundColor: colors.backgroundLight },
              ]}
            >
              <Ionicons
                name="search"
                size={20}
                color={colors.textTertiary}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search exercises..."
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
                clearButtonMode="while-editing"
              />
            </View>

            {/* Filters */}
            <View style={styles.filtersContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
                style={styles.filterRow}
              >
                <Text
                  style={[styles.filterLabel, { color: colors.textSecondary }]}
                >
                  Muscles:
                </Text>
                {muscleGroups.map((group) => {
                  const isSelected = selectedMuscleGroups.includes(group)
                  return (
                    <TouchableOpacity
                      key={group}
                      style={[
                        styles.chip,
                        { backgroundColor: colors.backgroundLight },
                        isSelected && {
                          backgroundColor: colors.primary + '15',
                          borderColor: colors.primary,
                        },
                      ]}
                      onPress={() => toggleMuscleGroup(group)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected
                              ? colors.primary
                              : colors.textSecondary,
                          },
                        ]}
                      >
                        {group}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
                style={styles.filterRow}
              >
                <Text
                  style={[styles.filterLabel, { color: colors.textSecondary }]}
                >
                  Equipment:
                </Text>
                {equipmentTypes.map((type) => {
                  const isSelected = selectedEquipment.includes(type)
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.chip,
                        { backgroundColor: colors.backgroundLight },
                        isSelected && {
                          backgroundColor: colors.primary + '15',
                          borderColor: colors.primary,
                        },
                      ]}
                      onPress={() => toggleEquipment(type)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected
                              ? colors.primary
                              : colors.textSecondary,
                          },
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>

            {/* List - FlashList requires parent with flex: 1 for proper layout */}
            <View style={styles.listContainer}>
              {isLoading && exercises.length === 0 ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : filteredExercises.length === 0 &&
                !(!trimmedQuery && !hasFilters && recentExercises.length > 0) ? (
                EmptyComponent
              ) : (
              <FlashList
                ref={listRef}
                data={filteredExercises}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ListHeaderComponent={ListHeader}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                extraData={selectedExerciseIds}
              />
              )}
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    height: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeftSpacer: {
    width: 60,
  },
  headerRight: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  classesDoneText: {
    fontWeight: '600',
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  filtersContainer: {
    marginBottom: 8,
  },
  listContainer: {
    flex: 1,
  },
  filterRow: {
    marginBottom: 12,
    paddingHorizontal: 20,
    maxHeight: 36,
  },
  filterScroll: {
    alignItems: 'center',
    paddingRight: 20,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    minHeight: 80,
  },
  exerciseThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  rowContentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 12,
  },
  infoButton: {
    padding: 4,
  },
  checkIcon: {
    marginRight: 4,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  rowTitleSelected: {
    fontWeight: '600',
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSubtitle: {
    fontSize: 13,
  },
  rowDot: {
    fontSize: 13,
    marginHorizontal: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
  },
  createButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  createIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  createRowText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createRowSubtext: {
    fontSize: 13,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
})
