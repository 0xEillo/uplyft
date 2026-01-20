import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { useEffect, useRef, useState } from 'react'
import {
    Animated,
    Dimensions,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import Svg, { Circle } from 'react-native-svg'

const SCREEN_HEIGHT = Dimensions.get('window').height

interface RestTimerOverlayProps {
  visible: boolean
  onClose: () => void
  remainingSeconds: number
  isActive: boolean
  onStart: (duration: number) => void
  onStop: () => void
  onAddTime: (seconds: number) => void
}

const CircularProgress = ({
  size,
  strokeWidth,
  progress,
  color,
  backgroundColor,
}: {
  size: number
  strokeWidth: number
  progress: number
  color: string
  backgroundColor: string
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - progress * circumference

  return (
    <View
      style={{
        width: size,
        height: size,
        transform: [{ rotate: '-90deg' }, { scaleY: -1 }],
      }}
    >
      <Svg width={size} height={size}>
        <Circle
          stroke={backgroundColor}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          stroke={color}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  )
}

const STORAGE_KEY = 'uplyft_rest_timer_default_duration'

export function RestTimerOverlay({
  visible,
  onClose,
  remainingSeconds,
  isActive,
  onStart,
  onStop,
  onAddTime,
}: RestTimerOverlayProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { trackEvent } = useAnalytics()
  const styles = createStyles(colors)

  // Animation refs
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const backdropAnim = useRef(new Animated.Value(0)).current

  // Selection state
  const [selectedDuration, setSelectedDuration] = useState(120) // Default 2 minutes

  // Load persisted duration on mount
  useEffect(() => {
    const loadDuration = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY)
        if (saved) {
          setSelectedDuration(parseInt(saved, 10))
        }
      } catch {
        // Ignore error
      }
    }
    loadDuration()
  }, [])

  // Save duration when it changes
  useEffect(() => {
    const saveDuration = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, selectedDuration.toString())
      } catch {
        // Ignore error
      }
    }
    // Debounce slightly or just save
    const timeout = setTimeout(saveDuration, 500)
    return () => clearTimeout(timeout)
  }, [selectedDuration])

  // Track initial duration to calculate progress
  const initialDurationRef = useRef(remainingSeconds || 120)

  useEffect(() => {
    if (isActive && remainingSeconds > initialDurationRef.current) {
      initialDurationRef.current = remainingSeconds
    }
  }, [remainingSeconds, isActive])

  // Handle modal animations
  useEffect(() => {
    if (visible) {
      // Slide up
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 25,
          stiffness: 200,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      // Slide down
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, slideAnim, backdropAnim])

  // Pan responder for swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          onClose()
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 25,
            stiffness: 200,
          }).start()
        }
      },
    }),
  ).current

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`
  }

  const handleStart = () => {
    haptic('medium')
    initialDurationRef.current = selectedDuration
    trackEvent(AnalyticsEvents.REST_TIMER_STARTED, {
      duration_seconds: selectedDuration,
    })
    onStart(selectedDuration)
  }

  const handleStopPress = () => {
    haptic('medium')
    trackEvent(AnalyticsEvents.REST_TIMER_COMPLETED, {
      duration_seconds: initialDurationRef.current,
      completed: false,
    })
    onStop()
  }

  const handleAddTimePress = () => {
    haptic('light')
    onAddTime(30)
    initialDurationRef.current += 30
  }

  const adjustTime = (delta: number) => {
    haptic('light')
    setSelectedDuration((prev) => Math.max(15, prev + delta))
  }

  const handleReset = () => {
    haptic('light')
    setSelectedDuration(120)
  }

  const progress = isActive
    ? Math.min(Math.max(remainingSeconds / initialDurationRef.current, 0), 1)
    : 0

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: slideAnim }],
              height: isActive ? 500 : 380,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Handle Bar */}
          <View style={styles.handleContainer}>
            <View
              style={[styles.handle, { backgroundColor: colors.textSecondary }]}
            />
          </View>

          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              {!isActive ? (
                <TouchableOpacity
                  onPress={handleReset}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 40 }} /> // Spacer
              )}

              <Text style={styles.title}>Rest Time</Text>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={styles.closeIconContainer}>
                  <Ionicons
                    name="close"
                    size={18}
                    color={colors.textSecondary}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {isActive ? (
              <View style={styles.activeContainer}>
                <View style={styles.timerRingContainer}>
                  <CircularProgress
                    size={240}
                    strokeWidth={12}
                    progress={progress}
                    color={colors.brandPrimary}
                    backgroundColor={colors.surfaceSubtle}
                  />
                  <View style={styles.timerTextContainer}>
                    <Text style={styles.activeTimerText}>
                      {formatTime(remainingSeconds)}
                    </Text>
                    <Text style={styles.timerLabel}>remaining</Text>
                  </View>
                </View>

                <View style={styles.controlsRow}>
                  <TouchableOpacity
                    style={[styles.controlButton, styles.stopButton]}
                    onPress={handleStopPress}
                  >
                    <Text style={styles.stopButtonText}>Stop</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.controlButton, styles.addButton]}
                    onPress={handleAddTimePress}
                  >
                    <Text style={styles.addButtonText}>+30s</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.selectionContainer}>
                {/* Time Adjuster Card */}
                <View style={styles.adjusterCard}>
                  <View style={styles.timeDisplayContainer}>
                    <Text style={styles.selectedTimeText}>
                      {formatTime(selectedDuration)}
                    </Text>
                  </View>

                  <View style={styles.adjusterButtons}>
                    <TouchableOpacity
                      style={styles.circleButton}
                      onPress={() => adjustTime(-15)}
                    >
                      <Ionicons
                        name="remove"
                        size={24}
                        color={isDark ? '#FFFFFF' : colors.textPrimary}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.circleButton}
                      onPress={() => adjustTime(15)}
                    >
                      <Ionicons
                        name="add"
                        size={24}
                        color={isDark ? '#FFFFFF' : colors.textPrimary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Start Button */}
                <TouchableOpacity
                  style={styles.startButton}
                  onPress={handleStart}
                >
                  <Text style={styles.startButtonText}>Start Timer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    modalContent: {
      backgroundColor: colors.surfaceSheet,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingBottom: 40,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 20,
      width: '100%',
      position: 'absolute',
      bottom: 0,
    },
    handleContainer: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 16,
    },
    handle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      opacity: 0.2,
    },
    container: {
      flex: 1,
      paddingHorizontal: 24,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    resetText: {
      fontSize: 17,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    closeButton: {
      padding: 4,
    },
    closeIconContainer: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeContainer: {
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: 1,
    },
    timerRingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 40,
    },
    timerTextContainer: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeTimerText: {
      fontSize: 56,
      fontWeight: '700',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
      letterSpacing: -1,
    },
    timerLabel: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 4,
      fontWeight: '500',
    },
    controlsRow: {
      flexDirection: 'row',
      gap: 20,
      width: '100%',
    },
    controlButton: {
      flex: 1,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stopButton: {
      backgroundColor: colors.surfaceSubtle,
    },
    stopButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.statusError, // iOS Red
    },
    addButton: {
      backgroundColor: colors.brandPrimary,
    },
    addButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF', // Keep white for primary button text
    },
    selectionContainer: {
      gap: 24,
    },
    adjusterCard: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 20,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 100,
    },
    timeDisplayContainer: {
      justifyContent: 'center',
    },
    selectedTimeText: {
      fontSize: 34,
      fontWeight: '600',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
      letterSpacing: 0.5,
    },
    timeContextLabel: {
      fontSize: 15,
      color: colors.textPrimary,
      marginTop: 4,
      fontWeight: '500',
    },
    adjusterButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    circleButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    startButton: {
      backgroundColor: colors.brandPrimary,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    startButtonText: {
      fontSize: 17,
      fontWeight: '600',
      color: '#FFFFFF', // Keep white for primary button text
    },
  })
