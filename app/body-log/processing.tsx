import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { uploadBodyLogImage } from '@/lib/utils/body-log-storage'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

const SCANNING_MESSAGES = [
  'Analyzing body composition...',
  'Detecting body fat percentage...',
  'Measuring muscle mass...',
  'Computing BMI...',
  'Processing results...',
]

const SCANNING_LINE_HEIGHT = 4
const SCANNING_DURATION = 3000

export default function BodyLogProcessingPage() {
  const colors = useThemedColors()
  const router = useRouter()
  const { user } = useAuth()
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>()

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [hasNoStats, setHasNoStats] = useState(false)
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null)
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [analysisMetrics, setAnalysisMetrics] = useState<any>(null)

  // Animated values
  const scanLinePosition = useRef(new Animated.Value(0)).current
  const messageOpacity = useRef(new Animated.Value(1)).current
  const successScale = useRef(new Animated.Value(0)).current
  const successOpacity = useRef(new Animated.Value(0)).current
  const checkmarkScale = useRef(new Animated.Value(0)).current
  const dot1Opacity = useRef(new Animated.Value(0.3)).current
  const dot2Opacity = useRef(new Animated.Value(0.3)).current
  const dot3Opacity = useRef(new Animated.Value(0.3)).current
  const dot1Scale = useRef(new Animated.Value(1)).current
  const dot2Scale = useRef(new Animated.Value(1)).current
  const dot3Scale = useRef(new Animated.Value(1)).current

  // Get session token
  useEffect(() => {
    let isMounted = true

    const syncAccessToken = async () => {
      const { data } = await supabase.auth.getSession()
      if (isMounted) {
        setSessionToken(data.session?.access_token || null)
      }
    }

    syncAccessToken()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSessionToken(session?.access_token || null)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Upload image and start analysis
  useEffect(() => {
    if (!user || !imageUri || !sessionToken) return

    let cancelled = false

    const processImage = async () => {
      try {
        // Upload image
        const filePath = await uploadBodyLogImage(imageUri, user.id)
        const newImage = await database.bodyLog.create(user.id, filePath)

        if (cancelled) return

        setUploadedImageId(newImage.id)
        setUploadedFilePath(filePath)

        // Start analysis
        const response = await fetch('/api/body-log/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ imageId: newImage.id }),
        })

        if (!response.ok) {
          throw new Error(`Analysis failed with status ${response.status}`)
        }

        const { metrics } = await response.json()

        if (cancelled) return

        // Store metrics for navigation
        setAnalysisMetrics(metrics)

        // Check if we got any stats
        const hasStats =
          metrics.weight_kg !== null ||
          metrics.body_fat_percentage !== null ||
          metrics.bmi !== null ||
          metrics.muscle_mass_kg !== null

        setHasNoStats(!hasStats)
        setIsComplete(true)
      } catch (error) {
        console.error('Error processing body log:', error)
        if (!cancelled) {
          Alert.alert(
            'Processing Failed',
            'Failed to process your body scan. Please try again.',
            [
              {
                text: 'OK',
                onPress: () => router.back(),
              },
            ]
          )
        }
      }
    }

    processImage()

    return () => {
      cancelled = true
    }
  }, [user, imageUri, sessionToken, router])

  // Start scanning animation
  useEffect(() => {
    if (!isComplete) {
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
  }, [isComplete, scanLinePosition, messageOpacity, successScale, successOpacity, checkmarkScale])

  // Animate dots in sequence
  useEffect(() => {
    if (!isComplete) {
      const createDotAnimation = (
        opacityValue: Animated.Value,
        scaleValue: Animated.Value,
        delay: number,
      ) => {
        return Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(opacityValue, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(scaleValue, {
              toValue: 1.2,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(opacityValue, {
              toValue: 0.3,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(scaleValue, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ])
      }

      Animated.loop(
        Animated.parallel([
          createDotAnimation(dot1Opacity, dot1Scale, 0),
          createDotAnimation(dot2Opacity, dot2Scale, 200),
          createDotAnimation(dot3Opacity, dot3Scale, 400),
        ]),
      ).start()
    }
  }, [isComplete, dot1Opacity, dot2Opacity, dot3Opacity, dot1Scale, dot2Scale, dot3Scale])

  // Cycle through messages
  useEffect(() => {
    if (!isComplete) {
      const interval = setInterval(() => {
        setCurrentMessageIndex((prev) => {
          if (prev >= SCANNING_MESSAGES.length - 1) {
            return prev
          }

          Animated.timing(messageOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
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
  }, [isComplete, messageOpacity])

  // Handle completion animation
  useEffect(() => {
    if (isComplete) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      setShowSuccess(true)

      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
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
          // Navigate to detail page after animation
          setTimeout(() => {
            if (uploadedImageId) {
              const params: any = { imageId: uploadedImageId }

              // Pass file path for image loading
              if (uploadedFilePath) {
                params.filePath = uploadedFilePath
              }

              // Pass metrics if available
              if (analysisMetrics) {
                if (analysisMetrics.weight_kg !== null && analysisMetrics.weight_kg !== undefined) {
                  params.weightKg = analysisMetrics.weight_kg.toString()
                }
                if (analysisMetrics.body_fat_percentage !== null && analysisMetrics.body_fat_percentage !== undefined) {
                  params.bodyFatPercentage = analysisMetrics.body_fat_percentage.toString()
                }
                if (analysisMetrics.bmi !== null && analysisMetrics.bmi !== undefined) {
                  params.bmi = analysisMetrics.bmi.toString()
                }
                if (analysisMetrics.muscle_mass_kg !== null && analysisMetrics.muscle_mass_kg !== undefined) {
                  params.muscleMassKg = analysisMetrics.muscle_mass_kg.toString()
                }
              }

              router.replace({
                pathname: '/body-log/[imageId]',
                params,
              })
            }
          }, 800)
        })
      })
    }
  }, [isComplete, successScale, successOpacity, checkmarkScale, uploadedImageId, uploadedFilePath, analysisMetrics, router])

  const scanLineTranslateY = scanLinePosition.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_HEIGHT * 0.6, SCREEN_HEIGHT * 0.6],
  })

  const dynamicStyles = createDynamicStyles(colors)

  return (
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
                style={[dynamicStyles.scanLine, dynamicStyles.scanLineSecondary]}
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
                <Animated.View
                  style={[
                    dynamicStyles.dot,
                    {
                      opacity: dot1Opacity,
                      transform: [{ scale: dot1Scale }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    dynamicStyles.dot,
                    {
                      opacity: dot2Opacity,
                      transform: [{ scale: dot2Scale }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    dynamicStyles.dot,
                    {
                      opacity: dot3Opacity,
                      transform: [{ scale: dot3Scale }],
                    },
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
                <View style={[dynamicStyles.checkmarkCircle, { backgroundColor: colors.success }]}>
                  <Ionicons name="checkmark" size={64} color={colors.white} />
                </View>
              )}
            </Animated.View>
            <View style={dynamicStyles.successTextContainer}>
              <Text style={dynamicStyles.successText}>
                {hasNoStats
                  ? 'Unable to determine your stats'
                  : 'Analysis Complete!'}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  )
}

type Colors = ReturnType<typeof useThemedColors>

const createDynamicStyles = (colors: Colors) =>
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
      backgroundColor: 'rgba(255, 255, 255, 0.10)',
      borderRadius: 20,
      paddingVertical: 18,
      paddingHorizontal: 24,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 3,
    },
    messageContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      justifyContent: 'center',
    },
    scanningIndicator: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 6,
      elevation: 4,
    },
    messageText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.white,
      letterSpacing: -0.1,
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
    successTextContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.10)',
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 3,
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
      color: colors.white,
      letterSpacing: -0.3,
    },
  })
