import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { Layout } from '@/constants/theme'
import { RoutineExerciseCard } from '@/components/RoutineExerciseCard'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useWorkoutComposer } from '@/contexts/workout-composer-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { hapticSuccess } from '@/lib/haptics'
import { buildStructuredDraftFromRoutineTemplate } from '@/lib/utils/routine-structured-draft'
import {
  ExploreRoutineWithExercises,
  WorkoutRoutineWithDetails,
} from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
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
  const { hasActiveSession, seedRoutine } = useWorkoutComposer()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const NAVBAR_HEIGHT = Layout.navbarHeight

  const [routine, setRoutine] = useState<NormalizedRoutine | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isStartingRoutine, setIsStartingRoutine] = useState(false)
  const [shouldExit, setShouldExit] = useState(false)

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

  const handleStartRoutine = async () => {
    if (!routine?.userRoutineId || isStartingRoutine) return

    const applyRoutine = async () => {
      setIsStartingRoutine(true)
      try {
        const structuredData = buildStructuredDraftFromRoutineTemplate(
          routine.exercises.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            orderIndex: exercise.orderIndex,
            sets: exercise.sets.map((set) => ({
              setNumber: set.setNumber,
              repsMin: set.repsMin,
              repsMax: set.repsMax,
              restSeconds: set.restSeconds,
            })),
          })),
        )

        seedRoutine({
          title: routine.name,
          structuredData,
          // Only keep a routine id link when it is resolvable in the current user's library.
          // Shared routines from another user should still start with full exercise structure.
          selectedRoutineId: routine.isOwner ? (routine.userRoutineId ?? null) : null,
          routineSource: 'route',
        })

        router.replace('/create-post')
      } catch (e) {
        console.error('Failed to pre-seed draft', e)
        Alert.alert('Error', 'Failed to start routine. Please try again.')
      } finally {
        setIsStartingRoutine(false)
      }
    }

    try {
      if (hasActiveSession) {
        Alert.alert(
          'Existing Workout',
          'Starting this routine will clear your current workout in progress. Do you want to continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              style: 'destructive',
              onPress: () => {
                void applyRoutine()
              },
            },
          ],
        )
      } else {
        await applyRoutine()
      }
    } catch (e) {
      console.error('Error checking draft status', e)
      await applyRoutine()
    }
  }

  const handleEditRoutine = () => {
    if (!routine?.userRoutineId) return
    router.push({
      pathname: '/create-routine',
      params: { routineId: routine.userRoutineId },
    })
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
              hapticSuccess()
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
      hapticSuccess()

      // Flip the in-memory routine to the user's freshly-saved copy so the
      // primary CTA becomes "Start Routine" immediately — no extra tap needed.
      setRoutine((prev) =>
        prev
          ? {
              ...prev,
              id: savedRoutine.id,
              source: 'user',
              isOwner: true,
              userRoutineId: savedRoutine.id,
            }
          : prev,
      )

      // Keep the URL in sync with the saved copy so deep-links / back-nav
      // resolve correctly without a visible navigation transition.
      router.setParams({ routineId: savedRoutine.id })
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

  const styles = createStyles(colors, isDark)

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </View>
    )
  }

  if (!routine) return null

  return (
    <SlideInView
      style={styles.container}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={styles.container}>
        <BlurredHeader>
          <BaseNavbar
            leftContent={
              <NavbarIsland>
                <TouchableOpacity
                  onPress={handleBack}
                  style={styles.backButton}
                >
                  <Ionicons
                    name="arrow-back"
                    size={24}
                    color={colors.textPrimary}
                  />
                </TouchableOpacity>
              </NavbarIsland>
            }
            centerContent={
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
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
                      color={colors.statusError}
                    />
                  </TouchableOpacity>
                </NavbarIsland>
              ) : undefined
            }
          />
        </BlurredHeader>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 20,
            paddingTop: insets.top + NAVBAR_HEIGHT,
          }}
          scrollIndicatorInsets={{ top: insets.top + NAVBAR_HEIGHT }}
          showsVerticalScrollIndicator={false}
        >
          {/* Routine Info */}
          <View style={styles.infoSection}>
            <Text style={[styles.routineName, { color: colors.textPrimary }]}>
              {routine.name}
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
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
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
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
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
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {setCount}
                </Text>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Sets
                </Text>
              </View>
            </View>

            {routine.source === 'user' ? (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.brandPrimary },
                  isStartingRoutine && { opacity: 0.7 },
                ]}
                onPress={handleStartRoutine}
                disabled={isStartingRoutine}
              >
                {isStartingRoutine ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Start Routine</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.brandPrimary },
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
              <Text style={styles.sectionTitle}>Exercises</Text>
              {routine.isOwner && (
                <TouchableOpacity onPress={handleEditRoutine}>
                  <Text style={styles.editButtonText}>Edit Routine</Text>
                </TouchableOpacity>
              )}
            </View>

            {routine.exercises.length === 0 ? (
              <Text style={styles.emptyText}>No exercises found</Text>
            ) : (
              <LiquidGlassSurface
                style={styles.exerciseListGlass}
                fallbackStyle={styles.exerciseListFallback}
                debugLabel="routine-exercise-list"
              >
                {routine.exercises.map((exercise, index) => (
                  <RoutineExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    onExercisePress={handleExercisePress}
                    asRow
                    isLast={index === routine.exercises.length - 1}
                  />
                ))}
              </LiquidGlassSurface>
            )}
          </View>
        </ScrollView>
      </View>

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
      backgroundColor: colors.bg,
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
    infoSection: {
      paddingHorizontal: 16,
      paddingTop: 16,
      marginBottom: 24,
    },
    routineName: {
      fontSize: 32,
      fontWeight: '900',
      marginBottom: 16,
      letterSpacing: -1,
    },
    descriptionText: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 24,
      fontWeight: '400',
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
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    exercisesSection: {
      paddingHorizontal: 16,
    },
    exercisesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: isDark ? 'rgba(255,255,255,0.38)' : colors.textTertiary,
    },
    editButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.brandPrimary,
    },
    exerciseListGlass: {
      borderRadius: 20,
      overflow: 'hidden',
    },
    exerciseListFallback: {
      backgroundColor: isDark
        ? 'rgba(26,26,28,0.94)'
        : 'rgba(255,255,255,0.94)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.4 : 0.08,
      shadowRadius: 20,
      elevation: 8,
    },
    emptyText: {
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 8,
    },
  })
