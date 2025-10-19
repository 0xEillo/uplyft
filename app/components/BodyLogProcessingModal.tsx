import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
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
  }, [visible, isComplete, scanLinePosition, messageOpacity, successScale, successOpacity, checkmarkScale])

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
  }, [isComplete, visible, successScale, successOpacity, checkmarkScale, onComplete])

  const scanLineTranslateY = scanLinePosition.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_HEIGHT * 0.6, SCREEN_HEIGHT * 0.6],
  })

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Background with image preview */}
        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={styles.backgroundImage}
            blurRadius={20}
          />
        )}

        {/* Dark overlay */}
        <View style={styles.overlay} />

        {/* Content */}
        <View style={styles.content}>
          {/* Image preview with scanning effect */}
          {imageUri && !showSuccess && (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.previewImage}
                resizeMode="cover"
              />

              {/* Scanning lines */}
              <Animated.View
                style={[
                  styles.scanLineContainer,
                  {
                    transform: [{ translateY: scanLineTranslateY }],
                  },
                ]}
              >
                <LinearGradient
                  colors={[
                    'rgba(59, 130, 246, 0)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(59, 130, 246, 0)',
                  ]}
                  style={styles.scanLine}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
                <LinearGradient
                  colors={[
                    'rgba(59, 130, 246, 0)',
                    'rgba(59, 130, 246, 0.6)',
                    'rgba(59, 130, 246, 0)',
                  ]}
                  style={[styles.scanLine, styles.scanLineSecondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
              </Animated.View>

              {/* Glow effect overlay */}
              <View style={styles.glowOverlay}>
                <LinearGradient
                  colors={[
                    'rgba(59, 130, 246, 0.1)',
                    'rgba(59, 130, 246, 0.05)',
                    'rgba(59, 130, 246, 0)',
                  ]}
                  style={styles.glowGradient}
                />
              </View>

              {/* Border glow */}
              <View style={styles.borderGlow} />
            </View>
          )}

          {/* Status message */}
          {!showSuccess && (
            <Animated.View
              style={[
                styles.messageContainer,
                {
                  opacity: messageOpacity,
                },
              ]}
            >
              <View style={styles.messageContent}>
                <View style={styles.scanningIndicator}>
                  <View style={[styles.dot, styles.dotAnimated]} />
                  <View style={[styles.dot, styles.dotAnimated, styles.dotDelay1]} />
                  <View style={[styles.dot, styles.dotAnimated, styles.dotDelay2]} />
                </View>
                <Text style={styles.messageText}>
                  {SCANNING_MESSAGES[currentMessageIndex]}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Completion state */}
          {showSuccess && (
            <Animated.View
              style={[
                styles.successContainer,
                {
                  opacity: successOpacity,
                  transform: [{ scale: successScale }],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.checkmarkContainer,
                  {
                    transform: [{ scale: checkmarkScale }],
                  },
                ]}
              >
                {hasNoStats ? (
                  <View style={styles.infoCircle}>
                    <Ionicons
                      name="information-circle"
                      size={80}
                      color="#3B82F6"
                    />
                  </View>
                ) : (
                  <View style={styles.checkmarkCircle}>
                    <Ionicons name="checkmark" size={64} color="#FFFFFF" />
                  </View>
                )}
              </Animated.View>
              <Text style={styles.successText}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    opacity: 0.15,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  imageContainer: {
    width: SCREEN_WIDTH * 0.75,
    aspectRatio: 3 / 4,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
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
    marginTop: 40,
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
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  messageContainer: {
    marginTop: 48,
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scanningIndicator: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  successContainer: {
    alignItems: 'center',
    gap: 24,
  },
  checkmarkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 10,
  },
  infoCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
})
