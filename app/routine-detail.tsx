import { SlideInView } from '@/components/slide-in-view'
import { getColors } from '@/constants/colors'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
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

  const [routine, setRoutine] = useState<WorkoutRoutineWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [shouldExit, setShouldExit] = useState(false)

  useEffect(() => {
    const loadRoutine = async () => {
      if (!routineId || !user) return

      try {
        setIsLoading(true)
        // We need to fetch the routine with details.
        // Assuming database.workoutRoutines.getById exists or we can use getAll and find.
        // Since getAll is cached/fast enough usually, or we might need to add getById.
        // Let's try to find it from getAll first as it's likely already loaded in previous screen,
        // but for deep linking support we should probably fetch it.
        // For now, let's use getAll(user.id) and find it, as that's what we have exposed in database.ts usually.
        // Actually, let's check if we have getById. If not, we'll use getAll.
        // Checking previous files, I saw database.workoutRoutines.getAll(user.id).
        // I'll assume for now we can fetch it. If not, I'll implement a fetch.

        // Wait, I should check database.ts first? No, I'll just try to use what I know.
        // Actually, better to be safe. I'll use getAll and find for now.
        const routines = await database.workoutRoutines.getAll(user.id)
        const found = routines.find((r) => r.id === routineId)

        if (found) {
          setRoutine(found)
        } else {
          Alert.alert('Error', 'Routine not found')
          router.back()
        }
      } catch (error) {
        console.error('Error loading routine:', error)
        Alert.alert('Error', 'Failed to load routine')
        router.back()
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
    if (!routine) return

    // Navigate back to create-post with the selected routine ID
    // We use router.push to replace the stack or ensure we go to the right place?
    // Actually, create-post is a tab. We should probably use router.navigate or router.push to the tab.
    // But since we are likely coming from create-post (via the sheet), we might want to just go back?
    // No, if we go back, we need to pass params.
    // router.navigate('/(tabs)/create-post', { selectedRoutineId: routine.id }) might work.
    // Let's try router.push for now, or router.replace if we want to clear this screen.
    router.dismissAll()
    router.push({
      pathname: '/(tabs)/create-post',
      params: { selectedRoutineId: routine.id },
    })
  }

  const handleEditRoutine = () => {
    if (!routine) return
    router.push(`/create-routine?routineId=${routine.id}`)
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

  const exerciseCount = routine.workout_routine_exercises?.length || 0
  const setCount =
    routine.workout_routine_exercises?.reduce(
      (sum, ex) => sum + (ex.sets?.length || 0),
      0,
    ) || 0

  // Calculate estimated duration using industry standard:
  // - 45 seconds per set for execution time
  // - Actual rest times from sets (default 90 seconds if not set)
  // - 30 seconds per exercise for transition time
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.background,
              paddingTop: insets.top + 10,
            },
          ]}
        >
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Routine
          </Text>
          <View style={{ width: 40 }} />
          {/* <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
            <Ionicons name="share-outline" size={24} color={colors.text} />
          </TouchableOpacity> */}
        </View>

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
              Created by you
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

            {/* Start Routine Button */}
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: colors.primary }]}
              onPress={handleStartRoutine}
            >
              <Text style={styles.startButtonText}>Start Routine</Text>
            </TouchableOpacity>
          </View>

          {/* Body Visualization (Full) - Optional, maybe just rely on the mini one or the list? 
              The design shows a large placeholder or chart. Let's use the MuscleSplitChart if it looks good, 
              or just the exercises list as the user asked for "visualize his routine (like in the image example)".
              The image shows a "No data yet" chart, probably for history. 
              I'll skip the history chart for now as we don't have history context here easily.
          */}

          {/* Exercises List */}
          <View style={styles.exercisesSection}>
            <View style={styles.exercisesHeader}>
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                Exercises
              </Text>
              <TouchableOpacity onPress={handleEditRoutine}>
                <Text
                  style={[styles.editButtonText, { color: colors.primary }]}
                >
                  Edit Routine
                </Text>
              </TouchableOpacity>
            </View>

            {routine.workout_routine_exercises.map((routineExercise, index) => (
              <View
                key={routineExercise.id}
                style={[
                  styles.exerciseCard,
                  { backgroundColor: colors.feedCardBackground },
                ]}
              >
                {/* We can reuse ExerciseDetailCard but we need to adapt the data structure 
                     or create a simple view here. ExerciseDetailCard expects WorkoutExerciseWithDetails.
                     Let's create a simple view to match the design more closely.
                 */}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  infoSection: {
    paddingHorizontal: 16,
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
