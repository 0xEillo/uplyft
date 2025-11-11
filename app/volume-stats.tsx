import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import { router, Stack } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type TimeRange = '30D' | '3M' | '6M' | 'ALL'

interface MuscleGroupVolume {
  name: string
  sets: number
}

interface WeeklyVolumeData {
  weekStart: string
  muscleGroups: MuscleGroupVolume[]
}

interface SessionStats {
  totalSets: number
  totalWorkouts: number
  avgSetsPerWorkout: number
}

interface MuscleGroupData {
  muscleGroup: string
  volume: number
  percentage: number
}

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  Chest: '#FF6B6B',
  Back: '#4ECDC4',
  Shoulders: '#FFA07A',
  Biceps: '#98D8C8',
  Triceps: '#F4A460',
  Core: '#F7DC6F',
  Glutes: '#BB8FCE',
  Quads: '#45B7D1',
  Hamstrings: '#00B894',
  Calves: '#74B9FF',
  Cardio: '#EC7063',
}

export default function VolumeStatsScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const [timeRange, setTimeRange] = useState<TimeRange>('30D')
  const [isLoading, setIsLoading] = useState(true)
  const [weeklyData, setWeeklyData] = useState<WeeklyVolumeData[]>([])
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalSets: 0,
    totalWorkouts: 0,
    avgSetsPerWorkout: 0,
  })
  const [distribution, setDistribution] = useState<MuscleGroupData[]>([])

  const loadData = useCallback(async () => {
    if (!user?.id) return

    setIsLoading(true)
    try {
      const daysBack =
        timeRange === '30D'
          ? 30
          : timeRange === '3M'
          ? 90
          : timeRange === '6M'
          ? 180
          : undefined

      // Load all three data sets
      const [weeklyVol, stats, dist] = await Promise.all([
        database.stats.getWeeklyVolumeData(user.id, daysBack),
        database.stats.getSessionStats(user.id, daysBack),
        database.stats.getMuscleGroupDistribution(user.id, daysBack),
      ])

      setWeeklyData(weeklyVol)
      setSessionStats(stats)
      setDistribution(dist)
    } catch (error) {
      console.error('Error loading volume stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, timeRange])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatWeekLabel = (weekStart: string) => {
    const date = new Date(weekStart)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const styles = createStyles(colors)

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaView>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/explore?tab=progress')}
            style={styles.headerBackButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Training Volume</Text>
          <View style={styles.headerRightSpacer} />
        </View>

        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          {(['30D', '3M', '6M', 'ALL'] as TimeRange[]).map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.timeRangeButton,
                timeRange === range && styles.timeRangeButtonActive,
              ]}
              onPress={() => setTimeRange(range)}
            >
              <Text
                style={[
                  styles.timeRangeText,
                  timeRange === range && styles.timeRangeTextActive,
                ]}
              >
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1: Session Stats */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                <Ionicons name="stats-chart" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Workout Summary</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{sessionStats.totalSets}</Text>
                <Text style={styles.statLabel}>Total Sets</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {sessionStats.totalWorkouts}
                </Text>
                <Text style={styles.statLabel}>Workouts</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {sessionStats.avgSetsPerWorkout}
                </Text>
                <Text style={styles.statLabel}>Avg Sets/Workout</Text>
              </View>
            </View>
          </View>

          {/* Section 2: Volume by Muscle Group */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                <Ionicons name="bar-chart" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Total Sets by Muscle Group</Text>
            </View>

            {weeklyData.length === 0 ? (
              <Text style={styles.emptyText}>No workout data for this period</Text>
            ) : (
              <View style={styles.volumeChartContainer}>
                <View style={styles.muscleGroupBars}>
                  {(() => {
                    // Aggregate all muscle groups across all weeks
                    const muscleGroupTotals = new Map<string, number>()

                    weeklyData.forEach((week) => {
                      week.muscleGroups.forEach((mg) => {
                        const current = muscleGroupTotals.get(mg.name) || 0
                        muscleGroupTotals.set(mg.name, current + mg.sets)
                      })
                    })

                    // Convert to array and sort by volume
                    const sortedMuscleGroups = Array.from(muscleGroupTotals.entries())
                      .map(([name, sets]) => ({ name, sets }))
                      .sort((a, b) => b.sets - a.sets)

                    const maxSets = Math.max(...sortedMuscleGroups.map((mg) => mg.sets))

                    return sortedMuscleGroups.map((mg, index) => {
                      const barHeight = (mg.sets / maxSets) * 100
                      return (
                        <View
                          key={index}
                          style={styles.muscleGroupBarContainer}
                        >
                          <Text style={styles.setCount}>{mg.sets}</Text>
                          <View
                            style={[
                              styles.muscleGroupBar,
                              {
                                height: `${barHeight}%`,
                                backgroundColor:
                                  MUSCLE_GROUP_COLORS[mg.name] ||
                                  colors.primary,
                              },
                            ]}
                          />
                          <Text style={styles.muscleGroupName}>
                            {mg.name}
                          </Text>
                        </View>
                      )
                    })
                  })()}
                </View>
              </View>
            )}
          </View>

          {/* Section 3: Volume Distribution */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                <Ionicons name="body" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Volume Distribution</Text>
            </View>

            {distribution.length === 0 ? (
              <Text style={styles.emptyText}>
                No distribution data for this period
              </Text>
            ) : (
              <View style={styles.distributionContainer}>
                {distribution.map((item, index) => (
                  <View key={index} style={styles.distributionRow}>
                    <View style={styles.distributionLabelRow}>
                      <View
                        style={[
                          styles.colorDot,
                          {
                            backgroundColor:
                              MUSCLE_GROUP_COLORS[item.muscleGroup] ||
                              colors.primary,
                          },
                        ]}
                      />
                      <Text style={styles.distributionLabel}>
                        {item.muscleGroup}
                      </Text>
                    </View>
                    <View style={styles.distributionBarContainer}>
                      <View
                        style={[
                          styles.distributionBar,
                          {
                            width: `${item.percentage}%`,
                            backgroundColor:
                              MUSCLE_GROUP_COLORS[item.muscleGroup] ||
                              colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.distributionPercentage}>
                      {item.percentage}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.white,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBackButton: {
      padding: 4,
      marginLeft: -4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    headerRightSpacer: {
      width: 32,
    },
    timeRangeContainer: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    timeRangeButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.backgroundLight,
      alignItems: 'center',
    },
    timeRangeButtonActive: {
      backgroundColor: colors.primary,
    },
    timeRangeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    timeRangeTextActive: {
      color: colors.white,
    },
    scrollView: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    cardIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    statBox: {
      flex: 1,
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 20,
    },
    volumeChartContainer: {
      paddingTop: 24,
    },
    muscleGroupBars: {
      flexDirection: 'row',
      gap: 8,
      height: 120,
      alignItems: 'flex-end',
    },
    muscleGroupBarContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      height: '100%',
    },
    muscleGroupBar: {
      width: '100%',
      minHeight: 8,
      borderRadius: 4,
      marginBottom: 4,
    },
    setCount: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    muscleGroupName: {
      fontSize: 10,
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    distributionContainer: {
      gap: 16,
    },
    distributionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    distributionLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      width: 100,
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    distributionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    distributionBarContainer: {
      flex: 1,
      height: 24,
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      overflow: 'hidden',
    },
    distributionBar: {
      height: '100%',
      borderRadius: 12,
    },
    distributionPercentage: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      width: 45,
      textAlign: 'right',
    },
  })
