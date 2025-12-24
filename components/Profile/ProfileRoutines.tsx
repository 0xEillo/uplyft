import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { WorkoutRoutineWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'

interface ProfileRoutinesProps {
  userId: string
}

export function ProfileRoutines({ userId }: ProfileRoutinesProps) {
  const colors = useThemedColors()
  const router = useRouter()
  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadRoutines = async () => {
      if (!userId) return
      try {
        const data = await database.workoutRoutines.getAll(userId)
        // Filter out archived routines if needed, though getAll usually handles it or returns all.
        // Assuming we want to show all active routines.
        const activeRoutines = data.filter((r) => !r.is_archived)
        setRoutines(activeRoutines)
      } catch (error) {
        console.error('Error loading routines:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRoutines()
  }, [userId])

  if (isLoading || routines.length === 0) {
    return null
  }

  const renderItem = ({ item }: { item: WorkoutRoutineWithDetails }) => {
    const exerciseCount = item.workout_routine_exercises?.length || 0
    const setCount =
      item.workout_routine_exercises?.reduce(
        (sum, ex) => sum + (ex.sets?.length || 0),
        0,
      ) || 0

    // Estimate duration
    const DEFAULT_REST_SECONDS = 90
    const SET_EXECUTION_SECONDS = 45
    const EXERCISE_TRANSITION_SECONDS = 30

    const totalRestSeconds =
      item.workout_routine_exercises?.reduce((sum, ex) => {
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
        ? `${estDurationHours}h ${estDurationMinsRemainder}m`
        : `${estDurationMinutes}min`

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.feedCardBackground,
            borderColor: colors.border,
          },
        ]}
        onPress={() =>
          router.push({
            pathname: '/routine-detail',
            params: { routineId: item.id },
          })
        }
      >
        <View style={styles.cardHeader}>
          <Text
            style={[styles.routineName, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textSecondary}
          />
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {estDurationString}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons
              name="barbell-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {setCount} sets
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const styles = createStyles(colors)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ROUTINES</Text>
      </View>

      <FlatList
        data={routines}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  )
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      marginBottom: 24,
    },
    header: {
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    listContent: {
      paddingHorizontal: 14,
      gap: 12,
    },
    card: {
      width: 200,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    routineName: {
      fontSize: 15,
      fontWeight: '600',
      flex: 1,
      marginRight: 8,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      fontSize: 12,
      fontWeight: '500',
    },
  })
