import { useProfile } from '@/contexts/profile-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { getCoach } from '@/lib/coaches'
import { hapticSuccess } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import {
    Animated,
    Dimensions,
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

const DEFAULT_SCANNING_MESSAGES = [
  'Analyzing body composition...',
  'Detecting body fat percentage...',
  'Measuring muscle mass...',
  'Computing BMI...',
  'Processing results...',
]

const COACH_MESSAGES: Record<string, string[]> = {
  ross: [
    'Ross is analyzing your mechanical tension markers...',
    'Calculating muscle-to-fat ratio models...',
    'Ross is cross-referencing your physique data...',
    'Evidence-based metrics incoming...',
    'Finalizing scientific analysis...',
  ],
  kino: [
    'Coach Kino is sizing up your gains...',
    'Identifying your true strength potential...',
    'Scanning for elite physique progress...',
    'Calculating your power-to-weight ratio...',
    'No-nonsense results almost ready...',
  ],
  maya: [
    'Maya is celebrating your consistency...',
    'Visualizing your amazing transformation...',
    'Finding the progress you\'ve earned...',
    'Your results are going to inspire!',
    'Wrapping up your progress report...',
  ],
}

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
  const { coachId } = useProfile()
  const coach = getCoach(coachId)
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)

  const scanningMessages = COACH_MESSAGES[coachId] || DEFAULT_SCANNING_MESSAGES

  // Animated values
  const scanLinePosition = useRef(new Animated.Value(0)).current
  const messageOpacity = useRef(new Animated.Value(1)).current
  const successScale = useRef(new Animated.Value(0)).current
  const successOpacity = useRef(new Animated.Value(0)).current
  const checkmarkScale = useRef(new Animated.Value(0)).current
  const coachScale = useRef(new Animated.Value(0.9)).current
  const coachOpacity = useRef(new Animated.Value(0)).current
  const contentOpacity = useRef(new Animated.Value(0)).current

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

      Animated.parallel([
        Animated.spring(coachScale, {
          toValue: 1,
          tension: 20,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(coachOpacity, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start()

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
          if (prev >= scanningMessages.length - 1) {
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
  }, [visible, isComplete, messageOpacity, scanningMessages])

  // Handle completion animation
  useEffect(() => {
    if (isComplete && visible) {
      // Trigger success haptic
      hapticSuccess()

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
        // Coach "excitement" animation
        Animated.sequence([
            Animated.spring(coachScale, {
                toValue: 1.05,
                tension: 40,
                friction: 3,
                useNativeDriver: true,
            }),
            Animated.spring(coachScale, {
                toValue: 1,
                tension: 40,
                friction: 5,
                useNativeDriver: true,
            })
        ])
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
          // Wait 1200ms then call onComplete
          setTimeout(() => {
            onComplete?.()
          }, 1200)
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
    outputRange: [SCREEN_HEIGHT * -0.2, SCREEN_HEIGHT * 0.2],
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
        {/* Coach background */}
        <Animated.View 
            style={[
                dynamicStyles.coachContainer,
                {
                    opacity: coachOpacity,
                    transform: [{ scale: coachScale }]
                }
            ]}
        >
            <Image 
                source={coach.image}
                style={dynamicStyles.coachImage}
                contentFit="cover"
            />
            <LinearGradient 
                colors={['transparent', 'rgba(0,0,0,0.8)', '#000000']}
                style={dynamicStyles.coachGradient}
            />
        </Animated.View>

        {/* Content */}
        <Animated.View style={[dynamicStyles.content, { opacity: contentOpacity }]}>
          {/* Scanning Header */}
          {!showSuccess && (
            <View style={dynamicStyles.header}>
                <Text style={dynamicStyles.coachAnalysisText}>
                    {coach.name.split(' ')[0]}'s Analysis
                </Text>
            </View>
          )}

          {/* User's Photo with Scanning Effect */}
          {!showSuccess && (
            <View style={dynamicStyles.imageContainer}>
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={dynamicStyles.previewImage}
                  contentFit="cover"
                />
              ) : (
                <View style={[dynamicStyles.previewImage, { backgroundColor: colors.surfaceSubtle, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="person" size={48} color={colors.textSecondary} opacity={0.3} />
                </View>
              )}

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
                    `${colors.brandPrimary}00`,
                    `${colors.brandPrimary}CC`,
                    `${colors.brandPrimary}00`,
                  ]}
                  style={dynamicStyles.scanLine}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
              </Animated.View>

              {/* Border glow */}
              <View style={dynamicStyles.borderGlow} />
              
              {/* Corner Accents */}
              <View style={[dynamicStyles.corner, dynamicStyles.topLeft]} />
              <View style={[dynamicStyles.corner, dynamicStyles.topRight]} />
              <View style={[dynamicStyles.corner, dynamicStyles.bottomLeft]} />
              <View style={[dynamicStyles.corner, dynamicStyles.bottomRight]} />
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
                  {scanningMessages[currentMessageIndex]}
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
              <View style={dynamicStyles.successTop}>
                <Text style={dynamicStyles.successTitle}>
                    {hasNoStats ? 'Analysis Incomplete' : 'Analysis Complete'}
                </Text>
                <Text style={dynamicStyles.successSubtitle}>
                    {hasNoStats 
                        ? `${coach.name.split(' ')[0]} couldn't see you clearly. Please ensure your photos are well-lit and show your full physique.`
                        : `${coach.name.split(' ')[0]} has reviewed your physique and updated your stats.`
                    }
                </Text>
              </View>

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
                      name="alert-circle"
                      size={80}
                      color={colors.statusError}
                    />
                  </View>
                ) : (
                  <View
                    style={[
                      dynamicStyles.checkmarkCircle,
                      { backgroundColor: colors.brandPrimary },
                    ]}
                  >
                    <Ionicons
                      name="checkmark"
                      size={64}
                      color={colors.bg}
                    />
                  </View>
                )}
              </Animated.View>
            </Animated.View>
          )}
        </Animated.View>
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
    },
    coachContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.65,
    },
    coachImage: {
        width: '100%',
        height: '100%',
    },
    coachGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60%',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 30,
      paddingTop: SCREEN_HEIGHT * 0.1,
    },
    header: {
        marginBottom: 40,
        alignItems: 'center',
    },
    coachAnalysisText: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.brandPrimary,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    imageContainer: {
      width: SCREEN_WIDTH * 0.65,
      aspectRatio: 3 / 4,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: '#000',
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    previewImage: {
      width: '100%',
      height: '100%',
      opacity: 0.8,
    },
    scanLineContainer: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    scanLine: {
      width: '120%',
      height: SCANNING_LINE_HEIGHT,
      position: 'absolute',
    },
    borderGlow: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      borderRadius: 12,
    },
    corner: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderColor: colors.brandPrimary,
        borderWidth: 2,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
    },
    messageContainer: {
      marginTop: 60,
      backgroundColor: 'rgba(255,255,255,0.05)',
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    messageContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    scanningIndicator: {
      flexDirection: 'row',
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.brandPrimary,
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
      fontSize: 15,
      fontWeight: '600',
      color: '#fff',
      letterSpacing: -0.2,
    },
    successContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    successTop: {
        alignItems: 'center',
        marginBottom: 40,
    },
    successTitle: {
      fontSize: 32,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -1,
      marginBottom: 12,
      textAlign: 'center',
    },
    successSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    checkmarkContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkmarkCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
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

