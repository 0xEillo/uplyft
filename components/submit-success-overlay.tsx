import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface SubmitSuccessOverlayProps {
  visible: boolean
  onAnimationComplete?: () => void
  workoutNumber?: number
  weeklyTarget?: number
  currentStreak?: number
}

/**
 * Premium celebration overlay that appears when submitting a workout.
 * Shows achievement stats with a mini calendar week view.
 * Strava-like minimal design with smooth staggered animations.
 */
export function SubmitSuccessOverlay({
  visible,
  onAnimationComplete,
  workoutNumber = 1,
  weeklyTarget = 3,
  currentStreak = 0,
}: SubmitSuccessOverlayProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const numberSlideAnim = useRef(new Animated.Value(20)).current
  const statsSlideAnim = useRef(new Animated.Value(20)).current
  const weekSlideAnim = useRef(new Animated.Value(20)).current
  const latestFadeValue = useRef(0)

  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0)
      scaleAnim.setValue(0.8)
      numberSlideAnim.setValue(20)
      statsSlideAnim.setValue(20)
      weekSlideAnim.setValue(20)

      // Main card fade in + scale up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()

      // Staggered animations for content
      setTimeout(() => {
        // Workout number slides up + fades in
        Animated.timing(numberSlideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start()
      }, 150)

      setTimeout(() => {
        // Stats row slides up + fades in
        Animated.timing(statsSlideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start()
      }, 300)

      setTimeout(() => {
        // Week preview slides up + fades in
        Animated.timing(weekSlideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start()
      }, 450)

      // Wait for user to see, then fade out
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          onAnimationComplete?.()
        })
      }, 3500)
    } else {
      fadeAnim.setValue(0)
      scaleAnim.setValue(0.8)
      numberSlideAnim.setValue(20)
      statsSlideAnim.setValue(20)
      weekSlideAnim.setValue(20)
    }
  }, [visible, fadeAnim, scaleAnim, numberSlideAnim, statsSlideAnim, weekSlideAnim, onAnimationComplete])

  useEffect(() => {
    const id = fadeAnim.addListener(({ value }) => {
      latestFadeValue.current = value
    })
    return () => {
      fadeAnim.removeListener(id)
    }
  }, [fadeAnim])

  if (!visible && latestFadeValue.current === 0) {
    return null
  }

  const styles = createStyles(colors)
  const goalReached = workoutNumber >= weeklyTarget

  // Generate week days for mini calendar
  const weekDays = []
  const today = new Date()
  const dayOfWeek = today.getDay()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - dayOfWeek)

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    weekDays.push({
      day: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][i],
      date: date.toISOString().split('T')[0],
      isToday: date.toDateString() === today.toDateString(),
    })
  }

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
          backgroundColor: isDark
            ? 'rgba(18, 18, 18, 0.95)'
            : 'rgba(255, 255, 255, 0.95)',
        },
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Header with Icon */}
        <View style={styles.header}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: `${colors.primary}15` },
            ]}
          >
            <Ionicons name="checkmark" size={24} color={colors.primary} />
          </View>
        </View>

        {/* Workout Number Section */}
        <Animated.View
          style={[
            styles.numberSection,
            {
              opacity: numberSlideAnim.interpolate({
                inputRange: [0, 20],
                outputRange: [1, 0],
              }),
              transform: [
                {
                  translateY: numberSlideAnim,
                },
              ],
            },
          ]}
        >
          <Text style={styles.workoutNumberText}>
            {workoutNumber}
            {workoutNumber === 1
              ? 'st'
              : workoutNumber === 2
              ? 'nd'
              : workoutNumber === 3
              ? 'rd'
              : 'th'}
          </Text>
          <Text style={styles.workoutLabel}>Workout This Week</Text>
        </Animated.View>

        {/* Stats Row */}
        <Animated.View
          style={[
            styles.statsRow,
            {
              opacity: statsSlideAnim.interpolate({
                inputRange: [0, 20],
                outputRange: [1, 0],
              }),
              transform: [
                {
                  translateY: statsSlideAnim,
                },
              ],
            },
          ]}
        >
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Streak</Text>
            <Text style={styles.statValue}>
              {currentStreak > 0 ? `${currentStreak} wk` : '0 wk'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Weekly Goal</Text>
            <View style={styles.goalContainer}>
              <Text style={styles.statValue}>
                {workoutNumber}/{weeklyTarget}
              </Text>
              {goalReached && (
                <View style={styles.achievementBadge}>
                  <Ionicons name="checkmark" size={12} color={colors.primary} />
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Week Preview */}
        <Animated.View
          style={[
            styles.weekPreview,
            {
              opacity: weekSlideAnim.interpolate({
                inputRange: [0, 20],
                outputRange: [1, 0],
              }),
              transform: [
                {
                  translateY: weekSlideAnim,
                },
              ],
            },
          ]}
        >
          <Text style={styles.weekLabel}>This Week</Text>
          <View style={styles.weekDays}>
            {weekDays.map((day, index) => (
              <View key={index} style={styles.weekDayCell}>
                <Text style={styles.weekDayLabel}>{day.day}</Text>
                <View
                  style={[
                    styles.weekDayDot,
                    day.isToday && {
                      backgroundColor: colors.primary,
                      borderWidth: 2,
                      borderColor: colors.primary,
                    },
                  ]}
                />
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Goal Achievement Message */}
        {goalReached && (
          <Animated.View
            style={[
              styles.achievementMessage,
              {
                opacity: statsSlideAnim.interpolate({
                  inputRange: [0, 20],
                  outputRange: [1, 0],
                }),
              },
            ]}
          >
            <Text style={styles.achievementText}>Keep it up! 🔥</Text>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: -100,
      left: 0,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT + 200,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
    },
    card: {
      backgroundColor: colors.feedCardBackground,
      borderRadius: 28,
      paddingHorizontal: 24,
      paddingVertical: 28,
      width: '85%',
      maxWidth: 360,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 12,
    },
    header: {
      alignItems: 'center',
      marginBottom: 20,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    numberSection: {
      alignItems: 'center',
      marginBottom: 20,
      gap: 4,
    },
    workoutNumberText: {
      fontSize: 48,
      fontWeight: '700',
      color: colors.primary,
      lineHeight: 52,
    },
    workoutLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 2,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: 16,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      marginBottom: 16,
      gap: 12,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    divider: {
      width: 1,
      height: 24,
      backgroundColor: colors.border,
    },
    goalContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    achievementBadge: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    weekPreview: {
      gap: 10,
    },
    weekLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    weekDays: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6,
    },
    weekDayCell: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
    },
    weekDayLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    weekDayDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.backgroundLight,
    },
    achievementMessage: {
      marginTop: 12,
      paddingVertical: 8,
      alignItems: 'center',
    },
    achievementText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
  })
