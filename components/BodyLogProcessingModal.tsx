import { useThemedColors } from '@/hooks/useThemedColors'
import { hapticSuccess } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
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
  'Analyzing composition',
  'Processing metrics',
  'Calculating results',
  'Finalizing',
]

export function BodyLogProcessingModal({
  visible,
  imageUri,
  isComplete,
  hasNoStats = false,
  onComplete,
}: BodyLogProcessingModalProps) {
  const colors = useThemedColors()
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)

  // Animated values
  const ringRotation = useRef(new Animated.Value(0)).current
  const pulseScale = useRef(new Animated.Value(1)).current
  const pulseOpacity = useRef(new Animated.Value(0.6)).current
  const imageScale = useRef(new Animated.Value(0.95)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const successScale = useRef(new Animated.Value(0.8)).current
  const successOpacity = useRef(new Animated.Value(0)).current
  const checkScale = useRef(new Animated.Value(0)).current
  const processingOpacity = useRef(new Animated.Value(1)).current
  const dotOpacity1 = useRef(new Animated.Value(0.3)).current
  const dotOpacity2 = useRef(new Animated.Value(0.3)).current
  const dotOpacity3 = useRef(new Animated.Value(0.3)).current

  // Ring rotation animation
  useEffect(() => {
    if (visible && !isComplete) {
      ringRotation.setValue(0)
      
      Animated.loop(
        Animated.timing(ringRotation, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start()
    }
  }, [visible, isComplete, ringRotation])

  // Pulse animation
  useEffect(() => {
    if (visible && !isComplete) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseScale, {
              toValue: 1.15,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseScale, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      )
      pulseAnimation.start()
      return () => pulseAnimation.stop()
    }
  }, [visible, isComplete, pulseScale, pulseOpacity])

  // Dot animation
  useEffect(() => {
    if (visible && !isComplete) {
      const animateDots = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(dotOpacity1, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(dotOpacity2, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(dotOpacity3, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(200),
            Animated.parallel([
              Animated.timing(dotOpacity1, { toValue: 0.3, duration: 200, useNativeDriver: true }),
              Animated.timing(dotOpacity2, { toValue: 0.3, duration: 200, useNativeDriver: true }),
              Animated.timing(dotOpacity3, { toValue: 0.3, duration: 200, useNativeDriver: true }),
            ]),
          ])
        ).start()
      }
      animateDots()
    }
  }, [visible, isComplete, dotOpacity1, dotOpacity2, dotOpacity3])

  // Initial entrance animation
  useEffect(() => {
    if (visible && !isComplete) {
      // Reset all values
      imageScale.setValue(0.95)
      contentOpacity.setValue(0)
      successScale.setValue(0.8)
      successOpacity.setValue(0)
      checkScale.setValue(0)
      processingOpacity.setValue(1)
      setShowSuccess(false)
      setCurrentMessageIndex(0)

      Animated.parallel([
        Animated.spring(imageScale, {
          toValue: 1,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, isComplete, imageScale, contentOpacity, successScale, successOpacity, checkScale, processingOpacity])

  // Cycle messages
  useEffect(() => {
    if (visible && !isComplete) {
      const interval = setInterval(() => {
        setCurrentMessageIndex((prev) => 
          prev >= SCANNING_MESSAGES.length - 1 ? prev : prev + 1
        )
      }, 2500)
      return () => clearInterval(interval)
    }
  }, [visible, isComplete])

  // Completion animation
  useEffect(() => {
    if (isComplete && visible) {
      hapticSuccess()
      
      // Fade out processing state
      Animated.timing(processingOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowSuccess(true)
        
        // Animate success state in
        Animated.parallel([
          Animated.spring(successScale, {
            toValue: 1,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(successOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Checkmark bounce
          Animated.sequence([
            Animated.spring(checkScale, {
              toValue: 1.15,
              tension: 200,
              friction: 6,
              useNativeDriver: true,
            }),
            Animated.spring(checkScale, {
              toValue: 1,
              tension: 200,
              friction: 8,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setTimeout(() => onComplete?.(), 1000)
          })
        })
      })
    }
  }, [isComplete, visible, processingOpacity, successScale, successOpacity, checkScale, onComplete])

  const ringRotationInterpolate = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  if (!visible) return null

  const styles = createStyles(colors)
  const IMAGE_SIZE = SCREEN_WIDTH * 0.55

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        {/* Subtle background gradient */}
        <LinearGradient
          colors={['#0a0a0a', '#111111', '#0a0a0a']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        {/* Ambient glow behind image */}
        <View style={[styles.ambientGlow, { width: IMAGE_SIZE * 1.5, height: IMAGE_SIZE * 1.5 }]}>
          <LinearGradient
            colors={[`${colors.brandPrimary}15`, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0.5, y: 0 }}
          />
        </View>

        <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
          {/* Processing State */}
          {!showSuccess && (
            <Animated.View style={[styles.processingContent, { opacity: processingOpacity }]}>
              {/* Image container with ring */}
              <View style={[styles.imageWrapper, { width: IMAGE_SIZE, height: IMAGE_SIZE * 1.33 }]}>
                {/* Pulse effect */}
                <Animated.View
                  style={[
                    styles.pulseRing,
                    {
                      width: IMAGE_SIZE + 40,
                      height: IMAGE_SIZE * 1.33 + 40,
                      borderRadius: 20,
                      opacity: pulseOpacity,
                      transform: [{ scale: pulseScale }],
                    },
                  ]}
                />

                {/* Rotating gradient ring */}
                <Animated.View
                  style={[
                    styles.rotatingRing,
                    {
                      width: IMAGE_SIZE + 8,
                      height: IMAGE_SIZE * 1.33 + 8,
                      borderRadius: 16,
                      transform: [{ rotate: ringRotationInterpolate }],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[colors.brandPrimary, 'transparent', 'transparent', colors.brandPrimary]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                </Animated.View>

                {/* Image */}
                <Animated.View
                  style={[
                    styles.imageContainer,
                    {
                      width: IMAGE_SIZE,
                      height: IMAGE_SIZE * 1.33,
                      transform: [{ scale: imageScale }],
                    },
                  ]}
                >
                  {imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.image}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.image, styles.imagePlaceholder]}>
                      <Ionicons name="person" size={48} color="rgba(255,255,255,0.2)" />
                    </View>
                  )}
                  
                  {/* Subtle overlay for depth */}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.3)']}
                    style={styles.imageOverlay}
                  />
                </Animated.View>
              </View>

              {/* Status indicator */}
              <View style={styles.statusContainer}>
                <View style={styles.dotContainer}>
                  <Animated.View style={[styles.dot, { opacity: dotOpacity1, backgroundColor: colors.brandPrimary }]} />
                  <Animated.View style={[styles.dot, { opacity: dotOpacity2, backgroundColor: colors.brandPrimary }]} />
                  <Animated.View style={[styles.dot, { opacity: dotOpacity3, backgroundColor: colors.brandPrimary }]} />
                </View>
                <Text style={styles.statusText}>
                  {SCANNING_MESSAGES[currentMessageIndex]}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Success State */}
          {showSuccess && (
            <Animated.View
              style={[
                styles.successContent,
                {
                  opacity: successOpacity,
                  transform: [{ scale: successScale }],
                },
              ]}
            >
              {/* Check icon */}
              <Animated.View
                style={[
                  styles.checkContainer,
                  {
                    transform: [{ scale: checkScale }],
                    backgroundColor: hasNoStats ? 'transparent' : colors.brandPrimary,
                  },
                ]}
              >
                {hasNoStats ? (
                  <Ionicons name="alert-circle" size={72} color={colors.statusError} />
                ) : (
                  <Ionicons name="checkmark" size={48} color="#fff" />
                )}
              </Animated.View>

              {/* Text */}
              <Text style={styles.successTitle}>
                {hasNoStats ? 'Unable to Analyze' : 'Analysis Complete'}
              </Text>
              <Text style={styles.successSubtitle}>
                {hasNoStats
                  ? 'Please ensure your photos are well-lit and show your full physique.'
                  : 'Your body metrics have been updated.'}
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

type Colors = ReturnType<typeof useThemedColors>

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    ambientGlow: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -SCREEN_WIDTH * 0.4 }, { translateY: -SCREEN_WIDTH * 0.5 }],
      borderRadius: 999,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    processingContent: {
      alignItems: 'center',
    },
    imageWrapper: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    pulseRing: {
      position: 'absolute',
      borderWidth: 1,
      borderColor: colors.brandPrimary,
    },
    rotatingRing: {
      position: 'absolute',
      overflow: 'hidden',
    },
    imageContainer: {
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#1a1a1a',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imagePlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1a1a1a',
    },
    imageOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    statusContainer: {
      marginTop: 48,
      alignItems: 'center',
      gap: 16,
    },
    dotContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 15,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.6)',
      letterSpacing: 0.5,
    },
    successContent: {
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    checkContainer: {
      width: 88,
      height: 88,
      borderRadius: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32,
    },
    successTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: -0.5,
      marginBottom: 12,
    },
    successSubtitle: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.5)',
      textAlign: 'center',
      lineHeight: 24,
    },
  })
