import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import { router, Stack } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type ViewMode = 'month' | 'year' | 'multi-year'

export default function WorkoutCalendarScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [isLoading, setIsLoading] = useState(true)
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set())
  const [currentDate, setCurrentDate] = useState(new Date())
  const [shouldExit, setShouldExit] = useState(false)

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

  const handleBack = () => {
    setShouldExit(true)
  }

  const handleExitComplete = () => {
    router.back()
  }

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
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
        day,
      ).padStart(2, '0')}`
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
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
          day,
        ).padStart(2, '0')}`
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

    // Build a proper GitHub-style contribution graph
    // Rows = days of week (0-6, Sun-Sat)
    // Columns = weeks of year (~53 weeks)

    // Get the first day of the year
    const firstDayOfYear = new Date(currentYear, 0, 1)
    const lastDayOfYear = new Date(currentYear, 11, 31)

    // Calculate total days and weeks
    const totalDays =
      Math.ceil(
        (lastDayOfYear.getTime() - firstDayOfYear.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1

    // Build a 2D structure: weeks as columns
    // Each week is an array of 7 days (some might be null for padding)
    const weeks: (Date | null)[][] = []

    // First, add padding for days before Jan 1 in the first week
    const firstDayOfWeek = firstDayOfYear.getDay() // 0=Sun, 6=Sat
    let currentWeek: (Date | null)[] = []

    // Pad the beginning of first week with nulls
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null)
    }

    // Iterate through all days of the year
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(currentYear, 0, 1 + i)

      currentWeek.push(date)

      // If we've filled a week (7 days), start a new one
      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    }

    // Push the last partial week if any
    if (currentWeek.length > 0) {
      // Pad the end of the last week with nulls
      while (currentWeek.length < 7) {
        currentWeek.push(null)
      }
      weeks.push(currentWeek)
    }

    // Calculate month label positions (which week each month starts in)
    const monthLabels: { month: string; weekIndex: number }[] = []
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]

    for (let month = 0; month < 12; month++) {
      const firstOfMonth = new Date(currentYear, month, 1)
      // Find which week this falls into
      const daysSinceYearStart = Math.floor(
        (firstOfMonth.getTime() - firstDayOfYear.getTime()) /
          (1000 * 60 * 60 * 24),
      )
      const weekIndex = Math.floor(
        (daysSinceYearStart + firstDayOfWeek) / 7,
      )
      monthLabels.push({ month: monthNames[month], weekIndex })
    }

    // Grid dimensions - dynamically sized to fill screen width
    // Account for padding (16 on each side = 32 total)
    const screenWidth = Dimensions.get('window').width
    const availableWidth = screenWidth - 32 // Subtract padding
    const numWeeks = weeks.length
    
    // Calculate cell size and gap to fill available width exactly
    // Use a fixed gap of 1px for clean rendering
    // Formula: availableWidth = numWeeks * cellSize + (numWeeks - 1) * gap
    // cellSize = (availableWidth - (numWeeks - 1) * gap) / numWeeks
    const cellGap = 1
    const cellSize = (availableWidth - (numWeeks - 1) * cellGap) / numWeeks

    return (
      <View style={styles.content}>
        <Text style={styles.yearTitle}>{currentYear}</Text>

        {/* Month labels - positioned above their starting weeks */}
        <View style={styles.multiYearMonthRow}>
          {monthLabels.map((label, idx) => (
            <Text
              key={idx}
              style={[
                styles.multiYearMonth,
                {
                  position: 'absolute',
                  left: label.weekIndex * (cellSize + cellGap),
                },
              ]}
            >
              {label.month}
            </Text>
          ))}
        </View>

        {/* Main grid - rows are days of week, columns are weeks */}
        <View style={[styles.multiYearWeeksContainer, { gap: cellGap }]}>
          {weeks.map((week, weekIdx) => (
            <View key={weekIdx} style={[styles.multiYearWeek, { gap: cellGap }]}>
              {week.map((date, dayIdx) => {
                const dayStyle = {
                  width: cellSize,
                  height: cellSize,
                  borderRadius: Math.max(1, Math.floor(cellSize / 4)),
                }

                if (!date) {
                  return (
                    <View
                      key={dayIdx}
                      style={[styles.multiYearDay, styles.multiYearDayEmpty, dayStyle]}
                    />
                  )
                }

                const dateStr = date.toISOString().split('T')[0]
                const hasWorkout = workoutDates.has(dateStr)
                const isToday =
                  dateStr === new Date().toISOString().split('T')[0]

                return (
                  <View
                    key={dayIdx}
                    style={[
                      styles.multiYearDay,
                      dayStyle,
                      hasWorkout && styles.multiYearDayWorkout,
                      isToday && styles.multiYearDayToday,
                    ]}
                  />
                )
              })}
            </View>
          ))}
        </View>
      </View>
    )
  }

  const styles = createStyles(colors)
  const insets = useSafeAreaInsets()

  return (
    <SlideInView
      style={{ flex: 1 }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.safeAreaContainer, { paddingTop: insets.top }]}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={30} color={colors.text} />
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
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'year' && renderYearView()}
            {viewMode === 'multi-year' && renderMultiYearView()}
          </ScrollView>
        )}
      </View>
    </SlideInView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    safeAreaContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
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
      backgroundColor: colors.background,
    },
    backButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -7,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      flex: 1,
    },
    headerRightSpacer: {
      width: 44,
      marginRight: -7,
    },
    viewModeSelectorContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
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
      backgroundColor: colors.feedCardBackground,
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
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
      backgroundColor: colors.background,
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
    // Multi-year view styles (GitHub-style contribution graph)
    multiYearMonthRow: {
      position: 'relative',
      height: 14,
      marginBottom: 4,
    },
    multiYearMonth: {
      fontSize: 9,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    multiYearWeeksContainer: {
      flexDirection: 'row',
      // gap is set dynamically inline
    },
    multiYearWeek: {
      flexDirection: 'column',
      // gap is set dynamically inline
    },
    multiYearDay: {
      // width, height, borderRadius are set dynamically inline
      backgroundColor: colors.backgroundLight,
    },
    multiYearDayEmpty: {
      backgroundColor: 'transparent',
    },
    multiYearDayWorkout: {
      backgroundColor: colors.primary,
    },
    multiYearDayToday: {
      borderWidth: 1,
      borderColor: colors.primary,
    },
  })
