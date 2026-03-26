import { EmptyState } from '@/components/EmptyState'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import Body from '@/components/PatchedBodyHighlighter'
import { Paywall } from '@/components/paywall'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useTheme } from '@/contexts/theme-context'
import { useBodyDiagramGender } from '@/hooks/useBodyDiagramGender'
import { useExercises } from '@/hooks/useExercises'
import { useExerciseSelection } from '@/hooks/useExerciseSelection'
import { useFavoriteExercises } from '@/hooks/useFavoriteExercises'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { fuzzySearchExercises } from '@/lib/utils/fuzzy-search'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { FlashList, FlashListRef } from '@shopify/flash-list'
import {
  Link,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router'
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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

import { MUSCLE_CHIP_RENDER_DATA, MuscleChipRenderData } from '@/lib/muscle-mapping'

const SCREEN_WIDTH = Dimensions.get('window').width
const HORIZONTAL_PADDING = 8
const CARD_GAP = 8
const COLUMN_COUNT = 2
const GRID_ITEM_WIDTH =
  (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP) / COLUMN_COUNT
const MUSCLE_HIGHLIGHT_COLORS = ['#EF4444']
const MUSCLE_BORDER_COLOR = '#D1D5DB'

// Memoized exercise card for grid layout
const ExerciseGridItem = memo(function ExerciseGridItem({
  exercise,
  isCurrentExercise,
  isFavorited,
  isSelected,
  onSelect,
  onToggleFavorite,
  colors,
  isExploreMode,
}: {
  exercise: Exercise
  isCurrentExercise: boolean
  isFavorited: boolean
  isSelected: boolean
  onSelect: () => void
  onToggleFavorite: () => void
  colors: ReturnType<typeof useThemedColors>
  isExploreMode?: boolean
}) {
  const { isDark } = useTheme()

  return (
    <TouchableOpacity
      style={[
        styles.exerciseCard,
        {
          backgroundColor: isDark ? colors.rowTint : colors.surfaceCard,
          borderColor: colors.border,
        },
        isCurrentExercise && !isExploreMode && {
          borderColor: colors.brandPrimary,
          borderWidth: 2,
        },
        isSelected && !isExploreMode && {
          borderColor: colors.brandPrimary,
          borderWidth: 2,
          backgroundColor: colors.brandPrimary + '10',
        },
      ]}
      onPress={onSelect}
    >
      <View style={styles.cardImageContainer}>
        <ExerciseMediaThumbnail
          gifUrl={exercise.gif_url}
          style={styles.cardImage}
          isCustom={!!exercise.created_by}
        />
        {/* Overlay Icons */}
        <View style={styles.cardOverlay}>
          <TouchableOpacity
            style={[
              styles.overlayIconButton,
              isFavorited && styles.overlayIconButtonActive,
            ]}
            onPress={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isFavorited ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isFavorited ? colors.brandPrimary : '#FFFFFF'}
            />
          </TouchableOpacity>
          {!isExploreMode && (
            <View style={styles.cardOverlayRight}>
              <Link
                asChild
                href={{
                  pathname: '/exercise/[exerciseId]',
                  params: { exerciseId: exercise.id },
                }}
              >
                <TouchableOpacity
                  style={styles.infoButton}
                  onPress={(e) => {
                    e.stopPropagation()
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="information-circle"
                    size={22}
                    color={
                      exercise.created_by || !exercise.gif_url
                        ? '#FFFFFF'
                        : 'rgba(0,0,0,0.6)'
                    }
                  />
                </TouchableOpacity>
              </Link>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardContent}>
        <Text
          style={[
            styles.cardTitle,
            { color: colors.textPrimary },
            (isCurrentExercise || isSelected) && !isExploreMode && { color: colors.brandPrimary },
          ]}
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          {exercise.muscle_group && (
            <Text
              style={[styles.cardSubtitle, { color: colors.textSecondary }]}
            >
              {exercise.muscle_group}
            </Text>
          )}
          {exercise.created_by && (
            <View style={styles.customBadge}>
              <Text style={styles.customBadgeText}>Custom</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
})

const ExerciseListItem = memo(function ExerciseListItem({
  exercise,
  isCurrentExercise,
  isFavorited,
  isSelected,
  onSelect,
  onToggleFavorite,
  colors,
  isExploreMode,
}: {
  exercise: Exercise
  isCurrentExercise: boolean
  isFavorited: boolean
  isSelected: boolean
  onSelect: () => void
  onToggleFavorite: () => void
  colors: ReturnType<typeof useThemedColors>
  isExploreMode?: boolean
}) {
  const { isDark } = useTheme()
  const router = useRouter()

  return (
    <TouchableOpacity
      style={[
        styles.exerciseListItem,
        isDark && { backgroundColor: colors.rowTint },
      ]}
      onPress={onSelect}
      disabled={isCurrentExercise && !isExploreMode}
    >
      <ExerciseMediaThumbnail
        gifUrl={exercise.gif_url}
        style={styles.exerciseListItemThumbnail}
        isCustom={!!exercise.created_by}
      />
      <View style={styles.exerciseListItemContent}>
        <Text
          style={[
            styles.exerciseListItemText,
            { color: colors.textPrimary },
            (isCurrentExercise || isSelected) && !isExploreMode && {
              fontWeight: '600',
              color: colors.brandPrimary,
            },
          ]}
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
          {exercise.created_by && (
            <View style={styles.customBadge}>
              <Text style={styles.customBadgeText}>Custom</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.listItemActions}>
        <TouchableOpacity
          style={styles.listItemFavoriteButton}
          onPress={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={isFavorited ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={isFavorited ? colors.brandPrimary : colors.textTertiary}
          />
        </TouchableOpacity>
        {!isExploreMode && (
          <>
            <TouchableOpacity
              style={styles.listItemInfoButton}
              onPress={(e) => {
                e.stopPropagation()
                router.push({
                  pathname: '/exercise/[exerciseId]',
                  params: { exerciseId: exercise.id },
                })
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons
                name="information-circle-outline"
                size={22}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
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
                name={
                  isCurrentExercise || isSelected ? 'checkmark-circle' : 'add'
                }
                size={22}
                color={
                  isCurrentExercise || isSelected
                    ? colors.brandPrimary
                    : colors.textTertiary
                }
              />
            </TouchableOpacity>
          </>
        )}
        {isExploreMode && (
          <View style={[styles.listItemInfoButton, { paddingRight: 8 }]}>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
})

const MuscleFilterChip = memo(function MuscleFilterChip({
  chipData,
  isSelected,
  onToggle,
  brandPrimary,
}: {
  chipData: MuscleChipRenderData
  isSelected: boolean
  onToggle: (group: string) => void
  brandPrimary: string
}) {
  const bodyGender = useBodyDiagramGender()

  const handlePress = useCallback(() => {
    onToggle(chipData.group)
  }, [chipData.group, onToggle])

  return (
    <TouchableOpacity
      style={[
        styles.muscleChip,
        {
          borderColor: isSelected ? brandPrimary : 'transparent',
          backgroundColor: isSelected ? `${brandPrimary}15` : 'transparent',
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.muscleBodyContainer} pointerEvents="none">
        <View
          style={[
            styles.muscleBodyWrapper,
            { transform: [{ translateY: chipData.offsetY }] },
          ]}
        >
          <Body
            data={chipData.bodyData}
            gender={bodyGender}
            side={chipData.side}
            scale={chipData.scale}
            colors={MUSCLE_HIGHLIGHT_COLORS}
            border={MUSCLE_BORDER_COLOR}
          />
        </View>
      </View>
    </TouchableOpacity>
  )
})

export default function SelectExerciseScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const { currentExerciseName, initialSearchQuery, initialMuscleGroup, exploreMode } = useLocalSearchParams<{
    currentExerciseName?: string
    initialSearchQuery?: string
    initialMuscleGroup?: string
    exploreMode?: string
  }>()
  const { callCallback, clearCallback } = useExerciseSelection()
  const { isProMember } = useSubscription()
  const { user } = useAuth()

  const isExploreMode = exploreMode === 'true'

  // If currentExerciseName is present, we are selecting ONE exercise (e.g. replacing).
  // '__replace__' is used when we don't have a specific name to highlight, just want single-select mode.
  // Otherwise, we are adding exercises (Multi-select allowed).
  const isMultiSelect = !currentExerciseName && !isExploreMode
  const isReplaceMode = !!currentExerciseName

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '')
  const [isSearchVisible, setIsSearchVisible] = useState(!!initialSearchQuery || isExploreMode)
  const [isFilterVisible, setIsFilterVisible] = useState(false)

  // View mode state: 'grid' or 'list'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const searchInputRef = useRef<TextInput>(null)

  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const listRef = useRef<FlashListRef<Exercise>>(null)
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>(initialMuscleGroup ? [initialMuscleGroup] : [])
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [showOnlyMine, setShowOnlyMine] = useState(false)
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [shouldExit, setShouldExit] = useState(false)
  const insets = useSafeAreaInsets()
  const selectionCommittedRef = useRef(false)

  // Use cached exercises hook with recent exercises support
  const {
    exercises,
    recentExercises,
    muscleGroups,
    equipmentTypes,
    isLoading,
    loadExercises,
  } = useExercises({
    initialLoad: true,
    userId: user?.id,
  })
  const { favoriteExerciseIds, toggleFavoriteExercise } = useFavoriteExercises(
    user?.id,
  )

  // Refresh exercises when screen is focused (to pick up new creations)
  // Skip in explore mode - user is browsing, not adding to a workout, no need to re-fetch
  useFocusEffect(
    useCallback(() => {
      if (!isExploreMode) {
        loadExercises()
      }
    }, [loadExercises, isExploreMode]),
  )

  const trimmedQuery = searchQuery.trim()
  const deferredTrimmedQuery = useDeferredValue(trimmedQuery)
  const deferredSelectedMuscleGroups = useDeferredValue(selectedMuscleGroups)
  const deferredSelectedEquipment = useDeferredValue(selectedEquipment)
  const deferredShowOnlyMine = useDeferredValue(showOnlyMine)
  const deferredShowOnlyFavorites = useDeferredValue(showOnlyFavorites)
  const hasDeferredMuscleFilter = deferredSelectedMuscleGroups.length > 0
  const hasDeferredEquipmentFilter = deferredSelectedEquipment.length > 0
  const hasFilters =
    hasDeferredMuscleFilter ||
    hasDeferredEquipmentFilter ||
    deferredShowOnlyMine ||
    deferredShowOnlyFavorites

  const selectedMuscleGroupSet = useMemo(() => new Set(selectedMuscleGroups), [
    selectedMuscleGroups,
  ])
  const deferredSelectedMuscleSet = useMemo(
    () => new Set(deferredSelectedMuscleGroups),
    [deferredSelectedMuscleGroups],
  )
  const deferredSelectedEquipmentSet = useMemo(
    () => new Set(deferredSelectedEquipment),
    [deferredSelectedEquipment],
  )
  const visibleMuscleChips = useMemo(() => {
    const availableMuscleGroups = new Set(muscleGroups)
    return MUSCLE_CHIP_RENDER_DATA.filter((chip) =>
      availableMuscleGroups.has(chip.group),
    )
  }, [muscleGroups])
  // Debounced filtered results with fuzzy search
  const filteredExercises = useMemo(() => {
    let result = exercises

    // Apply fuzzy search filter (handles typos, plurals, word order)
    if (deferredTrimmedQuery) {
      result = fuzzySearchExercises(result, deferredTrimmedQuery)
    }

    // Apply muscle group filter
    if (hasDeferredMuscleFilter) {
      result = result.filter(
        (e) => e.muscle_group && deferredSelectedMuscleSet.has(e.muscle_group),
      )
    }

    // Apply equipment filter
    if (hasDeferredEquipmentFilter) {
      result = result.filter((e) => {
        if (e.equipment && deferredSelectedEquipmentSet.has(e.equipment)) {
          return true
        }
        if (e.equipments && Array.isArray(e.equipments)) {
          return e.equipments.some((eq) => deferredSelectedEquipmentSet.has(eq))
        }
        return false
      })
    }

    // Apply "Yours" filter - show only exercises created by current user
    if (deferredShowOnlyMine && user?.id) {
      result = result.filter((e) => e.created_by === user.id)
    }

    if (deferredShowOnlyFavorites) {
      result = result.filter((e) => favoriteExerciseIds.has(e.id))
    }

    return result
  }, [
    exercises,
    deferredTrimmedQuery,
    hasDeferredMuscleFilter,
    deferredSelectedMuscleSet,
    hasDeferredEquipmentFilter,
    deferredSelectedEquipmentSet,
    deferredShowOnlyMine,
    deferredShowOnlyFavorites,
    favoriteExerciseIds,
    user?.id,
  ])

  // Scroll to top when search results change
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false })
    })

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [
    deferredTrimmedQuery,
    deferredSelectedMuscleGroups,
    deferredSelectedEquipment,
    deferredShowOnlyMine,
    deferredShowOnlyFavorites,
    filteredExercises.length,
  ])

  const emptyStateText = useMemo(() => {
    if (deferredTrimmedQuery) {
      return hasFilters
        ? `No exercises found for "${deferredTrimmedQuery}" with selected filters`
        : `No exercises found for "${deferredTrimmedQuery}"`
    }
    if (hasFilters) {
      return 'No exercises match the selected filters'
    }
    return 'Start typing to search'
  }, [deferredTrimmedQuery, hasFilters])

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
      if (isExploreMode) {
        haptic('light')
        router.push({
          pathname: '/exercise/[exerciseId]',
          params: { exerciseId: exercise.id },
        })
        return
      }

      if (isMultiSelect) {
        haptic('light')
        setSelectedIds((prev) => {
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
        if (selectionCommittedRef.current) return
        selectionCommittedRef.current = true
        callCallback(exercise)
        router.back()
      }
    },
    [callCallback, router, isMultiSelect, isExploreMode],
  )

  const handleConfirmSelection = useCallback(() => {
    if (selectionCommittedRef.current || selectedIds.size === 0) return

    const selectedExercises = exercises.filter((e) => selectedIds.has(e.id))
    selectionCommittedRef.current = true
    callCallback(selectedExercises)
    router.back()
  }, [selectedIds, exercises, callCallback, router])

  const handleDeselectAll = useCallback(() => {
    haptic('light')
    setSelectedIds(new Set())
  }, [])

  const handleCreateExercise = useCallback(() => {
    const name = trimmedQuery
    haptic('light')

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
    haptic('light')
    if (!selectionCommittedRef.current && !isExploreMode) {
      clearCallback()
    }
    setShouldExit(true)
  }, [clearCallback, isExploreMode])

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
    setIsSearchVisible((prev) => {
      if (!prev) setTimeout(() => searchInputRef.current?.focus(), 100)
      return !prev
    })
  }, [])

  const toggleFilters = useCallback(() => {
    setIsFilterVisible((prev) => !prev)
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'))
  }, [])

  const handleToggleFavorite = useCallback(
    (exerciseId: string) => {
      haptic('light')
      void toggleFavoriteExercise(exerciseId)
    },
    [toggleFavoriteExercise],
  )

  // List render item
  const renderItem = useCallback(
    ({ item, index }: { item: Exercise | undefined; index: number }) => {
      if (!item) {
        return null
      }

      const isCurrentExercise = item.name === currentExerciseName // Should probably rely on ID but name is passed
      const isSelected = selectedIds.has(item.id)

      if (viewMode === 'list') {
        return (
          <ExerciseListItem
            exercise={item}
            isCurrentExercise={isCurrentExercise}
            isFavorited={favoriteExerciseIds.has(item.id)}
            isSelected={isSelected}
            onSelect={() => handleSelectExercise(item)}
            onToggleFavorite={() => handleToggleFavorite(item.id)}
            colors={colors}
            isExploreMode={isExploreMode}
          />
        )
      }

      return (
        <View
          style={[
            styles.gridItemWrapper,
            index % COLUMN_COUNT === 0
              ? styles.gridItemLeftColumn
              : styles.gridItemRightColumn,
          ]}
        >
          <ExerciseGridItem
            exercise={item}
            isCurrentExercise={isCurrentExercise}
            isFavorited={favoriteExerciseIds.has(item.id)}
            isSelected={isSelected}
            onSelect={() => handleSelectExercise(item)}
            onToggleFavorite={() => handleToggleFavorite(item.id)}
            colors={colors}
            isExploreMode={isExploreMode}
          />
        </View>
      )
    },
    [
      currentExerciseName,
      favoriteExerciseIds,
      handleSelectExercise,
      handleToggleFavorite,
      colors,
      viewMode,
      selectedIds,
      isExploreMode,
    ],
  )

  const keyExtractor = useCallback((item: Exercise) => item.id, [])

  // Filter recent exercises with the same criteria as main list
  const filteredRecentExercises = useMemo(() => {
    let result = recentExercises

    // Apply fuzzy search filter
    if (deferredTrimmedQuery) {
      result = fuzzySearchExercises(result, deferredTrimmedQuery)
    }

    // Apply muscle group filter
    if (hasDeferredMuscleFilter) {
      result = result.filter(
        (e) => e.muscle_group && deferredSelectedMuscleSet.has(e.muscle_group),
      )
    }

    // Apply equipment filter
    if (hasDeferredEquipmentFilter) {
      result = result.filter((e) => {
        if (e.equipment && deferredSelectedEquipmentSet.has(e.equipment)) {
          return true
        }
        if (e.equipments && Array.isArray(e.equipments)) {
          return e.equipments.some((eq) => deferredSelectedEquipmentSet.has(eq))
        }
        return false
      })
    }

    // Apply "Yours" filter
    if (deferredShowOnlyMine && user?.id) {
      result = result.filter((e) => e.created_by === user.id)
    }

    if (deferredShowOnlyFavorites) {
      result = result.filter((e) => favoriteExerciseIds.has(e.id))
    }

    return result
  }, [
    recentExercises,
    deferredTrimmedQuery,
    hasDeferredMuscleFilter,
    deferredSelectedMuscleSet,
    hasDeferredEquipmentFilter,
    deferredSelectedEquipmentSet,
    deferredShowOnlyMine,
    deferredShowOnlyFavorites,
    favoriteExerciseIds,
    user?.id,
  ])

  // Show recent performed section if there are matching recent exercises
  const shouldShowRecent = filteredRecentExercises.length > 0

  const listExtraData = useMemo(
    () => ({
      currentExerciseName,
      favoriteExerciseIds,
      selectedIds,
      viewMode,
      recentCount: filteredRecentExercises.length,
      shouldShowRecent,
    }),
    [
      currentExerciseName,
      favoriteExerciseIds,
      selectedIds,
      viewMode,
      filteredRecentExercises.length,
      shouldShowRecent,
    ],
  )

  // Create exercise header component (includes Recent Performed and All Exercises header)
  const ListHeader = useMemo(() => {
    // Recent Performed section
    const recentSection = shouldShowRecent ? (
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Recently Performed
          </Text>
          <TouchableOpacity onPress={toggleViewMode}>
            <Ionicons
              name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.recentScrollView}
          contentContainerStyle={styles.recentScrollContainer}
        >
          {filteredRecentExercises.map((exercise) => {
            const isCurrentExercise = exercise.name === currentExerciseName
            const isSelected = selectedIds.has(exercise.id)
            return (
              <View key={exercise.id} style={styles.recentItemWrapper}>
                <ExerciseGridItem
                  exercise={exercise}
                  isCurrentExercise={isCurrentExercise}
                  isFavorited={favoriteExerciseIds.has(exercise.id)}
                  isSelected={isSelected}
                  onSelect={() => handleSelectExercise(exercise)}
                  onToggleFavorite={() => handleToggleFavorite(exercise.id)}
                  colors={colors}
                  isExploreMode={isExploreMode}
                />
              </View>
            )
          })}
        </ScrollView>
      </View>
    ) : null

    // All Exercises section header
    const allExercisesHeader = (
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          All Exercises
        </Text>
        {/* Only show toggle here if Recent Performed is not visible */}
        {!shouldShowRecent && (
          <TouchableOpacity onPress={toggleViewMode}>
            <Ionicons
              name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
    )

    return (
      <View>
        {recentSection}
        {allExercisesHeader}
      </View>
    )
  }, [
    shouldShowRecent,
    filteredRecentExercises,
    currentExerciseName,
    selectedIds,
    favoriteExerciseIds,
    handleSelectExercise,
    handleToggleFavorite,
    viewMode,
    toggleViewMode,
    colors,
    isExploreMode,
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
  }, [isLoading, emptyStateText])

  const listContentContainerStyle = useMemo(
    () => ({
      paddingBottom: keyboardHeight + 100,
      paddingHorizontal: HORIZONTAL_PADDING,
    }),
    [keyboardHeight],
  )

  return (
    <SlideInView
      style={{ flex: 1 }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.bg, paddingTop: insets.top },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <LiquidGlassSurface style={styles.headerButtonGlass}>
            <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
              <Ionicons name={isExploreMode ? "chevron-back" : "close"} size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </LiquidGlassSurface>

          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {isExploreMode ? 'Exercises' : isReplaceMode ? 'Replace exercise' : 'Add exercises'}
          </Text>

          <View style={styles.headerRightButtons}>
            <LiquidGlassSurface style={styles.headerButtonGlass}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={toggleSearch}
              >
                <Ionicons
                  name="search"
                  size={24}
                  color={
                    isSearchVisible ? colors.brandPrimary : colors.textPrimary
                  }
                />
              </TouchableOpacity>
            </LiquidGlassSurface>
            <LiquidGlassSurface style={styles.headerButtonGlass}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={toggleFilters}
              >
                <Ionicons
                  name="filter"
                  size={24}
                  color={
                    isFilterVisible ? colors.brandPrimary : colors.textPrimary
                  }
                />
              </TouchableOpacity>
            </LiquidGlassSurface>
            <LiquidGlassSurface style={styles.headerButtonGlass}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleCreateExercise}
              >
                <Ionicons name="add" size={28} color={colors.textPrimary} />
              </TouchableOpacity>
            </LiquidGlassSurface>
          </View>
        </View>

        {/* Expandable Search Input */}
        {isSearchVisible && (
          <View style={styles.searchContainer}>
            <LiquidGlassSurface style={styles.searchGlass}>
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, { color: colors.textPrimary }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search exercises..."
                placeholderTextColor={colors.textPlaceholder}
                autoCapitalize="words"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => {
                    setSearchQuery('')
                    haptic('light')
                  }}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              )}
            </LiquidGlassSurface>
          </View>
        )}

        {/* Muscle Filter with Body Diagrams */}
        {visibleMuscleChips.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.muscleFilterScrollView}
            contentContainerStyle={styles.muscleFilterContainer}
          >
            {visibleMuscleChips.map((chipData) => (
              <MuscleFilterChip
                key={chipData.group}
                chipData={chipData}
                isSelected={selectedMuscleGroupSet.has(chipData.group)}
                onToggle={toggleMuscleGroup}
                brandPrimary={colors.brandPrimary}
              />
            ))}
          </ScrollView>
        )}

        {/* Expandable Equipment Filter */}
        {isFilterVisible && (
          <View style={styles.filtersWrapper}>
            {/* Yours Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScrollView}
              contentContainerStyle={styles.filterContainer}
            >
              <Text
                style={[styles.filterLabel, { color: colors.textSecondary }]}
              >
                Exercises:
              </Text>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSubtle,
                  },
                  showOnlyFavorites && {
                    borderColor: colors.brandPrimary,
                    backgroundColor: colors.brandPrimarySoft,
                  },
                ]}
                onPress={() => setShowOnlyFavorites(!showOnlyFavorites)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: colors.textSecondary },
                    showOnlyFavorites && { color: colors.brandPrimary },
                  ]}
                >
                  Favorites
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSubtle,
                  },
                  showOnlyMine && {
                    borderColor: colors.brandPrimary,
                    backgroundColor: colors.brandPrimarySoft,
                  },
                ]}
                onPress={() => setShowOnlyMine(!showOnlyMine)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: colors.textSecondary },
                    showOnlyMine && { color: colors.brandPrimary },
                  ]}
                >
                  Custom
                </Text>
              </TouchableOpacity>
            </ScrollView>

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
                          backgroundColor: colors.surfaceSubtle,
                        },
                        isSelected && {
                          borderColor: colors.brandPrimary,
                          backgroundColor: colors.brandPrimarySoft,
                        },
                      ]}
                      onPress={() => toggleEquipment(type)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: colors.textSecondary },
                          isSelected && { color: colors.brandPrimary },
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

        {/* Exercise List/Grid */}
        <View style={styles.listContainer}>
          <FlashList<Exercise>
            ref={listRef}
            key={viewMode}
            data={filteredExercises}
            extraData={listExtraData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={viewMode === 'grid' ? 2 : 1}
            estimatedItemSize={viewMode === 'grid' ? 220 : 72}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={listContentContainerStyle}
          />
        </View>

        {/* Floating Confirm Button */}
        {selectedIds.size > 0 && (
          <View
            style={[
              styles.floatingButtonContainer,
              { paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View style={styles.floatingButtonRow}>
              <TouchableOpacity
                style={[
                  styles.deselectAllButton,
                  { backgroundColor: '#FFFFFF' },
                ]}
                onPress={handleDeselectAll}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Deselect all"
              >
                <Ionicons
                  name="close-circle-outline"
                  size={22}
                  color="#EF4444"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.floatingButton, { backgroundColor: '#FFFFFF' }]}
                onPress={handleConfirmSelection}
                activeOpacity={0.9}
              >
                <Text
                  style={styles.floatingButtonText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  Add {selectedIds.size} exercises
                </Text>
              </TouchableOpacity>
            </View>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonGlass: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  searchGlass: {
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  clearSearchButton: {
    padding: 8,
    marginRight: 4,
  },
  filtersWrapper: {
    marginBottom: 8,
  },
  filterScrollView: {
    maxHeight: 44,
    marginBottom: 8,
  },
  filterContainer: {
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
    alignSelf: 'center',
  },
  filterChip: {
    flexDirection: 'row',
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
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gridItemWrapper: {
    width: GRID_ITEM_WIDTH,
    marginBottom: CARD_GAP,
  },
  gridItemLeftColumn: {
    marginRight: CARD_GAP / 2,
  },
  gridItemRightColumn: {
    marginLeft: CARD_GAP / 2,
  },
  cardImageContainer: {
    aspectRatio: 1 / 1.1,
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
  cardOverlayRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  overlayIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overlayIconButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  infoButton: {
    // No background - icon stands out on its own
  },
  listItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  listItemFavoriteButton: {
    padding: 4,
  },
  listItemInfoButton: {
    padding: 4,
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
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  floatingButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  floatingButton: {
    flex: 1,
    minWidth: 0,
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
  deselectAllButton: {
    flexShrink: 0,
    paddingVertical: 17,
    paddingHorizontal: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  // Recent Exercises Section Styles
  recentSection: {
    marginBottom: 0, // Using card's marginBottom
  },
  recentScrollView: {
    marginHorizontal: -HORIZONTAL_PADDING, // Bleed to edges
  },
  recentScrollContainer: {
    paddingHorizontal: HORIZONTAL_PADDING, // Align first card with content below
    paddingBottom: 0,
  },
  recentItemWrapper: {
    width: GRID_ITEM_WIDTH,
    marginRight: CARD_GAP,
  },
  // Muscle Filter Body Diagram Styles
  muscleFilterScrollView: {
    maxHeight: 100,
    flexGrow: 0,
    marginBottom: 0,
  },
  muscleFilterContainer: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    alignItems: 'center',
    gap: 2,
  },
  muscleChip: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  muscleBodyContainer: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  muscleBodyWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 120,
    height: 240,
    marginTop: -120,
    marginLeft: -60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customBadge: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 2,
  },
  customBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
})
