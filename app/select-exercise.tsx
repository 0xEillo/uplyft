import { EmptyState } from '@/components/EmptyState'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { Paywall } from '@/components/paywall'
import { ProBadge } from '@/components/pro-badge'
import { SlideInView } from '@/components/slide-in-view'
import { useSubscription } from '@/contexts/subscription-context'
import { useExercises } from '@/hooks/useExercises'
import { useExerciseSelection } from '@/hooks/useExerciseSelection'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
  fuzzySearchExercises,
  hasExactOrFuzzyMatch,
} from '@/lib/utils/fuzzy-search'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { FlashList, FlashListRef } from '@shopify/flash-list'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Dimensions,
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

const SCREEN_WIDTH = Dimensions.get('window').width
const GAP = 12
const COLUMN_COUNT = 2
const ITEM_WIDTH = (SCREEN_WIDTH - 32 - GAP) / COLUMN_COUNT

// Memoized exercise card for grid layout
const ExerciseGridItem = memo(function ExerciseGridItem({
  exercise,
  isCurrentExercise,
  isSelected,
  onSelect,
  onInfo,
  colors,
}: {
  exercise: Exercise
  isCurrentExercise: boolean
  isSelected: boolean
  onSelect: () => void
  onInfo: () => void
  colors: ReturnType<typeof useThemedColors>
}) {
  return (
    <TouchableOpacity
      style={[
        styles.exerciseCard,
        { backgroundColor: colors.feedCardBackground, borderColor: colors.border },
        isCurrentExercise && { borderColor: colors.primary, borderWidth: 2 },
        isSelected && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primary + '10' },
      ]}
      onPress={onSelect}
    >
      <View style={styles.cardImageContainer}>
        <ExerciseMediaThumbnail
          gifUrl={exercise.gif_url}
          style={styles.cardImage}
        />
        {/* Overlay Icons */}
        <View style={styles.cardOverlay}>
          {isSelected ? (
            <View style={styles.selectionBadge}>
              <Ionicons name="checkbox" size={20} color={colors.primary} />
            </View>
          ) : (
            <View style={styles.iconButtonSmall} />
          )}
          <TouchableOpacity 
            style={styles.infoButton}
            onPress={(e) => {
              e.stopPropagation()
              onInfo()
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="information-circle" size={22} color="rgba(0,0,0,0.6)" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.cardContent}>
        <Text
          style={[
            styles.cardTitle,
            { color: colors.text },
            (isCurrentExercise || isSelected) && { color: colors.primary },
          ]}
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        {exercise.muscle_group && (
          <Text
            style={[
              styles.cardSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            {exercise.muscle_group}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
})

const ExerciseListItem = memo(function ExerciseListItem({
  exercise,
  isCurrentExercise,
  isSelected,
  onSelect,
  onInfo,
  colors,
}: {
  exercise: Exercise
  isCurrentExercise: boolean
  isSelected: boolean
  onSelect: () => void
  onInfo: () => void
  colors: ReturnType<typeof useThemedColors>
}) {
  return (
    <TouchableOpacity
      style={[
        styles.exerciseListItem,
      ]}
      onPress={onInfo}
    >
      <ExerciseMediaThumbnail
        gifUrl={exercise.gif_url}
        style={styles.exerciseListItemThumbnail}
      />
      <View style={styles.exerciseListItemContent}>
        <Text
          style={[
            styles.exerciseListItemText,
            { color: colors.text },
            (isCurrentExercise || isSelected) && { fontWeight: '600', color: colors.primary },
          ]}
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        {exercise.muscle_group && (
          <Text
            style={[
              styles.exerciseListItemMuscle,
              { color: colors.textSecondary },
            ]}
          >
            {exercise.muscle_group}
          </Text>
        )}
      </View>
      <TouchableOpacity 
        style={styles.listItemCheckbox}
        onPress={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        disabled={isCurrentExercise}
      >
        <Ionicons 
          name={(isCurrentExercise || isSelected) ? "checkbox" : "square-outline"} 
          size={24} 
          color={(isCurrentExercise || isSelected) ? colors.primary : colors.textTertiary} 
        />
      </TouchableOpacity>
    </TouchableOpacity>
  )
})

export default function SelectExerciseScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const { currentExerciseName } = useLocalSearchParams<{
    currentExerciseName?: string
  }>()
  const { callCallback } = useExerciseSelection()
  const { isProMember } = useSubscription()

  // If currentExerciseName is present, we are selecting ONE exercise (e.g. replacing).
  // Otherwise, we are adding exercises (Multi-select allowed).
  const isMultiSelect = !currentExerciseName

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const [isFilterVisible, setIsFilterVisible] = useState(false)
  
  // View mode state: 'grid' or 'list'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const searchInputRef = useRef<TextInput>(null)

  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const listRef = useRef<FlashListRef<Exercise>>(null)
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([])
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [showPaywall, setShowPaywall] = useState(false)
  const [shouldExit, setShouldExit] = useState(false)
  const insets = useSafeAreaInsets()

  // Use cached exercises hook
  const {
    exercises,
    muscleGroups,
    equipmentTypes,
    isLoading,
  } = useExercises({
    initialLoad: true,
  })

  const trimmedQuery = searchQuery.trim()
  const hasMuscleFilter = selectedMuscleGroups.length > 0
  const hasEquipmentFilter = selectedEquipment.length > 0
  const hasFilters = hasMuscleFilter || hasEquipmentFilter

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
      result = result.filter(
        (e) => e.muscle_group && selectedSet.has(e.muscle_group),
      )
    }

    // Apply equipment filter
    if (hasEquipmentFilter) {
      // ... same logic
      const selectedSet = new Set(selectedEquipment)
      result = result.filter((e) => {
        if (e.equipment && selectedSet.has(e.equipment)) return true
        if (e.equipments && Array.isArray(e.equipments)) {
          return e.equipments.some((eq) => selectedSet.has(eq))
        }
        return false
      })
    }

    return result
  }, [
    exercises,
    trimmedQuery,
    hasMuscleFilter,
    selectedMuscleGroups,
    hasEquipmentFilter,
    selectedEquipment,
  ])

  // Scroll to top when search results change
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [trimmedQuery, selectedMuscleGroups, selectedEquipment])

  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return false
    return hasExactOrFuzzyMatch(exercises, trimmedQuery)
  }, [exercises, trimmedQuery])

  const emptyStateText = useMemo(() => {
    if (trimmedQuery) {
      return hasFilters
        ? `No exercises found for "${trimmedQuery}" with selected filters`
        : `No exercises found for "${trimmedQuery}"`
    }
    if (hasFilters) {
      return 'No exercises match the selected filters'
    }
    return 'Start typing to search'
  }, [trimmedQuery, hasFilters])

  // Handle keyboard events
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height),
    )
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    )

    return () => {
      keyboardWillShow.remove()
      keyboardWillHide.remove()
    }
  }, [])

  const handleSelectExercise = useCallback(
    (exercise: Exercise) => {
       if (isMultiSelect) {
           Haptics.selectionAsync()
           setSelectedIds(prev => {
               const newSet = new Set(prev)
               if (newSet.has(exercise.id)) {
                   newSet.delete(exercise.id)
               } else {
                   newSet.add(exercise.id)
               }
               return newSet
           })
       } else {
           // Single select mode (return immediately)
           callCallback(exercise)
           router.back()
       }
    },
    [callCallback, router, isMultiSelect],
  )
  
  const handleConfirmSelection = useCallback(() => {
      if (selectedIds.size === 0) return
      
      const selectedExercises = exercises.filter(e => selectedIds.has(e.id))
      callCallback(selectedExercises)
      router.back()
  }, [selectedIds, exercises, callCallback, router])

  const handleCreateExercise = useCallback(() => {
    const name = trimmedQuery
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
      prev.includes(group)
        ? prev.filter((item) => item !== group)
        : [...prev, group],
    )
  }, [])

  const toggleEquipment = useCallback((type: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(type)
        ? prev.filter((item) => item !== type)
        : [...prev, type],
    )
  }, [])

  const toggleSearch = useCallback(() => {
    setIsSearchVisible(prev => {
        if (!prev) setTimeout(() => searchInputRef.current?.focus(), 100);
        return !prev;
    })
  }, [])

  const toggleFilters = useCallback(() => {
    setIsFilterVisible(prev => !prev)
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'grid' ? 'list' : 'grid')
  }, [])

  const handleViewExercise = useCallback((exercise: Exercise) => {
    router.push({
      pathname: '/exercise/[exerciseId]',
      params: { exerciseId: exercise.id },
    })
  }, [router])

  // FlashList render item
  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => {
      const isCurrentExercise = item.name === currentExerciseName // Should probably rely on ID but name is passed
      const isSelected = selectedIds.has(item.id)
      
      if (viewMode === 'list') {
          return (
            <ExerciseListItem
                exercise={item}
                isCurrentExercise={isCurrentExercise}
                isSelected={isSelected}
                onSelect={() => handleSelectExercise(item)}
                onInfo={() => handleViewExercise(item)}
                colors={colors}
            />
          )
      }
      
      return (
        <ExerciseGridItem
          exercise={item}
          isCurrentExercise={isCurrentExercise}
          isSelected={isSelected}
          onSelect={() => handleSelectExercise(item)}
          onInfo={() => handleViewExercise(item)}
          colors={colors}
        />
      )
    },
    [currentExerciseName, handleSelectExercise, handleViewExercise, colors, viewMode, selectedIds],
  )

  const keyExtractor = useCallback((item: Exercise) => item.id, [])

  // Create exercise header component (Only shows if search is active and no match)
  const ListHeader = useMemo(() => {
    if (!trimmedQuery || hasExactMatch || isLoading) return <View style={{ height: 16 }} />

    return (
      <View style={styles.createExerciseContainer}>
        <TouchableOpacity
          style={[
            styles.createExerciseItem,
            {
              backgroundColor: colors.primaryLight,
              borderColor: colors.primary,
            },
          ]}
          onPress={handleCreateExercise}
        >
          <Ionicons name="add-circle" size={24} color={colors.primary} />
          <View style={styles.exerciseItemContent}>
            <Text
              style={[styles.createExerciseText, { color: colors.primary }]}
            >
              Create &quot;{trimmedQuery}&quot;
            </Text>
            <Text
              style={[
                styles.cardSubtitle,
                { color: colors.textSecondary },
              ]}
            >
              New exercise
            </Text>
          </View>
          {!isProMember && <ProBadge size="small" />}
        </TouchableOpacity>
      </View>
    )
  }, [
    trimmedQuery,
    hasExactMatch,
    isLoading,
    colors,
    handleCreateExercise,
    isProMember,
  ])

  // Empty state component
  const ListEmpty = useMemo(() => {
    if (isLoading) return null

    return (
      <EmptyState
        icon="barbell-outline"
        title="No exercises found"
        description={emptyStateText}
      />
    )
  }, [isLoading, colors, emptyStateText])

  return (
    <SlideInView
      style={{ flex: 1 }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Add exercises
          </Text>
          
          <View style={styles.headerRightButtons}>
             <TouchableOpacity style={styles.headerButton} onPress={toggleSearch}>
                <Ionicons name="search" size={24} color={isSearchVisible ? colors.primary : colors.text} />
             </TouchableOpacity>
             <TouchableOpacity style={styles.headerButton} onPress={toggleFilters}>
                <Ionicons name="filter" size={24} color={isFilterVisible ? colors.primary : colors.text} />
             </TouchableOpacity>
             <TouchableOpacity style={styles.headerButton} onPress={handleCreateExercise}>
                <Ionicons name="add" size={28} color={colors.text} />
             </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Search Input */}
        {isSearchVisible && (
            <View style={styles.searchContainer}>
                <TextInput
                    ref={searchInputRef}
                    style={[
                        styles.searchInput,
                        { backgroundColor: colors.backgroundLight, color: colors.text },
                    ]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search exercises..."
                    placeholderTextColor={colors.textPlaceholder}
                    autoCapitalize="words"
                />
            </View>
        )}

        {/* Expandable Filters */}
        {isFilterVisible && (
            <View style={styles.filtersWrapper}>
                 {/* Muscle Filter */}
                {muscleGroups.length > 0 && (
                    <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScrollView}
                    contentContainerStyle={styles.filterContainer}
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
                            styles.filterChip,
                            {
                                borderColor: colors.border,
                                backgroundColor: colors.backgroundLight,
                            },
                            isSelected && {
                                borderColor: colors.primary,
                                backgroundColor: colors.primaryLight,
                            },
                            ]}
                            onPress={() => toggleMuscleGroup(group)}
                        >
                            <Text
                            style={[
                                styles.filterChipText,
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

                {/* Equipment Filter */}
                {equipmentTypes.length > 0 && (
                    <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScrollView}
                    contentContainerStyle={styles.filterContainer}
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
                            styles.filterChip,
                            {
                                borderColor: colors.border,
                                backgroundColor: colors.backgroundLight,
                            },
                            isSelected && {
                                borderColor: colors.primary,
                                backgroundColor: colors.primaryLight,
                            },
                            ]}
                            onPress={() => toggleEquipment(type)}
                        >
                            <Text
                            style={[
                                styles.filterChipText,
                                { color: colors.textSecondary },
                                isSelected && { color: colors.primary },
                            ]}
                            >
                            {type}
                            </Text>
                        </TouchableOpacity>
                        )
                    })}
                    </ScrollView>
                )}
            </View>
        )}
        
        <View style={styles.sectionHeader}>
             <Text style={[styles.sectionTitle, { color: colors.text }]}>All Exercises</Text>
            <TouchableOpacity onPress={toggleViewMode}>
                 <Ionicons name={viewMode === 'list' ? "grid-outline" : "list-outline"} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
        </View>

        {/* Exercise List/Grid */}
        <View style={styles.listContainer}>
          <FlashList
            ref={listRef}
            key={viewMode} // Forces re-render when changing columns
            data={filteredExercises}
            extraData={[searchQuery, selectedIds.size, isLoading]} // Forces re-render on these state changes
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={viewMode === 'grid' ? 2 : 1}
            estimatedItemSize={viewMode === 'grid' ? 220 : 72}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{
              paddingBottom: keyboardHeight + 100, // Extra padding for FAB
              paddingHorizontal: 16,
            }}
          />
        </View>

        {/* Floating Confirm Button */}
        {selectedIds.size > 0 && (
            <View style={[styles.floatingButtonContainer, { paddingBottom: insets.bottom + 16 }]}>
                <TouchableOpacity
                    style={[styles.floatingButton, { backgroundColor: '#FFFFFF' }]}
                    onPress={handleConfirmSelection}
                    activeOpacity={0.9}
                >
                    <Text style={styles.floatingButtonText}>
                        Add {selectedIds.size} exercises
                    </Text>
                </TouchableOpacity>
            </View>
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
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
    flex: 1,
    marginLeft: 12,
  },
  headerRightButtons: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 12,
      marginTop: 8,
  },
  sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  filtersWrapper: {
      marginBottom: 8,
  },
  filterScrollView: {
    maxHeight: 36,
    marginBottom: 8,
  },
  filterContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
    alignSelf: 'center',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContainer: {
    flex: 1,
  },
  exerciseCard: {
    width: ITEM_WIDTH,
    marginRight: GAP,
    marginBottom: GAP,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImageContainer: {
      height: ITEM_WIDTH * 1.1, // 4:3 aspect ratio roughly
      backgroundColor: '#000',
      position: 'relative',
  },
  cardImage: {
      width: '100%',
      height: '100%',
  },
  cardOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 8,
  },
  iconButtonSmall: {
      width: 22,
      height: 22,
  },
  infoButton: {
      // No background - icon stands out on its own
  },
  selectionBadge: {
      // backgroundColor: '#fff',
      // borderRadius: 12,
  },
  listItemCheckbox: {
      padding: 4,
      marginRight: 4,
  },
  cardContent: {
      padding: 12,
  },
  cardTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
  },
  cardSubtitle: {
      fontSize: 12,
  },
  // List Item Styles
  exerciseListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      marginBottom: 8,
      borderRadius: 12,
  },
  exerciseListItemThumbnail: {
      width: 48,
      height: 48,
      borderRadius: 6,
      backgroundColor: '#fff',
      marginRight: 12,
  },
  exerciseListItemContent: {
      flex: 1,
      justifyContent: 'center',
  },
  exerciseListItemText: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 2,
  },
  exerciseListItemMuscle: {
      fontSize: 13,
  },
  createExerciseContainer: {
    marginBottom: 16,
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
  exerciseItemContent: {
    flex: 1,
  },
  floatingButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      // backgroundColor: 'transparent',
      alignItems: 'center',
  },
  floatingButton: {
      width: '100%',
      paddingVertical: 17,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
  },
  floatingButtonText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#000000',
      letterSpacing: -0.2,
  },
})
