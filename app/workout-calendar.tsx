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

type ViewMode = 'month' | 'year' | 'multi-year'

export default function WorkoutCalendarScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [isLoading, setIsLoading] = useState(true)
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set())
  const [currentDate, setCurrentDate] = useState(new Date())

  const loadWorkoutDates = useCallback(async () => {
    if (!user?.id) return

    setIsLoading(true)
    try {
      // For now, load all workout dates for the year
      const year = currentDate.getFullYear()
      const startDate = new Date(year, 0, 1)
      const endDate = new Date(year, 11, 31)

      const dates = await database.stats.getWorkoutDatesInRange(
        user.id,
        startDate,
        endDate,
      )
      setWorkoutDates(new Set(dates))
    } catch (error) {
      console.error('Error loading workout dates:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, currentDate])

  useEffect(() => {
    loadWorkoutDates()
  }, [loadWorkoutDates])

  const renderMonthView = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // Get first day of month and calculate starting position
    const firstDay = new Date(year, month, 1)
    const startingDayOfWeek = firstDay.getDay()

    // Get last day of month
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()

    // Generate calendar days
    const days: Array<{
      date: number | null
      dateStr: string | null
      isCurrentMonth: boolean
    }> = []

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: null, dateStr: null, isCurrentMonth: false })
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ date: day, dateStr, isCurrentMonth: true })
    }

    const monthName = currentDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })

    return (
      <View style={styles.content}>
        <Text style={styles.monthTitle}>{monthName}</Text>

        {/* Day headers */}
        <View style={styles.weekRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
            (day, index) => (
              <View key={index} style={styles.dayHeaderLarge}>
                <Text style={styles.dayHeaderTextLarge}>{day}</Text>
              </View>
            ),
          )}
        </View>

        {/* Calendar grid */}
        <View style={styles.daysGrid}>
          {days.map((day, index) => {
            const hasWorkout = day.dateStr && workoutDates.has(day.dateStr)
            const isToday =
              day.dateStr === new Date().toISOString().split('T')[0]

            return (
              <View key={index} style={styles.dayCellLarge}>
                {day.date && (
                  <View
                    style={[
                      styles.dayNumberLarge,
                      hasWorkout && styles.dayNumberWorkout,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayTextLarge,
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
    )
  }

  const renderYearView = () => {
    const year = currentDate.getFullYear()
    const months = []

    for (let month = 0; month < 12; month++) {
      const monthName = new Date(year, month, 1).toLocaleDateString('en-US', {
        month: 'short',
      })

      // Generate mini calendar for this month
      const firstDay = new Date(year, month, 1)
      const startingDayOfWeek = firstDay.getDay()
      const lastDay = new Date(year, month + 1, 0)
      const daysInMonth = lastDay.getDate()

      const days = []
      // Empty cells before month starts
      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null)
      }
      // Days of month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        days.push({ day, hasWorkout: workoutDates.has(dateStr) })
      }

      months.push(
        <View key={month} style={styles.miniMonth}>
          <Text style={styles.miniMonthName}>{monthName}</Text>
          <View style={styles.miniGrid}>
            {days.map((dayData, index) => (
              <View key={index} style={styles.miniDay}>
                {dayData && (
                  <View
                    style={[
                      styles.miniDayBox,
                      dayData.hasWorkout && styles.miniDayWorkout,
                    ]}
                  />
                )}
              </View>
            ))}
          </View>
        </View>,
      )
    }

    return (
      <View style={styles.content}>
        <Text style={styles.yearTitle}>{year}</Text>
        <View style={styles.yearGrid}>{months}</View>
      </View>
    )
  }

  const renderMultiYearView = () => {
    const currentYear = currentDate.getFullYear()

    return (
      <View style={styles.content}>
        <Text style={styles.yearTitle}>{currentYear}</Text>
        <View style={styles.multiYearRow}>
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
            <Text key={idx} style={styles.multiYearMonth}>{month}</Text>
          ))}
        </View>
        <View style={styles.multiYearGrid}>
          {Array.from({ length: 365 }, (_, i) => {
            const date = new Date(currentYear, 0, 1)
            date.setDate(date.getDate() + i)
            const dateStr = date.toISOString().split('T')[0]
            const hasWorkout = workoutDates.has(dateStr)

            return (
              <View
                key={i}
                style={[
                  styles.multiYearDay,
                  hasWorkout && { backgroundColor: colors.primary },
                ]}
              />
            )
          })}
        </View>
      </View>
    )
  }

  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/analytics?tab=progress')}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Calendar</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      {/* View Mode Selector */}
      <View style={styles.viewModeSelectorContainer}>
        <View style={styles.viewModeSelector}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'month' && styles.viewModeButtonActive,
            ]}
            onPress={() => setViewMode('month')}
          >
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'month' && styles.viewModeTextActive,
              ]}
            >
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'year' && styles.viewModeButtonActive,
            ]}
            onPress={() => setViewMode('year')}
          >
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'year' && styles.viewModeTextActive,
              ]}
            >
              Year
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'multi-year' && styles.viewModeButtonActive,
            ]}
            onPress={() => setViewMode('multi-year')}
          >
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'multi-year' && styles.viewModeTextActive,
              ]}
            >
              Multi-year
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'year' && renderYearView()}
          {viewMode === 'multi-year' && renderMultiYearView()}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
    backButton: {
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
    viewModeSelectorContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    viewModeSelector: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
      padding: 2,
    },
    viewModeButton: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 6,
    },
    viewModeButtonActive: {
      backgroundColor: colors.white,
    },
    viewModeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    viewModeTextActive: {
      color: colors.text,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    // Month view styles
    monthTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 20,
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    dayHeaderLarge: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
    },
    dayHeaderTextLarge: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCellLarge: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
    },
    dayNumberLarge: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayNumberWorkout: {
      backgroundColor: colors.primaryLight,
    },
    dayTextLarge: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    dayTextWorkout: {
      color: colors.primary,
      fontWeight: '600',
    },
    dayTextToday: {
      color: colors.primary,
      fontWeight: '700',
    },
    // Year view styles
    yearTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 20,
    },
    yearGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    miniMonth: {
      width: `${100 / 3}%`,
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    miniMonthName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    miniGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    miniDay: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      padding: 1,
    },
    miniDayBox: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.backgroundLight,
      borderRadius: 2,
    },
    miniDayWorkout: {
      backgroundColor: colors.primary,
    },
    // Multi-year view styles
    multiYearRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    multiYearMonth: {
      fontSize: 10,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    multiYearGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 2,
    },
    multiYearDay: {
      width: 4,
      height: 4,
      backgroundColor: colors.backgroundLight,
      borderRadius: 1,
    },
  })
