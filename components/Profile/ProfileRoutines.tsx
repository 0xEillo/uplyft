import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { haptic } from '@/lib/haptics'
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
    useWindowDimensions,
} from 'react-native'

interface ProfileRoutinesProps {
  userId: string
}

export function ProfileRoutines({ userId }: ProfileRoutinesProps) {
  const colors = useThemedColors()
  const router = useRouter()
  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { width } = useWindowDimensions()

  const CARD_WIDTH = width * 0.42
  const CARD_HEIGHT = 140

  useEffect(() => {
    const loadRoutines = async () => {
      if (!userId) return
      try {
        const data = await database.workoutRoutines.getAll(userId)
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

    const subtext = `${estDurationString} • ${setCount} sets`

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            backgroundColor: colors.feedCardBackground,
            borderColor: colors.border,
          },
        ]}
        activeOpacity={0.9}
        onPress={() => {
          haptic('light')
          router.push({
            pathname: '/routine/[routineId]',
            params: { routineId: item.id },
          })
        }}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: colors.background },
            ]}
          >
            <Ionicons
              name="albums-outline"
              size={20}
              color={colors.textSecondary}
            />
          </View>
        </View>

        <View style={styles.cardContent}>
          <Text
            style={[styles.cardLabel, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            ROUTINE
          </Text>
          <Text
            style={[styles.cardValue, { color: colors.text }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {item.name}
          </Text>
          <Text
            style={[styles.cardSubtext, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtext}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={routines}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + 12}
        snapToAlignment="start"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  listContent: {
    paddingHorizontal: 14,
    gap: 12,
    paddingBottom: 4, // Space for shadow
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    justifyContent: 'space-between',
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    marginTop: 8,
    flex: 1,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 20, // Slightly smaller than dashboard to accommodate 2 lines if needed
    fontWeight: '800',
    marginBottom: 2,
    lineHeight: 24,
  },
  cardSubtext: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
})
