import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { memo, useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

interface WorkoutCalendarCardProps {
  userId: string
}

/**
 * Workout calendar card showing current month with workout days highlighted
 * and current streak based on weekly workout goal
 */
export const WorkoutCalendarCard = memo(function WorkoutCalendarCard({
  userId,
}: WorkoutCalendarCardProps) {
  const colors = useThemedColors()
  const [isLoading, setIsLoading] = useState(true)
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set())
  const [currentStreak, setCurrentStreak] = useState(0)
  const [monthWorkoutCount, setMonthWorkoutCount] = useState(0)
  const [currentMonth] = useState(new Date())
  const [, setWeeklyGoal] = useState(2)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Load user profile to get weekly goal (default to 2)
      const goal = 2 // TODO: Add weekly_workout_goal to Profile type
      setWeeklyGoal(goal)

      // Get first and last day of current month
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth()
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)

      // Fetch workout dates for the month
      const dates = await database.stats.getWorkoutDatesInRange(
        userId,
        firstDay,
        lastDay,
      )
      setWorkoutDates(new Set(dates))
      setMonthWorkoutCount(dates.length)

      // Calculate streak
      const { currentStreak: streak } = await database.stats.calculateStreak(
        userId,
        goal,
      )
      setCurrentStreak(streak)
    } catch (error) {
      console.error('Error loading workout calendar data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId, currentMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Generate calendar grid
  const generateCalendar = useCallback(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    // Get first day of month and calculate starting position
    const firstDay = new Date(year, month, 1)
    const startingDayOfWeek = firstDay.getDay() // 0 = Sunday

    // Get last day of month
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()

    // Generate array of day objects
    const days: {
      date: number | null
      dateStr: string | null
      isCurrentMonth: boolean
    }[] = []

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: null, dateStr: null, isCurrentMonth: false })
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ date: day, dateStr, isCurrentMonth: true })
    }

    return days
  }, [currentMonth])

  const calendar = generateCalendar()
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long' })
  const year = currentMonth.getFullYear()

  const styles = createStyles(colors)

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push('/workout-calendar')}
      activeOpacity={0.9}
    >
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name="calendar" size={24} color={colors.brandPrimary} />
          </View>
          <View>
            <Text style={styles.title}>Workout Calendar</Text>
            <Text style={styles.subtitle}>
              {monthName} {year} · {monthWorkoutCount} workout
              {monthWorkoutCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <>
          {/* Streak Display */}
          <View style={styles.streakContainer}>
            <Text style={styles.streakLabel}>Your streak</Text>
            <Text style={styles.streakValue}>
              {currentStreak > 0 ? (
                <>
                  {currentStreak} Week{currentStreak !== 1 ? 's' : ''}
                </>
              ) : (
                <>0 Weeks</>
              )}
            </Text>
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarContainer}>
            {/* Day headers */}
            <View style={styles.weekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <View key={index} style={styles.dayHeader}>
                  <Text style={styles.dayHeaderText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Calendar days */}
            <View style={styles.daysGrid}>
              {calendar.map((day, index) => {
                const hasWorkout = day.dateStr && workoutDates.has(day.dateStr)
                const isToday =
                  day.dateStr ===
                  new Date().toISOString().split('T')[0]

                return (
                  <View key={index} style={styles.dayCell}>
                    {day.date && (
                      <View
                        style={[
                          styles.dayNumber,
                          hasWorkout && styles.dayNumberWorkout,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            !day.isCurrentMonth && styles.dayTextOther,
                            hasWorkout && styles.dayTextWorkout,
                            isToday && styles.dayTextToday,
                          ]}
                        >
                          {day.date}
                        </Text>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          </View>

          {/* Empty state */}
          {monthWorkoutCount === 0 && (
            <View style={styles.emptyState}>
              <Ionicons
                name="barbell-outline"
                size={32}
                color={colors.textPlaceholder}
              />
              <Text style={styles.emptyText}>
                No workouts this month yet. Start your first workout!
              </Text>
            </View>
          )}
        </>
      )}

      {/* Info Modal - Bottom Sheet */}
    </TouchableOpacity>
  )
})

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surfaceCard,
      paddingVertical: 20,
      paddingHorizontal: 20,
      borderBottomWidth: 2,
      borderBottomColor: colors.bg,
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: `${colors.brandPrimary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    loadingContainer: {
      height: 300,
      justifyContent: 'center',
      alignItems: 'center',
    },
    streakContainer: {
      flexDirection: 'column',
      marginBottom: 12,
      gap: 2,
    },
    streakLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    streakValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    calendarContainer: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      padding: 12,
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    dayHeader: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
    },
    dayHeaderText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: `${100 / 7}%`,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    dayNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayNumberWorkout: {
      backgroundColor: colors.brandPrimarySoft,
    },
    dayText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    dayTextOther: {
      color: colors.textPlaceholder,
    },
    dayTextWorkout: {
      color: colors.brandPrimary,
      fontWeight: '600',
    },
    dayTextToday: {
      color: colors.brandPrimary,
      fontWeight: '700',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  })
