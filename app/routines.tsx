import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { WorkoutRoutineWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function RoutinesScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const router = useRouter()
  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadRoutines = async () => {
      if (!user?.id) return
      try {
        const data = await database.workoutRoutines.getAll(user.id)
        const activeRoutines = data.filter((r) => !r.is_archived)
        setRoutines(activeRoutines)
      } catch (error) {
        console.error('Error loading routines:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRoutines()
  }, [user?.id])

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
            size={20}
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <BaseNavbar
        leftContent={
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
            <Text style={{ fontSize: 17, color: colors.text }}>Back</Text>
          </TouchableOpacity>
        }
        centerContent={
          <NavbarIsland>
            <Text style={styles.headerTitle}>Routines</Text>
          </NavbarIsland>
        }
        rightContent={
          <TouchableOpacity
            onPress={() => router.push('/create-routine')}
            style={{ padding: 4 }}
          >
            <Ionicons name="add" size={28} color={colors.text} />
          </TouchableOpacity>
        }
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={routines}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No routines found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      padding: 20,
      gap: 12,
    },
    card: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    routineName: {
      fontSize: 17,
      fontWeight: '600',
      flex: 1,
      marginRight: 8,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 16,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statText: {
      fontSize: 14,
      fontWeight: '500',
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
  })
