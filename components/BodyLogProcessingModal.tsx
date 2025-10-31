import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface BodyLogProcessingModalProps {
  visible: boolean
  imageUri: string | null
  isComplete: boolean
  hasNoStats?: boolean
  onComplete?: () => void
}

const SCANNING_MESSAGES = [
  'Analyzing body composition...',
  'Detecting body fat percentage...',
  'Measuring muscle mass...',
  'Computing BMI...',
  'Processing results...',
]

const SCANNING_LINE_HEIGHT = 4
const SCANNING_DURATION = 3000

export function BodyLogProcessingModal({
  visible,
  imageUri,
  isComplete,
  hasNoStats = false,
  onComplete,
}: BodyLogProcessingModalProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)

  // Animated values
  const scanLinePosition = useRef(new Animated.Value(0)).current
  const messageOpacity = useRef(new Animated.Value(1)).current
  const successScale = useRef(new Animated.Value(0)).current
  const successOpacity = useRef(new Animated.Value(0)).current
  const checkmarkScale = useRef(new Animated.Value(0)).current

  // Start scanning animation
  useEffect(() => {
    if (visible && !isComplete) {
      // Reset animations
      scanLinePosition.setValue(0)
      messageOpacity.setValue(1)
      successScale.setValue(0)
      successOpacity.setValue(0)
      checkmarkScale.setValue(0)
      setShowSuccess(false)
      setCurrentMessageIndex(0)

      // Start continuous scanning animation
      Animated.loop(
        Animated.timing(scanLinePosition, {
          toValue: 1,
          duration: SCANNING_DURATION,
          useNativeDriver: true,
        }),
      ).start()
    }
  }, [
    visible,
    isComplete,
    scanLinePosition,
    messageOpacity,
    successScale,
    successOpacity,
    checkmarkScale,
  ])

  // Cycle through messages (stop at last message, don't loop)
  useEffect(() => {
    if (visible && !isComplete) {
      const interval = setInterval(() => {
        setCurrentMessageIndex((prev) => {
          // Stop at the last message, don't loop back
          if (prev >= SCANNING_MESSAGES.length - 1) {
            return prev
          }

          // Fade out
          Animated.timing(messageOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            // Fade in with next message
            Animated.timing(messageOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start()
          })

          return prev + 1
        })
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [visible, isComplete, messageOpacity])

  // Handle completion animation
  useEffect(() => {
    if (isComplete && visible) {
      // Trigger success haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      setShowSuccess(true)

      // Success animation sequence
      Animated.parallel([
        // Scale up the success container
        Animated.spring(successScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        // Fade in the success container
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // After success container appears, animate checkmark
        Animated.sequence([
          Animated.spring(checkmarkScale, {
            toValue: 1.2,
            tension: 100,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.spring(checkmarkScale, {
            toValue: 1,
            tension: 100,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Wait 800ms then call onComplete
          setTimeout(() => {
            onComplete?.()
          }, 800)
        })
      })
    }
  }, [
    isComplete,
    visible,
    successScale,
    successOpacity,
    checkmarkScale,
    onComplete,
  ])

  const scanLineTranslateY = scanLinePosition.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_HEIGHT * 0.6, SCREEN_HEIGHT * 0.6],
  })

  if (!visible) return null

  const dynamicStyles = createDynamicStyles(colors, isDark)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={dynamicStyles.container}>
        {/* Background with image preview */}
        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={dynamicStyles.backgroundImage}
            blurRadius={20}
          />
        )}

        {/* Dark overlay */}
        <View style={dynamicStyles.overlay} />

        {/* Content */}
        <View style={dynamicStyles.content}>
          {/* Image preview with scanning effect */}
          {imageUri && !showSuccess && (
            <View style={dynamicStyles.imageContainer}>
              <Image
                source={{ uri: imageUri }}
                style={dynamicStyles.previewImage}
                resizeMode="cover"
              />

              {/* Scanning lines */}
              <Animated.View
                style={[
                  dynamicStyles.scanLineContainer,
                  {
                    transform: [{ translateY: scanLineTranslateY }],
                  },
                ]}
              >
                <LinearGradient
                  colors={[
                    `${colors.primary}00`,
                    `${colors.primary}CC`,
                    `${colors.primary}00`,
                  ]}
                  style={dynamicStyles.scanLine}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
                <LinearGradient
                  colors={[
                    `${colors.primary}00`,
                    `${colors.primary}99`,
                    `${colors.primary}00`,
                  ]}
                  style={[
                    dynamicStyles.scanLine,
                    dynamicStyles.scanLineSecondary,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
              </Animated.View>

              {/* Glow effect overlay */}
              <View style={dynamicStyles.glowOverlay}>
                <LinearGradient
                  colors={[
                    `${colors.primary}1A`,
                    `${colors.primary}0D`,
                    `${colors.primary}00`,
                  ]}
                  style={dynamicStyles.glowGradient}
                />
              </View>

              {/* Border glow */}
              <View style={dynamicStyles.borderGlow} />
            </View>
          )}

          {/* Status message */}
          {!showSuccess && (
            <Animated.View
              style={[
                dynamicStyles.messageContainer,
                {
                  opacity: messageOpacity,
                },
              ]}
            >
              <View style={dynamicStyles.messageContent}>
                <View style={dynamicStyles.scanningIndicator}>
                  <View
                    style={[dynamicStyles.dot, dynamicStyles.dotAnimated]}
                  />
                  <View
                    style={[
                      dynamicStyles.dot,
                      dynamicStyles.dotAnimated,
                      dynamicStyles.dotDelay1,
                    ]}
                  />
                  <View
                    style={[
                      dynamicStyles.dot,
                      dynamicStyles.dotAnimated,
                      dynamicStyles.dotDelay2,
                    ]}
                  />
                </View>
                <Text style={dynamicStyles.messageText}>
                  {SCANNING_MESSAGES[currentMessageIndex]}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Completion state */}
          {showSuccess && (
            <Animated.View
              style={[
                dynamicStyles.successContainer,
                {
                  opacity: successOpacity,
                  transform: [{ scale: successScale }],
                },
              ]}
            >
              <Animated.View
                style={[
                  dynamicStyles.checkmarkContainer,
                  {
                    transform: [{ scale: checkmarkScale }],
                  },
                ]}
              >
                {hasNoStats ? (
                  <View style={dynamicStyles.infoCircle}>
                    <Ionicons
                      name="information-circle"
                      size={80}
                      color={colors.primary}
                    />
                  </View>
                ) : (
                  <View
                    style={[
                      dynamicStyles.checkmarkCircle,
                      { backgroundColor: colors.success },
                    ]}
                  >
                    <Ionicons
                      name="checkmark"
                      size={64}
                      color={colors.buttonText}
                    />
                  </View>
                )}
              </Animated.View>
              <Text style={dynamicStyles.successText}>
                {hasNoStats
                  ? 'Unable to determine your stats'
                  : 'Analysis Complete!'}
              </Text>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  )
}

type Colors = ReturnType<typeof useThemedColors>

const createDynamicStyles = (colors: Colors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
      justifyContent: 'center',
      alignItems: 'center',
    },
    backgroundImage: {
      position: 'absolute',
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      opacity: 0.12,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000000',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 28,
    },
    imageContainer: {
      width: SCREEN_WIDTH * 0.78,
      aspectRatio: 3 / 4,
      borderRadius: 28,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: '#000',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 12,
    },
    previewImage: {
      width: '100%',
      height: '100%',
      opacity: 0.65,
    },
    scanLineContainer: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    scanLine: {
      width: '100%',
      height: SCANNING_LINE_HEIGHT,
      position: 'absolute',
    },
    scanLineSecondary: {
      marginTop: 48,
      opacity: 0.6,
    },
    glowOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    glowGradient: {
      flex: 1,
    },
    borderGlow: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 2,
      borderColor: `${colors.primary}4D`,
      borderRadius: 28,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 24,
    },
    messageContainer: {
      marginTop: 56,
    },
    messageContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    scanningIndicator: {
      flexDirection: 'row',
      gap: 7,
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
      backgroundColor: colors.primary,
    },
    dotAnimated: {
      opacity: 0.3,
    },
    dotDelay1: {
      opacity: 0.6,
    },
    dotDelay2: {
      opacity: 1,
    },
    messageText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
      letterSpacing: -0.2,
      textAlign: 'center',
    },
    successContainer: {
      alignItems: 'center',
      gap: 28,
    },
    checkmarkContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkmarkCircle: {
      width: 128,
      height: 128,
      borderRadius: 64,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: 32,
      elevation: 12,
    },
    infoCircle: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    successText: {
      fontSize: 22,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: -0.3,
    },
  })
