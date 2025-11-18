import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
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
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [weeklyGoal, setWeeklyGoal] = useState(3)
  const [showInfoModal, setShowInfoModal] = useState(false)

  // Animation refs for info modal
  const infoSlideAnim = useRef(
    new Animated.Value(Dimensions.get('window').height),
  ).current
  const infoBackdropAnim = useRef(new Animated.Value(0)).current
  const scrollViewRef = useRef<ScrollView>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Load user profile to get weekly goal
      const profile = await database.profiles.getById(userId)
      const goal = profile?.weekly_workout_goal || 3
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

  // Handle info modal animations
  useEffect(() => {
    if (showInfoModal) {
      Animated.parallel([
        Animated.spring(infoSlideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 25,
          stiffness: 200,
        }),
        Animated.timing(infoBackdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(infoSlideAnim, {
          toValue: Dimensions.get('window').height,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(infoBackdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
      scrollViewRef.current?.scrollTo({ y: 0, animated: false })
    }
  }, [showInfoModal, infoSlideAnim, infoBackdropAnim])

  // Info modal pan responder
  const infoModalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          gestureState.dy > 5 && gestureState.dy > Math.abs(gestureState.dx)
        )
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          infoSlideAnim.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          setShowInfoModal(false)
        } else {
          Animated.spring(infoSlideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 25,
            stiffness: 200,
          }).start()
        }
      },
    }),
  ).current

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
            <Ionicons name="calendar" size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.title}>Workout Calendar</Text>
            <Text style={styles.subtitle}>
              {monthName} {year} · {monthWorkoutCount} workout
              {monthWorkoutCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.infoButton}
          onPress={(e) => {
            e.stopPropagation()
            setShowInfoModal(true)
          }}
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
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
      <Modal
        visible={showInfoModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: infoBackdropAnim,
              },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setShowInfoModal(false)}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ translateY: infoSlideAnim }],
              },
            ]}
          >
            {/* Handle Bar */}
            <View
              style={styles.handleContainer}
              {...infoModalPanResponder.panHandlers}
            >
              <View
                style={[
                  styles.handle,
                  { backgroundColor: colors.textSecondary },
                ]}
              />
            </View>

            <View
              style={styles.modalHeader}
              {...infoModalPanResponder.panHandlers}
            >
              <Text style={styles.modalTitle}>Workout Calendar</Text>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              bounces={true}
              scrollEventThrottle={16}
            >
              <Text style={styles.sectionTitle}>What this shows</Text>
              <Text style={styles.sectionText}>
                This calendar displays your workout activity for the current month.
                Days with completed workouts are highlighted with a subtle circle.
              </Text>

              <Text style={styles.sectionTitle}>Your Streak</Text>
              <Text style={styles.sectionText}>
                Your streak counts consecutive weeks where you logged at least one
                workout. The week runs from Sunday to Saturday.
              </Text>

              <Text style={styles.sectionTitle}>Stay consistent</Text>
              <Text style={styles.sectionText}>
                Building a workout streak helps you stay accountable and develop
                lasting fitness habits. Even one workout per week counts!
              </Text>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </TouchableOpacity>
  )
})

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.feedCardBackground,
      paddingVertical: 20,
      paddingHorizontal: 20,
      borderBottomWidth: 2,
      borderBottomColor: colors.background,
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
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
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
      color: colors.text,
    },
    calendarContainer: {
      backgroundColor: colors.backgroundLight,
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
      backgroundColor: colors.primaryLight,
    },
    dayText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    dayTextOther: {
      color: colors.textPlaceholder,
    },
    dayTextWorkout: {
      color: colors.primary,
      fontWeight: '600',
    },
    dayTextToday: {
      color: colors.primary,
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
    infoButton: {
      padding: 4,
      marginTop: -2,
      marginRight: -4,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: Dimensions.get('window').height * 0.75,
      paddingBottom: 34,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 20,
      flex: 1,
      flexDirection: 'column',
    },
    handleContainer: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 8,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      opacity: 0.3,
    },
    modalHeader: {
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
    },
    modalBody: {
      flex: 1,
    },
    modalBodyContent: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    sectionText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    sectionBold: {
      fontWeight: '700',
      color: colors.text,
    },
  })
