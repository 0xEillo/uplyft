import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { Paywall } from '@/components/paywall'
import { RoutineExerciseCard } from '@/components/RoutineExerciseCard'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import {
  ExploreRoutineWithExercises,
  WorkoutRoutineWithDetails,
} from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type RoutineSource = 'user' | 'explore'

interface NormalizedRoutine {
  id: string
  name: string
  description: string | null
  imagePath: string | null
  tintColor: string | null
  exercises: NormalizedExercise[]
  source: RoutineSource
  isOwner: boolean
  // Extra fields for user routines
  userRoutineId?: string
}

interface NormalizedExercise {
  id: string
  exerciseId: string
  name: string
  gifUrl: string | null
  sets: NormalizedSet[]
  orderIndex: number
}

interface NormalizedSet {
  id: string
  setNumber: number
  repsMin: number | null
  repsMax: number | null
  restSeconds: number | null
}

export default function RoutineDetailScreen() {
  const { routineId } = useLocalSearchParams<{ routineId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { isProMember } = useSubscription()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()

  const [routine, setRoutine] = useState<NormalizedRoutine | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [shouldExit, setShouldExit] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)

  // Tint color based on routine index for visual variety
  const tintColors = ['#A3E635', '#22D3EE', '#94A3B8', '#F0ABFC', '#FB923C']
  const routineIndex = routineId ? String(routineId).length : 0
  const defaultTintColor = tintColors[routineIndex % tintColors.length]

  useEffect(() => {
    loadRoutine()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadRoutine changes don't need to trigger refetch
  }, [routineId, user])

  const loadRoutine = async () => {
    if (!routineId) return

    try {
      setIsLoading(true)

      // First, try to load from user's routines (they own it or it's saved)
      if (user) {
        try {
          const userRoutine = await database.workoutRoutines.getById(routineId)
          if (userRoutine) {
            setRoutine(normalizeUserRoutine(userRoutine, user.id))
            return
          }
        } catch {
          // Not found in user routines, continue to check explore
        }
      }

      // Try to load from explore routines
      try {
        const exploreRoutine = await database.explore.getRoutineById(routineId)
        if (exploreRoutine) {
          setRoutine(normalizeExploreRoutine(exploreRoutine))
          return
        }
      } catch {
        // Not found in explore either
      }

      Alert.alert('Error', 'Routine not found')
      router.back()
    } catch (error) {
      console.error('Error loading routine:', error)
      Alert.alert('Error', 'Failed to load routine')
      router.back()
    } finally {
      setIsLoading(false)
    }
  }

  const normalizeUserRoutine = (
    r: WorkoutRoutineWithDetails,
    userId: string,
  ): NormalizedRoutine => ({
    id: r.id,
    name: r.name,
    description: r.notes,
    imagePath: r.image_path,
    tintColor: r.tint_color,
    source: 'user',
    isOwner: r.user_id === userId,
    userRoutineId: r.id,
    exercises: (r.workout_routine_exercises || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((ex) => ({
        id: ex.id,
        exerciseId: ex.exercise_id,
        name: ex.exercise?.name || 'Unknown Exercise',
        gifUrl: ex.exercise?.gif_url || null,
        orderIndex: ex.order_index,
        sets: (ex.sets || [])
          .sort((a, b) => a.set_number - b.set_number)
          .map((s) => ({
            id: s.id,
            setNumber: s.set_number,
            repsMin: s.reps_min,
            repsMax: s.reps_max,
            restSeconds: s.rest_seconds,
          })),
      })),
  })

  const normalizeExploreRoutine = (
    r: ExploreRoutineWithExercises,
  ): NormalizedRoutine => ({
    id: r.id,
    name: r.name,
    description: r.description,
    imagePath: r.image_url,
    tintColor: null,
    source: 'explore',
    isOwner: false,
    exercises: (r.exercises || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((ex) => ({
        id: ex.id,
        exerciseId: ex.exercise_id,
        name: ex.exercise?.name || 'Unknown Exercise',
        gifUrl: ex.exercise?.gif_url || null,
        orderIndex: ex.order_index,
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          id: `${ex.id}-set-${i + 1}`,
          setNumber: i + 1,
          repsMin: ex.reps_min,
          repsMax: ex.reps_max,
          restSeconds: null,
        })),
      })),
  })

  const handleBack = () => {
    setShouldExit(true)
  }

  const handleExitComplete = () => {
    router.back()
  }

  const handleStartRoutine = () => {
    if (!routine?.userRoutineId) return

    // 1. Reset everything: Clear the modal stack (RoutineDetail -> Routines -> Explore)
    // This returns us to the root tab navigator level.
    router.dismissAll()

    // 2. Perform the "cleansing" jump to Profile, then to the logger.
    // We use small delays to ensure the navigator state settles between transitions.
    setTimeout(() => {
      router.navigate('/(tabs)/profile')

      setTimeout(() => {
        router.navigate({
          pathname: '/(tabs)/create-post',
          params: {
            selectedRoutineId: routine.userRoutineId,
            refresh: Date.now().toString(),
          },
        })
      }, 50)
    }, 100)
  }

  const handleEditRoutine = () => {
    if (!routine?.userRoutineId) return
    router.push(`/create-routine?routineId=${routine.userRoutineId}`)
  }

  const handleDeleteRoutine = async () => {
    if (!routine?.userRoutineId) return

    Alert.alert(
      'Delete Routine',
      `Are you sure you want to delete "${routine.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.workoutRoutines.delete(routine.userRoutineId!)
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              )
              Alert.alert('Success', 'Routine deleted successfully')
              router.back()
            } catch (error) {
              console.error('Error deleting routine:', error)
              Alert.alert(
                'Error',
                'Failed to delete routine. Please try again.',
              )
            }
          },
        },
      ],
    )
  }

  const handleSaveRoutine = async () => {
    if (!user || !routine) return

    try {
      setIsSaving(true)
      const savedRoutine = await database.explore.saveRoutineToUser(
        routine.id,
        user.id,
      )
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Success', 'Routine saved to your library!', [
        {
          text: 'View Routine',
          onPress: () => {
            // Navigate to the saved copy
            router.replace({
              pathname: '/routine/[routineId]',
              params: { routineId: savedRoutine.id },
            })
          },
        },
        { text: 'OK', style: 'cancel' },
      ])
    } catch (error) {
      console.error('Error saving routine:', error)
      Alert.alert('Error', 'Failed to save routine')
    } finally {
      setIsSaving(false)
    }
  }

  const handleExercisePress = (exerciseId: string) => {
    router.push({
      pathname: '/exercise/[exerciseId]',
      params: { exerciseId },
    })
  }

  const getImageUrl = () => {
    if (!routine?.imagePath) return null
    if (routine.imagePath.startsWith('http')) return routine.imagePath
    return getRoutineImageUrl(routine.imagePath)
  }

  // Calculate stats
  const exerciseCount = routine?.exercises?.length || 0
  const setCount =
    routine?.exercises?.reduce((sum, ex) => sum + ex.sets.length, 0) || 0

  // Estimate duration
  const estDurationMinutes = Math.ceil(setCount * 2.5 + exerciseCount * 0.5)
  const estDurationString =
    estDurationMinutes >= 60
      ? `${Math.floor(estDurationMinutes / 60)}h ${estDurationMinutes % 60}min`
      : `${estDurationMinutes}min`

  const tintColor = routine?.tintColor || defaultTintColor
  const styles = createStyles(colors, isDark)

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!routine) return null

  const imageUrl = getImageUrl()

  return (
    <SlideInView
      style={styles.container}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <BaseNavbar
          leftContent={
            <NavbarIsland>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
            </NavbarIsland>
          }
          centerContent={
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Routine
            </Text>
          }
          rightContent={
            routine.isOwner ? (
              <NavbarIsland>
                <TouchableOpacity
                  onPress={handleDeleteRoutine}
                  style={styles.actionButton}
                >
                  <Ionicons
                    name="trash-outline"
                    size={24}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </NavbarIsland>
            ) : undefined
          }
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Cover Image Section */}
          <View style={styles.coverContainer}>
            {imageUrl ? (
              <>
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.coverImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  priority="high"
                  transition={200}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                  style={styles.coverOverlay}
                />
                <View
                  style={[
                    styles.coverTint,
                    { backgroundColor: tintColor, opacity: 0.25 },
                  ]}
                />
              </>
            ) : (
              <LinearGradient
                colors={[`${tintColor}60`, `${tintColor}30`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.coverGradientOnly}
              />
            )}
          </View>

          {/* Routine Info */}
          <View style={styles.infoSection}>
            <Text style={[styles.routineName, { color: colors.text }]}>
              {routine.name}
            </Text>
            <Text
              style={[styles.creatorLabel, { color: colors.textSecondary }]}
            >
              {routine.isOwner
                ? 'Created by you'
                : routine.source === 'explore'
                ? 'Pro Routine'
                : 'Shared routine'}
            </Text>

            {/* Description */}
            {routine.description && (
              <Text
                style={[
                  styles.descriptionText,
                  { color: colors.textSecondary },
                ]}
              >
                {routine.description}
              </Text>
            )}

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {estDurationString}
                </Text>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Est Duration
                </Text>
              </View>
              <View
                style={[styles.statDivider, { backgroundColor: colors.border }]}
              />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {exerciseCount}
                </Text>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Exercises
                </Text>
              </View>
              <View
                style={[styles.statDivider, { backgroundColor: colors.border }]}
              />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {setCount}
                </Text>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Sets
                </Text>
              </View>
            </View>

            {/* Action Button - Different for pro vs non-pro */}
            {routine.source === 'user' ? (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleStartRoutine}
              >
                <Text style={styles.primaryButtonText}>Start Routine</Text>
              </TouchableOpacity>
            ) : routine.source === 'explore' && !isProMember ? (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() => setShowPaywall(true)}
              >
                <Ionicons
                  name="lock-closed"
                  size={18}
                  color="#FFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryButtonText}>Unlock</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                  isSaving && { opacity: 0.7 },
                ]}
                onPress={handleSaveRoutine}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Routine</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Exercises Section */}
          <View style={styles.exercisesSection}>
            <View style={styles.exercisesHeader}>
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                Exercises
              </Text>
              {routine.isOwner && (
                <TouchableOpacity onPress={handleEditRoutine}>
                  <Text
                    style={[styles.editButtonText, { color: colors.primary }]}
                  >
                    Edit Routine
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Show exercises - with locked state for non-pro explore routines */}
            {routine.source === 'explore' && !isProMember ? (
              <>
                {/* Show ALL exercises but with blurred text */}
                {routine.exercises.map((exercise) => (
                  <RoutineExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    locked={true}
                  />
                ))}

                {routine.exercises.length === 0 && (
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontStyle: 'italic',
                      marginTop: 8,
                    }}
                  >
                    No exercises found
                  </Text>
                )}
              </>
            ) : (
              <>
                {routine.exercises.map((exercise) => (
                  <RoutineExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    onExercisePress={handleExercisePress}
                  />
                ))}

                {routine.exercises.length === 0 && (
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontStyle: 'italic',
                      marginTop: 8,
                    }}
                  >
                    No exercises found
                  </Text>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Paywall Modal */}
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Unlock PRO Workout Routines"
        message="Access proven training routines with complete exercise details, sets, reps, and rest periods. Transform your workouts with professionally crafted programs."
      />
    </SlideInView>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButton: {
      zIndex: 1,
      padding: 4,
    },
    actionButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
    },
    coverContainer: {
      height: 180,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
    },
    coverImage: {
      width: '100%',
      height: '100%',
    },
    coverOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    coverTint: {
      ...StyleSheet.absoluteFillObject,
    },
    coverGradientOnly: {
      flex: 1,
    },
    infoSection: {
      paddingHorizontal: 16,
      paddingTop: 20,
      marginBottom: 24,
    },
    routineName: {
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 4,
    },
    creatorLabel: {
      fontSize: 14,
      marginBottom: 12,
    },
    descriptionText: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      marginBottom: 24,
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 12,
    },
    statDivider: {
      width: 1,
      height: 24,
      marginHorizontal: 8,
    },
    primaryButton: {
      flexDirection: 'row',
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    exercisesSection: {
      paddingHorizontal: 16,
    },
    exercisesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '500',
    },
    editButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
  })
