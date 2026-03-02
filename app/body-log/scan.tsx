import { Paywall } from '@/components/paywall'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useUnit } from '@/contexts/unit-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { haptic, hapticSuccess } from '@/lib/haptics'
import { supabase } from '@/lib/supabase'
import { callSupabaseFunction } from '@/lib/supabase-functions-client'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Reanimated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const MAX_PHOTOS = 3

const SCANNING_MESSAGES = [
  'Uploading photos',
  'Analyzing composition',
  'Processing metrics',
  'Calculating results',
]

type Step = 'intro' | 'capture' | 'weight' | 'processing' | 'teaser'

export default function BodyScanFlowScreen() {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { isProMember } = useSubscription()
  const { weightUnit, convertInputToKg } = useUnit()

  const [step, setStep] = useState<Step>('intro')
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null])
  const [weightInput, setWeightInput] = useState('')
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)
  const [activePhotoSlot, setActivePhotoSlot] = useState<number | null>(null)
  const [paywallVisible, setPaywallVisible] = useState(false)
  const [openLibraryOnCapture, setOpenLibraryOnCapture] = useState(false)

  const ringRotation = useRef(new Animated.Value(0)).current
  const scanLineY = useRef(new Animated.Value(0)).current
  const pulseOpacity = useRef(new Animated.Value(0.15)).current
  const progressOpacity = useSharedValue(0)

  const photoCount = photos.filter(Boolean).length
  const canProceedFromCapture = photoCount >= 1

  // Pre-fill weight from profile when entering weight step
  useEffect(() => {
    if (step === 'weight' && profile?.weight_kg != null) {
      const displayVal =
        weightUnit === 'lb'
          ? (profile.weight_kg * 2.20462).toFixed(1)
          : profile.weight_kg.toFixed(1)
      setWeightInput(displayVal)
    }
  }, [step, profile?.weight_kg, weightUnit])

  const normalizedWeight = weightInput.replace(',', '.')
  const weightValue =
    normalizedWeight.trim().length === 0 ? null : parseFloat(normalizedWeight)
  const weightKg =
    weightValue !== null && !Number.isNaN(weightValue)
      ? convertInputToKg(weightValue)
      : null
  const hasValidWeight = weightKg !== null && weightKg >= 20 && weightKg <= 500

  const handleBack = useCallback(() => {
    haptic('light')
    if (step === 'intro') {
      router.back()
    } else if (step === 'capture') {
      setStep('intro')
    } else if (step === 'weight') {
      setStep('capture')
    } else if (step === 'teaser') {
      router.back()
    }
    // processing: no back
  }, [step, router])

  // ── Intro ─────────────────────────────────────────────────────────────────

  const handleGetStarted = useCallback(() => {
    haptic('medium')
    setOpenLibraryOnCapture(false)
    setStep('capture')
  }, [])

  const handleUploadFromGallery = useCallback(() => {
    haptic('medium')
    setOpenLibraryOnCapture(true)
    setStep('capture')
  }, [])

  // ── Capture ─────────────────────────────────────────────────────────────────

  const handleTakePhoto = useCallback(async (slotIndex: number) => {
    if (!user) return

    const currentStatus = await ImagePicker.getCameraPermissionsAsync()
    if (currentStatus.status === 'denied' && !currentStatus.canAskAgain) {
      Alert.alert(
        'Camera Access Needed',
        Platform.select({
          ios: 'To take body scan photos, enable camera in Settings > Rep AI > Camera.',
          android: 'Enable camera in Settings > Apps > Rep AI > Permissions.',
        }),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      )
      return
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission',
        'Camera access is required for body scans.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      )
      return
    }

    haptic('medium')
    setIsTakingPhoto(true)
    setActivePhotoSlot(slotIndex)

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        aspect: [3, 4],
        quality: 0.8,
      })
      if (!result.canceled && result.assets[0]) {
        setPhotos((prev) => {
          const next = [...prev]
          next[slotIndex] = result.assets[0].uri
          return next
        })
        hapticSuccess()
      }
    } catch (e) {
      console.error('[BodyScan] Camera error:', e)
      Alert.alert('Camera Error', 'Failed to open camera.')
    } finally {
      setIsTakingPhoto(false)
      setActivePhotoSlot(null)
    }
  }, [user])

  const handleChooseFromLibrary = useCallback(async (slotIndex: number) => {
    if (!user) return

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Photo Library', 'Library access is required.')
      return
    }

    haptic('medium')
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      aspect: [3, 4],
      quality: 0.8,
      allowsMultipleSelection: false,
    })
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => {
        const next = [...prev]
        next[slotIndex] = result.assets[0].uri
        return next
      })
      hapticSuccess()
    }
  }, [user])

  const handlePhotoSlotPress = useCallback(
    (slotIndex: number) => {
      if (photos[slotIndex]) {
        Alert.alert('Photo', 'Retake or remove?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retake', onPress: () => handleTakePhoto(slotIndex) },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              haptic('light')
              setPhotos((prev) => {
                const next = [...prev]
                next[slotIndex] = null
                return next
              })
            },
          },
        ])
      } else {
        if (Platform.OS === 'ios') {
          ActionSheetIOS.showActionSheetWithOptions(
            {
              options: ['Cancel', 'Take Photo', 'Choose from Library'],
              cancelButtonIndex: 0,
            },
            (idx) => {
              if (idx === 1) handleTakePhoto(slotIndex)
              if (idx === 2) handleChooseFromLibrary(slotIndex)
            },
          )
        } else {
          Alert.alert('Add Photo', 'Choose source', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Take Photo', onPress: () => handleTakePhoto(slotIndex) },
            {
              text: 'Choose from Library',
              onPress: () => handleChooseFromLibrary(slotIndex),
            },
          ])
        }
      }
    },
    [photos, handleTakePhoto, handleChooseFromLibrary],
  )

  const handleContinueFromCapture = useCallback(() => {
    if (!canProceedFromCapture) return
    haptic('medium')
    setStep('weight')
  }, [canProceedFromCapture])

  // ── Weight ─────────────────────────────────────────────────────────────────

  const handleRunScan = useCallback(async () => {
    if (!user) return

    haptic('medium')
    setStep('processing')
    progressOpacity.value = withTiming(1, { duration: 400 })

    const photoUris = photos.filter((u): u is string => Boolean(u))
    let createdEntryId: string | null = null

    // Free user: teaser flow
    if (!isProMember) {
      const teaserTime = 3500 + Math.random() * 1500
      const msgInterval = setInterval(() => {
        setCurrentMessageIndex((i) => (i + 1) % SCANNING_MESSAGES.length)
      }, 2500)
      await new Promise((r) => setTimeout(r, teaserTime))
      clearInterval(msgInterval)
      progressOpacity.value = withTiming(0, { duration: 300 })
      setStep('teaser')
      return
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not authenticated')

      // Create entry first, then upload images to it (single upload)
      const entry = await database.bodyLog.createEntry(user.id, {
        weightKg: hasValidWeight ? weightKg : undefined,
      })
      createdEntryId = entry.id

      const { uploadBodyLogImages } = await import('@/lib/utils/body-log-storage')
      const filePaths = await uploadBodyLogImages(photoUris, user.id, entry.id)
      for (let i = 0; i < filePaths.length; i++) {
        await database.bodyLog.addImage(entry.id, user.id, filePaths[i], i + 1)
      }

      const response = await callSupabaseFunction(
        'body-log-analyze',
        'POST',
        { entryId: entry.id },
        {},
        token,
      )

      if (!response.ok) {
        let msg = `Analysis failed (${response.status})`
        try {
          const err = await response.json()
          if (err.error || err.message) msg = err.error ?? err.message
        } catch {}
        throw new Error(msg)
      }

      const { metrics } = await response.json()

      await supabase
        .from('body_log_entries')
        .update({
          weight_kg: metrics.weight_kg ?? (hasValidWeight ? weightKg : entry.weight_kg),
          body_fat_percentage: metrics.body_fat_percentage,
          bmi: metrics.bmi,
          lean_mass_kg: metrics.lean_mass_kg,
          fat_mass_kg: metrics.fat_mass_kg,
          score_v_taper: metrics.score_v_taper,
          score_chest: metrics.score_chest,
          score_shoulders: metrics.score_shoulders,
          score_abs: metrics.score_abs,
          score_arms: metrics.score_arms,
          score_back: metrics.score_back,
          score_legs: metrics.score_legs,
          analysis_summary: metrics.analysis_summary,
        })
        .eq('id', entry.id)
        .eq('user_id', user.id)

      hapticSuccess()
      progressOpacity.value = withTiming(0, { duration: 300 })

      router.replace({
        pathname: '/body-log/[entryId]',
        params: { entryId: entry.id },
      })
    } catch (error) {
      console.error('[BodyScan] Error:', error)
      progressOpacity.value = withTiming(0, { duration: 300 })
      if (createdEntryId) {
        try {
          await database.bodyLog.deleteEntry(createdEntryId)
        } catch {
          // Best-effort cleanup
        }
      }
      setStep('weight')
      Alert.alert(
        'Scan Failed',
        'Could not analyze your photos. Please try again.',
      )
    } finally {
      // No temp images to delete - we upload directly to entry now
    }
  }, [
    user,
    photos,
    hasValidWeight,
    weightKg,
    progressOpacity,
    router,
    isProMember,
  ])

  const handleSkipWeight = useCallback(() => {
    haptic('light')
    handleRunScan()
  }, [handleRunScan])

  // Processing message cycle
  useEffect(() => {
    if (step === 'processing') {
      const msgInterval = setInterval(() => {
        setCurrentMessageIndex((i) => (i + 1) % SCANNING_MESSAGES.length)
      }, 2500)
      return () => clearInterval(msgInterval)
    }
  }, [step])

  const spinInterpolate = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  useEffect(() => {
    if (step === 'processing') {
      ringRotation.setValue(0)
      scanLineY.setValue(0)
      pulseOpacity.setValue(0.15)

      const spinAnim = Animated.loop(
        Animated.timing(ringRotation, {
          toValue: 1,
          duration: 2400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      )

      const scanAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineY, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanLineY, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      )

      const pulseAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.35,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.08,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      )

      spinAnim.start()
      scanAnim.start()
      pulseAnim.start()
      return () => {
        spinAnim.stop()
        scanAnim.stop()
        pulseAnim.stop()
      }
    }
  }, [step, ringRotation, scanLineY, pulseOpacity])

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progressOpacity.value,
  }))

  // When navigating to capture with "Upload from Gallery", open library picker
  useEffect(() => {
    if (step === 'capture' && openLibraryOnCapture && user) {
      setOpenLibraryOnCapture(false)
      const openLib = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
          Alert.alert('Photo Library', 'Library access is required.')
          return
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          aspect: [3, 4],
          quality: 0.8,
          allowsMultipleSelection: true,
        })
        if (!result.canceled && result.assets.length > 0) {
          setPhotos((prev) => {
            const next = [...prev]
            result.assets.slice(0, 3).forEach((a, i) => {
              next[i] = a.uri
            })
            return next
          })
          hapticSuccess()
        }
      }
      openLib()
    }
  }, [step, openLibraryOnCapture, user])

  const styles = createStyles(colors)

  return (
    <View style={styles.root}>
      {/* Header - hidden on intro (intro has its own close) */}
      {step !== 'intro' && (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          {step !== 'processing' && (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <View style={styles.stepIndicator}>
            {(['intro', 'capture', 'weight'] as const).map((s, i) => {
              const isActive =
                (step === 'capture' && i <= 1) ||
                ((step === 'weight' || step === 'processing' || step === 'teaser') && i <= 2)
              return (
                <View
                  key={s}
                  style={[
                    styles.stepDot,
                    { backgroundColor: isActive ? colors.brandPrimary : 'rgba(255,255,255,0.2)' },
                  ]}
                />
              )
            })}
          </View>
          <View style={styles.backBtn} />
        </View>
      )}

      {/* Intro step - fullscreen background + dark theme */}
      {step === 'intro' && (
        <Reanimated.View entering={FadeIn.duration(300)} style={styles.introFullscreen}>
          <Image
            source={require('../../assets/images/scan/body-scan.png')}
            style={styles.introBgImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.75)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            style={[styles.introCloseBtn, { top: insets.top + 8 }]}
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={[styles.introContent, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.introTitleDark}>
              Enhance Your Fitness Program With An AI Body Scan
            </Text>
            <Text style={styles.introBodyDark}>
              Get AI-powered insights into valuable body data like body fat and muscle mass in minutes!
            </Text>
            <TouchableOpacity
              style={styles.introPrimaryBtn}
              onPress={handleGetStarted}
              activeOpacity={0.8}
            >
              <Text style={styles.introPrimaryBtnText}>Scan My Body</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.introSecondaryBtn}
              onPress={handleUploadFromGallery}
              activeOpacity={0.8}
            >
              <Text style={styles.introSecondaryBtnText}>Upload Photo from Gallery</Text>
            </TouchableOpacity>
          </View>
        </Reanimated.View>
      )}

      {/* Capture step */}
      {step === 'capture' && (
        <Reanimated.View
          entering={FadeIn.duration(300)}
          style={[styles.stepContent, { paddingBottom: insets.bottom + 24 }]}
        >
          <View style={styles.captureTop}>
            <Text style={styles.captureTitle}>Add Photos</Text>
            <Text style={styles.captureSubtitle}>
              1–3 photos from different angles for best results.
            </Text>
          </View>

          <View style={styles.captureCenter}>
            <View style={styles.photoGrid}>
              {photos.map((uri, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.photoSlot,
                    uri && styles.photoSlotFilled,
                  ]}
                  onPress={() => handlePhotoSlotPress(i)}
                  disabled={isTakingPhoto}
                  activeOpacity={0.85}
                >
                  {uri ? (
                    <>
                      <Image source={{ uri }} style={styles.photoImg} contentFit="cover" />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.4)']}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.photoCheck}>
                        <Ionicons name="checkmark-circle" size={28} color="#fff" />
                      </View>
                      <Text style={styles.photoSlotNumberFilled}>
                        {i + 1}
                      </Text>
                    </>
                  ) : (
                    <>
                      {isTakingPhoto && activePhotoSlot === i ? (
                        <ActivityIndicator size="small" color={colors.brandPrimary} />
                      ) : (
                        <>
                          <View style={styles.photoSlotIconWrap}>
                            <Ionicons name="camera" size={28} color={colors.brandPrimary} />
                          </View>
                          <Text style={styles.photoSlotLabel}>
                            {i === 0 ? 'Front' : i === 1 ? 'Side' : 'Back'}
                          </Text>
                        </>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.captureHint}>
              <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.45)" />
              <Text style={styles.captureHintText}>
                Tap a slot to take a photo or choose from library
              </Text>
            </View>
          </View>

          <View style={styles.captureBottom}>
            <TouchableOpacity
              style={[
                styles.captureContinueBtn,
                canProceedFromCapture
                  ? { backgroundColor: '#FFFFFF' }
                  : { backgroundColor: 'rgba(255,255,255,0.12)' },
              ]}
              onPress={handleContinueFromCapture}
              disabled={!canProceedFromCapture}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.captureContinueBtnText,
                  { color: canProceedFromCapture ? '#000000' : 'rgba(255,255,255,0.35)' },
                ]}
              >
                Continue
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={canProceedFromCapture ? '#000000' : 'rgba(255,255,255,0.35)'}
              />
            </TouchableOpacity>
            <Text style={styles.captureCounter}>
              {photoCount} of {MAX_PHOTOS} photos added
            </Text>
          </View>
        </Reanimated.View>
      )}

      {/* Weight step */}
      {step === 'weight' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Reanimated.View
            entering={FadeIn.duration(300)}
            style={[styles.stepContent, { paddingBottom: insets.bottom + 24 }]}
          >
            <View style={styles.weightTop}>
              <Text style={styles.weightTitle}>Enter Your Weight</Text>
              <Text style={styles.weightSubtitle}>
                Used to calculate lean mass & fat mass. You can skip this.
              </Text>
            </View>

            <View style={styles.weightCenter}>
              <View style={styles.weightInputRow}>
                <TextInput
                  style={styles.weightInput}
                  value={weightInput}
                  onChangeText={(v) =>
                    setWeightInput(v.replace(/[^0-9.,]/g, '').replace(/,/g, '.'))
                  }
                  placeholder={weightUnit === 'kg' ? '75' : '165'}
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="decimal-pad"
                  selectionColor={colors.brandPrimary}
                />
                <View style={styles.weightUnitBadge}>
                  <Text style={styles.weightUnitText}>{weightUnit}</Text>
                </View>
              </View>
            </View>

            <View style={styles.weightBottom}>
              <TouchableOpacity
                style={[
                  styles.captureContinueBtn,
                  { backgroundColor: '#FFFFFF' },
                ]}
                onPress={handleRunScan}
                activeOpacity={0.8}
              >
                <Ionicons name="scan" size={20} color="#000000" />
                <Text style={[styles.captureContinueBtnText, { color: '#000000' }]}>
                  Run Body Scan
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={handleSkipWeight}
                activeOpacity={0.7}
              >
                <Text style={styles.skipBtnText}>Skip weight</Text>
              </TouchableOpacity>
            </View>
          </Reanimated.View>
        </KeyboardAvoidingView>
      )}

      {/* Teaser step (free users) */}
      {step === 'teaser' && (
        <Reanimated.View
          entering={FadeIn.duration(300)}
          style={[styles.stepContent, { paddingBottom: insets.bottom + 24 }]}
        >
          <ScrollView
            contentContainerStyle={styles.teaserScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.teaserLock}>
              <Ionicons name="lock-closed" size={40} color="rgba(255,255,255,0.5)" />
            </View>
            <Text style={styles.teaserTitle}>Upgrade to Pro</Text>
            <Text style={styles.teaserSubtitle}>
              Unlock AI body composition analysis with body fat %, lean mass, and physique scores.
            </Text>
            <TouchableOpacity
              style={[styles.captureContinueBtn, { backgroundColor: colors.brandPrimary }]}
              onPress={() => {
                haptic('medium')
                setPaywallVisible(true)
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.captureContinueBtnText, { color: '#fff' }]}>Upgrade to Pro</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBack} style={styles.skipBtn}>
              <Text style={styles.skipBtnText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </Reanimated.View>
      )}

      <Paywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />

      {/* Processing step */}
      {step === 'processing' && (
        <Reanimated.View style={[styles.processingWrap, progressAnimatedStyle]}>

          {/* Outer pulse ring */}
          <Animated.View style={[styles.ringPulse, { opacity: pulseOpacity }]} />

          {/* Static thin ring */}
          <View style={styles.ringStatic} />

          {/* Spinning arc */}
          <Animated.View
            style={[
              styles.ringArc,
              { transform: [{ rotate: spinInterpolate }] },
            ]}
          />

          {/* Scan line sweeping through center */}
          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [{
                  translateY: scanLineY.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-48, 48],
                  }),
                }],
              },
            ]}
          />

          {/* Text */}
          <View style={styles.processingTextWrap}>
            <Text style={styles.processingTitle}>ANALYZING</Text>
            <Text style={styles.processingMsg}>
              {SCANNING_MESSAGES[currentMessageIndex]}
            </Text>
          </View>

        </Reanimated.View>
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#000000',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      zIndex: 1,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepIndicator: {
      flexDirection: 'row',
      gap: 8,
    },
    stepDot: {
      width: 28,
      height: 4,
      borderRadius: 2,
    },
    stepContent: {
      flex: 1,
      paddingHorizontal: 24,
    },

    // ── Intro (fullscreen bg) ──────────────────────────────────────────────
    introFullscreen: {
      ...StyleSheet.absoluteFillObject,
    },
    introBgImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    introCloseBtn: {
      position: 'absolute',
      right: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    introContent: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    introTitleDark: {
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: '#FFFFFF',
      marginBottom: 12,
      lineHeight: 34,
    },
    introBodyDark: {
      fontSize: 15,
      lineHeight: 22,
      color: 'rgba(255,255,255,0.9)',
      marginBottom: 28,
    },
    introPrimaryBtn: {
      backgroundColor: '#FFFFFF',
      paddingVertical: 16,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    introPrimaryBtnText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#000000',
      letterSpacing: -0.3,
    },
    introSecondaryBtn: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingVertical: 16,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    introSecondaryBtnText: {
      fontSize: 17,
      fontWeight: '600',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },

    // ── Capture ────────────────────────────────────────────────────────────
    captureTop: {
      gap: 8,
      marginBottom: 8,
    },
    captureTitle: {
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.7,
      color: '#FFFFFF',
    },
    captureSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: 'rgba(255,255,255,0.6)',
    },
    captureCenter: {
      flex: 1,
      justifyContent: 'center',
      gap: 24,
    },
    photoGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    photoSlot: {
      flex: 1,
      aspectRatio: 3 / 4,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.12)',
      borderStyle: 'dashed',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    photoSlotFilled: {
      borderWidth: 0,
      borderStyle: 'solid',
    },
    photoSlotIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: `${colors.brandPrimary}18`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    photoImg: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    photoCheck: {
      position: 'absolute',
      bottom: 10,
      right: 10,
    },
    photoSlotLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.4)',
      marginTop: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    photoSlotNumberFilled: {
      position: 'absolute',
      top: 10,
      left: 12,
      fontSize: 13,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.7)',
    },
    captureHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    captureHintText: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.35)',
      fontWeight: '500',
    },
    captureBottom: {
      gap: 12,
      alignItems: 'center',
    },
    captureContinueBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 17,
      borderRadius: 28,
      width: '100%',
    },
    captureContinueBtnText: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    captureCounter: {
      fontSize: 13,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.35)',
    },

    // ── Weight ─────────────────────────────────────────────────────────────
    weightTop: {
      alignItems: 'center',
      gap: 10,
      paddingTop: 16,
    },
    weightTitle: {
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: '#FFFFFF',
    },
    weightSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: 'rgba(255,255,255,0.5)',
      textAlign: 'center',
    },
    weightCenter: {
      flex: 1,
      justifyContent: 'center',
    },
    weightInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.12)',
      paddingHorizontal: 8,
    },
    weightInput: {
      flex: 1,
      fontSize: 40,
      fontWeight: '700',
      color: '#FFFFFF',
      paddingVertical: 20,
      paddingHorizontal: 16,
      letterSpacing: -1,
      textAlign: 'center',
    },
    weightUnitBadge: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
    },
    weightUnitText: {
      fontSize: 16,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.5)',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    weightBottom: {
      gap: 8,
      alignItems: 'center',
    },

    // ── Shared ─────────────────────────────────────────────────────────────
    skipBtn: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    skipBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.45)',
    },

    // ── Teaser ─────────────────────────────────────────────────────────────
    teaserScroll: {
      alignItems: 'center',
      paddingTop: 48,
      gap: 16,
    },
    teaserLock: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    teaserTitle: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.5,
      textAlign: 'center',
      color: '#FFFFFF',
    },
    teaserSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      maxWidth: 300,
      color: 'rgba(255,255,255,0.55)',
    },

    // ── Processing ─────────────────────────────────────────────────────────
    processingWrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringPulse: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      borderWidth: 1,
      borderColor: colors.brandPrimary,
    },
    ringStatic: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    ringArc: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      borderWidth: 1.5,
      borderTopColor: colors.brandPrimary,
      borderRightColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: 'transparent',
    },
    scanLine: {
      width: 60,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.brandPrimary,
      opacity: 0.7,
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
    },
    processingTextWrap: {
      alignItems: 'center',
      gap: 8,
      marginTop: 52,
    },
    processingTitle: {
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 4,
      color: '#FFFFFF',
    },
    processingMsg: {
      fontSize: 13,
      fontWeight: '400',
      letterSpacing: 0.5,
      color: 'rgba(255,255,255,0.35)',
    },
  })
