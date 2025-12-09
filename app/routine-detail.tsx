import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { SlideInView } from '@/components/slide-in-view'
import { getColors } from '@/constants/colors'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useCopyRoutine } from '@/hooks/useCopyRoutine'
import { database } from '@/lib/database'
import { WorkoutRoutineWithDetails } from '@/types/database.types'
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

export default function RoutineDetailScreen() {
  const { routineId } = useLocalSearchParams<{ routineId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const colors = getColors(isDark)
  const insets = useSafeAreaInsets()
  const { copyRoutine, isCopying } = useCopyRoutine()

  const [routine, setRoutine] = useState<WorkoutRoutineWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [shouldExit, setShouldExit] = useState(false)

  useEffect(() => {
    const loadRoutine = async () => {
      if (!routineId || !user) return

      try {
        setIsLoading(true)
        // Try to fetch directly by ID first since we might be viewing another user's routine
        const data = await database.workoutRoutines.getById(routineId)
        setRoutine(data)
      } catch (error) {
        console.error('Error loading routine:', error)
        // Fallback to getAll if getById fails (though getById should work now with RLS changes)
        try {
          const routines = await database.workoutRoutines.getAll(user.id)
          const found = routines.find((r) => r.id === routineId)
          if (found) {
            setRoutine(found)
          } else {
            Alert.alert('Error', 'Routine not found')
            router.back()
          }
        } catch (e) {
          console.error('Error fetching routines fallback:', e)
          Alert.alert('Error', 'Failed to load routine')
          router.back()
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadRoutine()
  }, [routineId, user, router])

  const handleBack = () => {
    setShouldExit(true)
  }

  const handleExitComplete = () => {
    router.back()
  }

  const handleStartRoutine = () => {
    if (!routine) {
      return
    }

    router.replace(
      `/(tabs)/create-post?selectedRoutineId=${
        routine.id
      }&refresh=${Date.now()}`,
    )
  }

  const handleEditRoutine = () => {
    if (!routine) return
    router.push(`/create-routine?routineId=${routine.id}`)
  }

  const handleSaveRoutine = async () => {
    if (!routine || !user) return

    try {
      const newRoutine = await copyRoutine(routine, user.id)
      Alert.alert('Success', 'Routine saved to your library!', [
        {
          text: 'View Routine',
          onPress: () => {
            // Navigate to the new routine
            router.push({
              pathname: '/routine-detail',
              params: { routineId: newRoutine.id },
            })
          },
        },
        {
          text: 'OK',
          style: 'cancel',
        },
      ])
    } catch (error) {
      console.error('Error saving routine copy:', error)
      Alert.alert('Error', 'Failed to save routine')
    }
  }

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!routine) return null

  const isOwner = user?.id === routine.user_id
  const exerciseCount = routine.workout_routine_exercises?.length || 0
  const setCount =
    routine.workout_routine_exercises?.reduce(
      (sum, ex) => sum + (ex.sets?.length || 0),
      0,
    ) || 0

  // Estimate duration
  const DEFAULT_REST_SECONDS = 90
  const SET_EXECUTION_SECONDS = 45
  const EXERCISE_TRANSITION_SECONDS = 30

  const totalRestSeconds =
    routine.workout_routine_exercises?.reduce((sum, ex) => {
      return (
        sum +
        (ex.sets?.reduce((setSum, set) => {
          return setSum + (set.rest_seconds ?? DEFAULT_REST_SECONDS)
        }, 0) || 0)
      )
    }, 0) || 0

  const totalSetExecutionSeconds = setCount * SET_EXECUTION_SECONDS
  const totalTransitionSeconds = exerciseCount * EXERCISE_TRANSITION_SECONDS

  const estDurationSeconds =
    totalSetExecutionSeconds + totalRestSeconds + totalTransitionSeconds
  const estDurationMinutes = Math.ceil(estDurationSeconds / 60)
  const estDurationHours = Math.floor(estDurationMinutes / 60)
  const estDurationMinsRemainder = estDurationMinutes % 60
  const estDurationString =
    estDurationHours > 0
      ? `${estDurationHours}h ${estDurationMinsRemainder}min`
      : `${estDurationMinutes}min`

  const formatRestTime = (seconds: number | null | undefined): string => {
    if (!seconds) return '1min 30s' // Default fallback
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}min ${secs}s`
  }

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
                <Ionicons name="arrow-back" size={26} color={colors.text} />
              </TouchableOpacity>
            </NavbarIsland>
          }
          centerContent={
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Routine
            </Text>
          }
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {/* Routine Info */}
          <View style={styles.infoSection}>
            <Text style={[styles.routineName, { color: colors.text }]}>
              {routine.name}
            </Text>
            <Text style={[styles.creatorName, { color: colors.textSecondary }]}>
              {isOwner ? 'Created by you' : 'Shared routine'}
            </Text>

            {/* Notes */}
            {routine.notes && (
              <Text style={[styles.notesText, { color: colors.textSecondary }]}>
                {routine.notes}
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

            {/* Action Button */}
            {isOwner ? (
              <TouchableOpacity
                style={[
                  styles.startButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleStartRoutine}
              >
                <Text style={styles.startButtonText}>Start Routine</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.startButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleSaveRoutine}
                disabled={isCopying}
              >
                {isCopying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.startButtonText}>
                    Save to My Routines
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Exercises List */}
          <View style={styles.exercisesSection}>
            <View style={styles.exercisesHeader}>
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                Exercises
              </Text>
              {isOwner && (
                <TouchableOpacity onPress={handleEditRoutine}>
                  <Text
                    style={[styles.editButtonText, { color: colors.primary }]}
                  >
                    Edit Routine
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {routine.workout_routine_exercises.map((routineExercise, index) => (
              <View
                key={routineExercise.id}
                style={[
                  styles.exerciseCard,
                  { backgroundColor: colors.feedCardBackground },
                ]}
              >
                <View style={styles.exerciseHeader}>
                  <Text
                    style={[styles.exerciseName, { color: colors.primary }]}
                  >
                    {routineExercise.exercise.name}
                  </Text>
                </View>

                {/* Sets */}
                <View style={styles.setsContainer}>
                  <View style={styles.setHeader}>
                    <Text
                      style={[
                        styles.colHeader,
                        { color: colors.textSecondary, width: 40 },
                      ]}
                    >
                      SET
                    </Text>
                    <Text
                      style={[
                        styles.colHeader,
                        {
                          color: colors.textSecondary,
                          flex: 1,
                          textAlign: 'center',
                        },
                      ]}
                    >
                      KG
                    </Text>
                    <Text
                      style={[
                        styles.colHeader,
                        {
                          color: colors.textSecondary,
                          flex: 1,
                          textAlign: 'center',
                        },
                      ]}
                    >
                      REPS
                    </Text>
                    <Text
                      style={[
                        styles.colHeader,
                        {
                          color: colors.textSecondary,
                          flex: 1,
                          textAlign: 'center',
                        },
                      ]}
                    >
                      REST
                    </Text>
                  </View>
                  {routineExercise.sets.map((set, setIndex) => (
                    <View key={set.id} style={styles.setRow}>
                      <Text
                        style={[styles.setNumber, { color: colors.warning }]}
                      >
                        {set.set_number}
                      </Text>
                      <Text style={[styles.setValue, { color: colors.text }]}>
                        -
                      </Text>
                      <Text style={[styles.setValue, { color: colors.text }]}>
                        {set.reps_min
                          ? `${set.reps_min}${
                              set.reps_max ? `-${set.reps_max}` : ''
                            }`
                          : '-'}
                      </Text>
                      <Text style={[styles.setValue, { color: colors.text }]}>
                        {set.rest_seconds !== null
                          ? formatRestTime(set.rest_seconds)
                          : '-'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SlideInView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  scrollView: {
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
  creatorName: {
    fontSize: 14,
    marginBottom: 12,
  },
  notesText: {
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
  miniChartContainer: {
    marginLeft: 'auto',
    width: 60,
    height: 60,
  },
  startButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  exerciseCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  setsContainer: {
    gap: 8,
  },
  setHeader: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  colHeader: {
    fontSize: 12,
    fontWeight: '500',
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
  },
  setNumber: {
    width: 40,
    fontWeight: '600',
  },
  setValue: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '500',
  },
})
