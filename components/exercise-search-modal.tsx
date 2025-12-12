import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ExerciseMedia } from './ExerciseMedia'

interface ExerciseSearchModalProps {
  visible: boolean
  onClose: () => void
  onSelectExercise?: (exercise: Exercise) => void
  onMultiSelect?: (exercises: Exercise[]) => void
  multiSelect?: boolean
  currentExerciseName?: string
}

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
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [recentExercises, setRecentExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  
  // Multi-select state
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set())

  // Filters
  const [muscleGroups, setMuscleGroups] = useState<string[]>([])
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([])
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>([])
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])

  const translateY = useSharedValue(0)
  const isKeyboardVisible = useSharedValue(false)
  const styles = createStyles(colors, insets)

  const trimmedQuery = searchQuery.trim()
  const normalizedQuery = trimmedQuery.toLowerCase()

  const hasExactMatch = trimmedQuery
    ? exercises.some(
        (exercise) => exercise.name.toLowerCase() === normalizedQuery,
      )
    : false

  const hasFilters =
    selectedMuscleGroups.length > 0 || selectedEquipment.length > 0

  const filteredExercises = useMemo(() => {
    return exercises.filter((exercise) => {
      // Name filter
      if (
        normalizedQuery &&
        !exercise.name.toLowerCase().includes(normalizedQuery)
      ) {
        return false
      }

      // Muscle group filter
      if (selectedMuscleGroups.length > 0) {
        if (
          !exercise.muscle_group ||
          !selectedMuscleGroups.includes(exercise.muscle_group)
        ) {
          return false
        }
      }

      // Equipment filter
      if (selectedEquipment.length > 0) {
        let matches = false
        
        // Check single equipment field
        if (exercise.equipment && selectedEquipment.includes(exercise.equipment)) {
          matches = true
        }
        
        // Check equipments array field
        if (!matches && exercise.equipments && Array.isArray(exercise.equipments)) {
          matches = exercise.equipments.some(eq => selectedEquipment.includes(eq))
        }

        if (!matches) {
          return false
        }
      }

      return true
    })
  }, [exercises, normalizedQuery, selectedMuscleGroups, selectedEquipment])

  const emptyStateText = (() => {
    if (trimmedQuery) {
      return hasFilters
        ? `No exercises found for "${trimmedQuery}" with selected filters`
        : `No exercises found for "${trimmedQuery}"`
    }
    if (hasFilters) {
      return 'No exercises match the selected filters'
    }
    return 'Start typing to search or use filters'
  })()

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

  // Initial Data Load
  useEffect(() => {
    if (!visible) {
      setSearchQuery('')
      // Don't clear exercises to keep cache
      setSelectedMuscleGroups([])
      setSelectedEquipment([])
      setSelectedExerciseIds(new Set()) // Clear selection on close/re-open? Or keep? Usually clear.
      Keyboard.dismiss()
      return
    }

    const loadData = async () => {
      if (exercises.length > 0) return // Already loaded

      try {
        setIsLoading(true)
        // Fetch exercises and recent history
        // Derive filters from the actual exercises to ensure consistency
        const [allExercises, recent] = await Promise.all([
          database.exercises.getAll(),
          user ? database.exercises.getRecent(user.id) : Promise.resolve([]),
        ])

        setExercises(allExercises)
        setRecentExercises(recent)

        // Derive muscle groups
        const muscles = Array.from(
          new Set(
            allExercises
              .map((e) => e.muscle_group)
              .filter((m) => !!m),
          ),
        ).sort() as string[]
        setMuscleGroups(muscles)

        // Derive equipment (checking both legacy 'equipment' and new 'equipments' array)
        const equipmentSet = new Set<string>()
        allExercises.forEach((e) => {
          if (e.equipment) equipmentSet.add(e.equipment)
          if (e.equipments && Array.isArray(e.equipments)) {
            e.equipments.forEach((eq) => equipmentSet.add(eq))
          }
        })
        setEquipmentTypes(Array.from(equipmentSet).sort())

      } catch (error) {
        console.error('Error loading exercise data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [visible, user])

  const handleInfoPress = (exerciseId: string) => {
    Haptics.selectionAsync()
    // Close the modal before navigating to ensure clean state when returning
    onClose()
    router.push(`/exercise/${exerciseId}`)
  }

  const closeSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const handleBackdropPress = useCallback(() => {
    // If keyboard is visible, dismiss it first instead of closing sheet
    if (keyboardHeight > 0) {
      Keyboard.dismiss()
    } else {
      closeSheet()
    }
  }, [keyboardHeight])

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
        // If keyboard is visible, dismiss it first instead of closing sheet
        if (isKeyboardVisible.value) {
          translateY.value = withSpring(0, { damping: 20, stiffness: 300 })
          runOnJS(dismissKeyboard)()
        } else {
          translateY.value = withTiming(500, { duration: 200 }, () => {
            runOnJS(closeSheet)()
          })
        }
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
      Haptics.selectionAsync()
      
      if (multiSelect) {
        setSelectedExerciseIds(prev => {
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
    [onSelectExercise, onClose, multiSelect],
  )
  
  const handleDone = () => {
    if (multiSelect && onMultiSelect) {
      const selected = exercises.filter(e => selectedExerciseIds.has(e.id))
      if (selected.length > 0) {
          onMultiSelect(selected)
      }
      onClose()
    }
  }

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
      setExercises((prev) => {
        if (prev.some((e) => e.id === newExercise.id)) return prev
        return [newExercise, ...prev]
      })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      handleSelectExercise(newExercise)
    } catch (error) {
      console.error('Error creating exercise:', error)
      Alert.alert('Error', 'Failed to create exercise.')
    } finally {
      setIsCreating(false)
    }
  }, [trimmedQuery, isCreating, user, handleSelectExercise])

  const toggleMuscleGroup = (group: string) => {
    Haptics.selectionAsync()
    setSelectedMuscleGroups((prev) =>
      prev.includes(group) ? prev.filter((i) => i !== group) : [...prev, group],
    )
  }

  const toggleEquipment = (type: string) => {
    Haptics.selectionAsync()
    setSelectedEquipment((prev) =>
      prev.includes(type) ? prev.filter((i) => i !== type) : [...prev, type],
    )
  }
  
  const renderExerciseItem = (exercise: Exercise) => {
      const isSelected = multiSelect 
        ? selectedExerciseIds.has(exercise.id)
        : exercise.name === currentExerciseName
      
      return (
        <View
          key={exercise.id}
          style={[styles.row, isSelected && styles.rowSelected]}
        >
          <TouchableOpacity
            style={styles.rowContentContainer}
            onPress={() => handleSelectExercise(exercise)}
          >
            <View style={styles.rowContent}>
              {exercise.gif_url && (
                <ExerciseMedia
                  gifUrl={exercise.gif_url}
                  mode="thumbnail"
                  style={styles.exerciseThumbnail}
                  autoPlay={false}
                />
              )}
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text
                  style={[
                    styles.rowTitle,
                    isSelected && styles.rowTitleSelected,
                  ]}
                >
                  {exercise.name}
                </Text>
                <View style={styles.rowMeta}>
                  {exercise.muscle_group && (
                    <Text style={styles.rowSubtitle}>
                      {exercise.muscle_group}
                    </Text>
                  )}
                  {exercise.muscle_group && exercise.equipment && (
                    <Text style={styles.rowDot}>•</Text>
                  )}
                  {exercise.equipment && (
                    <Text style={styles.rowSubtitle}>
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
                name="checkmark-circle" // Used circle check for better visibility
                size={24}
                color={colors.primary}
                style={styles.checkIcon}
              />
            )}
            <TouchableOpacity
              onPress={() => handleInfoPress(exercise.id)}
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
  }

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
              animatedStyle,
              { paddingBottom: Math.max(insets.bottom, keyboardHeight) },
            ]}
          >
            <View style={styles.sheetHandle}>
              <View style={styles.handle} />
            </View>

            <View style={styles.header}>
              <View style={styles.headerLeftSpacer} />
              <Text style={styles.title}>Select Exercise</Text>
              <View style={styles.headerRight}>
                  {multiSelect && selectedExerciseIds.size > 0 && (
                      <TouchableOpacity onPress={handleDone}>
                          <Text style={styles.classesDoneText}>Done ({selectedExerciseIds.size})</Text>
                      </TouchableOpacity>
                  )}
              </View>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color={colors.textTertiary}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
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
              {/* Muscle Groups */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
                style={styles.filterRow}
              >
                <Text style={styles.filterLabel}>Muscles:</Text>
                {muscleGroups.map((group) => {
                  const isSelected = selectedMuscleGroups.includes(group)
                  return (
                    <TouchableOpacity
                      key={group}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => toggleMuscleGroup(group)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextActive,
                        ]}
                      >
                        {group}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              {/* Equipment */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
                style={styles.filterRow}
              >
                <Text style={styles.filterLabel}>Equipment:</Text>
                {equipmentTypes.map((type) => {
                  const isSelected = selectedEquipment.includes(type)
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => toggleEquipment(type)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>

            {/* List */}
            {isLoading && exercises.length === 0 ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : filteredExercises.length === 0 &&
              !(!trimmedQuery && !hasFilters && recentExercises.length > 0) ? (
              <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>{emptyStateText}</Text>
                {trimmedQuery && !hasExactMatch && (
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleCreateExercise}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Text style={styles.createButtonText}>
                        Create "{trimmedQuery}"
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <ScrollView
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.listContent}
              >
                {trimmedQuery && !hasExactMatch && (
                  <TouchableOpacity
                    style={styles.createRow}
                    onPress={handleCreateExercise}
                  >
                    <View style={styles.createIcon}>
                      <Ionicons name="add" size={24} color={colors.white} />
                    </View>
                    <View>
                      <Text style={styles.createRowText}>
                        Create "{trimmedQuery}"
                      </Text>
                      <Text style={styles.createRowSubtext}>
                        New custom exercise
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Recent Exercises Section */}
                {!trimmedQuery && !hasFilters && recentExercises.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Recently Used</Text>
                    {recentExercises.map(renderExerciseItem)}
                    <Text style={styles.sectionHeader}>All Exercises</Text>
                  </View>
                )}

                {filteredExercises.map(renderExerciseItem)}
              </ScrollView>
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  insets: any,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    bottomSheet: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      height: '80%', // Fixed height for consistency
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
        width: 60, // approximate width of right button to balance title
    },
    headerRight: {
        minWidth: 60,
        alignItems: 'flex-end',
    },
    classesDoneText: {
        color: colors.primary,
        fontWeight: '600',
        fontSize: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
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
      color: colors.text,
      height: '100%',
    },
    filtersContainer: {
      marginBottom: 8,
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
      color: colors.textSecondary,
      marginRight: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.backgroundLight,
      marginRight: 8,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipActive: {
      backgroundColor: colors.primary + '15', // 10% opacity
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chipTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: 20,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
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
    rowSelected: {
      backgroundColor: colors.primary + '08',
    },
    rowContent: {
      flexDirection: 'row',
      alignItems: 'center',
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
      color: colors.text,
      marginBottom: 2,
    },
    rowTitleSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    rowMeta: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rowSubtitle: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    rowDot: {
      fontSize: 13,
      color: colors.textTertiary,
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
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    createButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: colors.primary + '15',
      borderRadius: 20,
    },
    createButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    createRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: colors.primary + '10',
      borderRadius: 12,
    },
    createIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    createRowText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    createRowSubtext: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    section: {
      marginTop: 8,
    },
    sectionHeader: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      paddingHorizontal: 20,
      paddingVertical: 8,
      backgroundColor: colors.backgroundLight,
    },
  })
