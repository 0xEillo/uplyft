import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated'

import { useThemedColors } from '@/hooks/useThemedColors'

interface ActiveWorkoutCardProps {
  elapsedSeconds: number
  isRunning: boolean
  onPress?: () => void
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ActiveWorkoutCard({
  elapsedSeconds,
  isRunning,
  onPress,
}: ActiveWorkoutCardProps) {
  const colors = useThemedColors()
  const router = useRouter()
  const pulseScale = useSharedValue(1)

  // Pulsing animation for the indicator dot
  React.useEffect(() => {
    if (isRunning) {
      pulseScale.value = withRepeat(
        withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    } else {
      pulseScale.value = 1
    }
  }, [isRunning, pulseScale])

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }))

  const handlePress = () => {
    if (onPress) {
      onPress()
    } else {
      router.push('/(tabs)/create-post')
    }
  }

  const styles = createStyles(colors)

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.appName}>Rep AI</Text>
          <View style={styles.statusContainer}>
            <Animated.View style={[styles.statusDot, pulseStyle]} />
            <Text style={styles.statusText}>
              {isRunning ? 'In Progress' : 'Paused'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>

      <View style={styles.content}>
        <View style={styles.timerContainer}>
          <Ionicons name="timer-outline" size={24} color={colors.brandPrimary} />
          <Text style={styles.timerText}>{formatDuration(elapsedSeconds)}</Text>
        </View>

        <View style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Continue Workout</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 8,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    appName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.brandPrimary + '15',
      borderRadius: 12,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#4CAF50', // Green for active
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    content: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    timerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    timerText: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    actionButton: {
      backgroundColor: colors.brandPrimary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
  })
