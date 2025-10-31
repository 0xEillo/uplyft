import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { uploadBodyLogImages } from '@/lib/utils/body-log-storage'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

const SCANNING_MESSAGES = [
  'Analyzing body composition...',
  'Detecting body fat percentage...',
  'Computing BMI...',
  'Processing results...',
]

const SCANNING_LINE_HEIGHT = 4
const SCANNING_DURATION = 3000

export default function BodyLogProcessingPage() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const router = useRouter()
  const { user } = useAuth()
  const { imageUris, imageCount } = useLocalSearchParams<{
    imageUris?: string
    imageCount?: string
  }>()

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [hasNoStats, setHasNoStats] = useState(false)
  const [uploadedEntryId, setUploadedEntryId] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [analysisMetrics, setAnalysisMetrics] = useState<any>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [hasStartedProcessing, setHasStartedProcessing] = useState(false)

  // Parse image URIs with useMemo to prevent re-creation on every render
  const imageUriArray = useMemo(() => {
    const uris = imageUris ? imageUris.split('|||') : []
    console.log('[BODY_LOG] 📥 Processing: Parsed image URIs', {
      count: uris.length,
    })
    return uris
  }, [imageUris])

  const photoCount = parseInt(imageCount || '1', 10)

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

  // Upload images and start analysis
  useEffect(() => {
    if (!user || imageUriArray.length === 0 || !sessionToken) return
    if (hasStartedProcessing) return // Prevent running multiple times

    // Set flag immediately to prevent multiple runs
    setHasStartedProcessing(true)

    let cancelled = false

    const processImages = async () => {
      try {
        console.log('[BODY_LOG] 🚀 Processing: Starting image processing', {
          imageCount: imageUriArray.length,
          userId: user?.id?.substring(0, 8),
        })

        // Step 1: Create entry
        console.log('[BODY_LOG] 📝 Processing: Creating entry')
        const entry = await database.bodyLog.createEntry(user.id)
        if (cancelled) return

        console.log('[BODY_LOG] ✅ Processing: Entry created', {
          entryId: entry.id?.substring(0, 8),
        })
        setUploadedEntryId(entry.id)

        // Step 2: Upload all images and create image records
        console.log('[BODY_LOG] 📤 Processing: Uploading images to storage', {
          imageCount: imageUriArray.length,
        })
        const filePaths = await uploadBodyLogImages(
          imageUriArray,
          user.id,
          entry.id,
        )
        if (cancelled) return

        console.log('[BODY_LOG] ✅ Processing: Images uploaded', {
          pathCount: filePaths.length,
          paths: filePaths.map((p) => p.substring(0, 40) + '...'),
        })

        // Step 3: Add images to entry
        console.log('[BODY_LOG] 🔗 Processing: Linking images to entry')
        for (let i = 0; i < filePaths.length; i++) {
          await database.bodyLog.addImage(
            entry.id,
            user.id,
            filePaths[i],
            i + 1,
          )
        }
        if (cancelled) return

        console.log('[BODY_LOG] ✅ Processing: All images linked to entry')

        // Step 4: Start analysis with entryId
        console.log('[BODY_LOG] 🤖 Processing: Calling AI analysis function', {
          entryId: entry.id?.substring(0, 8),
          imageCount: imageUriArray.length,
        })
        const { callSupabaseFunction } = await import(
          '@/lib/supabase-functions-client'
        )
        const response = await callSupabaseFunction(
          'body-log-analyze',
          'POST',
          { entryId: entry.id },
          {},
          sessionToken,
        )

        if (!response.ok) {
          throw new Error(`Analysis failed with status ${response.status}`)
        }

        const { metrics } = await response.json()

        if (cancelled) return

        console.log('[BODY_LOG] ✅ Processing: AI analysis complete', {
          metrics: {
            weight_kg: metrics.weight_kg,
            body_fat_percentage: metrics.body_fat_percentage,
            bmi: metrics.bmi,
          },
        })

        // Store metrics for navigation
        setAnalysisMetrics(metrics)

        // Check if we got any stats
        const hasStats =
          metrics.weight_kg !== null ||
          metrics.body_fat_percentage !== null ||
          metrics.bmi !== null

        console.log('[BODY_LOG] 📊 Processing: Analysis result', {
          hasStats,
          willShowStats: hasStats,
        })

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
            ],
          )
        }
      }
    }

    processImages()

    return () => {
      cancelled = true
    }
  }, [user, imageUriArray, sessionToken, router])

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
      setCurrentImageIndex(0)

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
    isComplete,
    scanLinePosition,
    messageOpacity,
    successScale,
    successOpacity,
    checkmarkScale,
  ])

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
  }, [
    isComplete,
    dot1Opacity,
    dot2Opacity,
    dot3Opacity,
    dot1Scale,
    dot2Scale,
    dot3Scale,
  ])

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

  // Cycle through images (if multiple)
  useEffect(() => {
    if (!isComplete && imageUriArray.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % imageUriArray.length)
      }, 3000)

      return () => clearInterval(interval)
    }
  }, [isComplete, imageUriArray.length])

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
            if (uploadedEntryId) {
              const params: any = { entryId: uploadedEntryId }

              // Pass metrics if available
              if (analysisMetrics) {
                if (
                  analysisMetrics.weight_kg !== null &&
                  analysisMetrics.weight_kg !== undefined
                ) {
                  params.weightKg = analysisMetrics.weight_kg.toString()
                }
                if (
                  analysisMetrics.body_fat_percentage !== null &&
                  analysisMetrics.body_fat_percentage !== undefined
                ) {
                  params.bodyFatPercentage = analysisMetrics.body_fat_percentage.toString()
                }
                if (
                  analysisMetrics.bmi !== null &&
                  analysisMetrics.bmi !== undefined
                ) {
                  params.bmi = analysisMetrics.bmi.toString()
                }
              }

              router.replace({
                pathname: '/body-log/[entryId]',
                params,
              })
            }
          }, 800)
        })
      })
    }
  }, [
    isComplete,
    successScale,
    successOpacity,
    checkmarkScale,
    uploadedEntryId,
    analysisMetrics,
    router,
  ])

  const scanLineTranslateY = scanLinePosition.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_HEIGHT * 0.6, SCREEN_HEIGHT * 0.6],
  })

  const dynamicStyles = createDynamicStyles(colors, isDark)

  return (
    <View style={dynamicStyles.container}>
      {/* Background with current image preview */}
      {imageUriArray[currentImageIndex] && (
        <Image
          source={{ uri: imageUriArray[currentImageIndex] }}
          style={dynamicStyles.backgroundImage}
          blurRadius={20}
        />
      )}

      {/* Dark overlay */}
      <View style={dynamicStyles.overlay} />

      {/* Content */}
      <View style={dynamicStyles.content}>
        {/* Image preview with scanning effect */}
        {imageUriArray[currentImageIndex] && !showSuccess && (
          <View style={dynamicStyles.imageContainer}>
            <Image
              source={{ uri: imageUriArray[currentImageIndex] }}
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

            {/* Image counter (if multiple) */}
            {imageUriArray.length > 1 && (
              <View style={dynamicStyles.imageCounter}>
                <Text style={dynamicStyles.imageCounterText}>
                  {currentImageIndex + 1}/{imageUriArray.length}
                </Text>
              </View>
            )}
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
    imageCounter: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    imageCounterText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
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
      color: '#fff',
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
      color: '#fff',
      letterSpacing: -0.3,
    },
  })
