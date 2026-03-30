import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useUnit } from '@/contexts/unit-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { haptic, hapticSuccess } from '@/lib/haptics'
import { supabase } from '@/lib/supabase'
import { callSupabaseFunction } from '@/lib/supabase-functions-client'
import { deleteBodyLogImage, uploadBodyLogImage } from '@/lib/utils/body-log-storage'
import { normalizeImageUris } from '@/lib/utils/image-normalization'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

type Step = 'setup' | 'scanning' | 'results'

interface ScanMetrics {
  body_fat_percentage: number | null
  bmi: number | null
  lean_mass_kg: number | null
  fat_mass_kg: number | null
  weight_kg: number | null
  score_v_taper: number | null
  score_chest: number | null
  score_shoulders: number | null
  score_abs: number | null
  score_arms: number | null
  score_back: number | null
  score_legs: number | null
  analysis_summary: string | null
}

interface BodyScanModalProps {
  visible: boolean
  onClose: () => void
  onScanSaved: () => void
}

const SCANNING_MESSAGES = [
  'Uploading photos',
  'Analyzing composition',
  'Processing metrics',
  'Calculating results',
]

export function BodyScanModal({ visible, onClose, onScanSaved }: BodyScanModalProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { isProMember } = useSubscription()
  const { weightUnit, convertInputToKg, formatWeight } = useUnit()

  const [step, setStep] = useState<Step>('setup')
  const [photoUris, setPhotoUris] = useState<string[]>([])
  const [weightInput, setWeightInput] = useState('')
  const [scanMetrics, setScanMetrics] = useState<ScanMetrics | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)

  // Animations for scanning step
  const ringRotation = useRef(new Animated.Value(0)).current
  const pulseScale = useRef(new Animated.Value(1)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const successScale = useRef(new Animated.Value(0.8)).current
  const successOpacity = useRef(new Animated.Value(0)).current

  // Pre-fill weight from profile
  useEffect(() => {
    if (visible && profile?.weight_kg) {
      const displayVal =
        weightUnit === 'lb'
          ? (profile.weight_kg * 2.20462).toFixed(1)
          : profile.weight_kg.toFixed(1)
      setWeightInput(displayVal)
    }
  }, [visible, profile?.weight_kg, weightUnit])

  // Scan animation
  useEffect(() => {
    if (step === 'scanning' && !showSuccess) {
      ringRotation.setValue(0)
      Animated.loop(
        Animated.timing(ringRotation, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start()

      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseScale, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulseScale, { toValue: 1, duration: 1200, useNativeDriver: true }),
          ]),
        ]),
      ).start()

      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start()

      const msgInterval = setInterval(() => {
        setCurrentMessageIndex((i) => (i + 1) % SCANNING_MESSAGES.length)
      }, 2500)

      return () => clearInterval(msgInterval)
    }
  }, [step, showSuccess, ringRotation, pulseScale, contentOpacity])

  const spinInterpolate = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const handleClose = () => {
    if (step === 'scanning') return // prevent dismissing during scan
    haptic('light')
    resetState()
    onClose()
  }

  const resetState = () => {
    setStep('setup')
    setPhotoUris([])
    setWeightInput('')
    setScanMetrics(null)
    setIsSaving(false)
    setCurrentMessageIndex(0)
    setShowSuccess(false)
    ringRotation.setValue(0)
    contentOpacity.setValue(0)
    successScale.setValue(0.8)
    successOpacity.setValue(0)
  }

  // ── Photo selection ──────────────────────────────────────────────────────────

  const handleAddPhoto = () => {
    if (photoUris.length >= 3) {
      Alert.alert('Limit Reached', 'Up to 3 photos per scan.')
      return
    }
    haptic('light')

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) launchCamera()
          else if (idx === 2) launchLibrary()
        },
      )
    } else {
      Alert.alert('Add Photo', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: launchCamera },
        { text: 'Choose from Library', onPress: launchLibrary },
      ])
    }
  }

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Camera Permission', 'Camera access is required to take photos.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      aspect: [3, 4],
      quality: 0.8,
    })
    if (!result.canceled && result.assets.length > 0) {
      const normalizedUris = await normalizeImageUris([
        result.assets[0].uri,
      ])
      addPhotoUris(normalizedUris)
    }
  }

  const launchLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Photo Library Permission', 'Photo library access is required.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      aspect: [3, 4],
      quality: 0.8,
      allowsMultipleSelection: true,
    })
    if (!result.canceled && result.assets.length > 0) {
      const normalizedUris = await normalizeImageUris(
        result.assets.map((a) => a.uri),
      )
      addPhotoUris(normalizedUris)
    }
  }

  const addPhotoUris = (uris: string[]) => {
    setPhotoUris((prev) => {
      const slots = 3 - prev.length
      return [...prev, ...uris.slice(0, slots)]
    })
  }

  const removePhoto = (index: number) => {
    haptic('light')
    setPhotoUris((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Weight ───────────────────────────────────────────────────────────────────

  const normalizedWeight = weightInput.replace(',', '.')
  const weightValue =
    normalizedWeight.trim().length === 0 ? null : parseFloat(normalizedWeight)
  const weightKg =
    weightValue !== null && !Number.isNaN(weightValue)
      ? convertInputToKg(weightValue)
      : null
  const hasValidWeight = weightKg !== null && weightKg >= 20 && weightKg <= 500

  // ── Run scan ─────────────────────────────────────────────────────────────────

  const canScan = photoUris.length >= 1

  const handleRunScan = async () => {
    if (!user || !canScan) return
    haptic('medium')

    // For free users: show teaser
    if (!isProMember) {
      setStep('scanning')
      setTimeout(() => {
        setShowSuccess(true)
        setTimeout(() => {
          setStep('results')
          setScanMetrics(null) // null = locked/teaser
        }, 800)
      }, 3500 + Math.random() * 1500)
      return
    }

    setStep('scanning')

    const uploadedPaths: string[] = []

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not authenticated')

      // Upload temp images (stored under user's folder, prefixed scan-temp)
      for (let i = 0; i < photoUris.length; i++) {
        const path = await uploadBodyLogImage(
          photoUris[i],
          user.id,
          `scan-temp`,
          i + 1,
        )
        uploadedPaths.push(path)
      }

      // Call edge function in standalone mode
      const response = await callSupabaseFunction(
        'body-log-analyze',
        'POST',
        {
          imagePaths: uploadedPaths,
          weightKg: hasValidWeight ? weightKg : null,
        },
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

      hapticSuccess()
      setShowSuccess(true)
      setScanMetrics(metrics)

      setTimeout(() => {
        setStep('results')
      }, 800)
    } catch (error) {
      console.error('[BodyScan] Error:', error)
      setStep('setup')
      Alert.alert('Scan Failed', 'Could not analyze your photos. Please try again.')
    } finally {
      // Always delete temp images from storage
      for (const path of uploadedPaths) {
        deleteBodyLogImage(path).catch(() => {})
      }
    }
  }

  // ── Save results ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!user || !scanMetrics) return
    haptic('medium')
    setIsSaving(true)

    try {
      const entry = await database.bodyLog.createEntry(user.id)
      const resolvedWeightKg =
        scanMetrics.weight_kg ?? (hasValidWeight ? weightKg : undefined) ?? undefined

      if (resolvedWeightKg !== undefined) {
        await database.dailyLog.updateDay(user.id, {
          logDate: entry.created_at,
          weightKg: resolvedWeightKg,
        })
      }

      const { error } = await supabase
        .from('body_log_entries')
        .update({
          body_fat_percentage: scanMetrics.body_fat_percentage,
          bmi: scanMetrics.bmi,
          lean_mass_kg: scanMetrics.lean_mass_kg,
          fat_mass_kg: scanMetrics.fat_mass_kg,
          score_v_taper: scanMetrics.score_v_taper,
          score_chest: scanMetrics.score_chest,
          score_shoulders: scanMetrics.score_shoulders,
          score_abs: scanMetrics.score_abs,
          score_arms: scanMetrics.score_arms,
          score_back: scanMetrics.score_back,
          score_legs: scanMetrics.score_legs,
          analysis_summary: scanMetrics.analysis_summary,
        })
        .eq('id', entry.id)

      if (error) throw error

      hapticSuccess()
      resetState()
      onClose()
      onScanSaved()
    } catch (e) {
      console.error('[BodyScan] Save error:', e)
      Alert.alert('Save Failed', 'Could not save your results. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const styles = createStyles(colors)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={styles.header}>
          {step === 'setup' && (
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {step === 'results' && (
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Body Scan</Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Setup step */}
        {step === 'setup' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={[styles.setupContent, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Photos section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Photos</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Add 1–3 photos from different angles for better accuracy. Photos are only used
                  for this scan and are never saved.
                </Text>

                <View style={styles.photoGrid}>
                  {photoUris.map((uri, i) => (
                    <View key={i} style={styles.photoSlot}>
                      <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                      <TouchableOpacity
                        style={[styles.photoRemoveBtn, { backgroundColor: colors.bg }]}
                        onPress={() => removePhoto(i)}
                      >
                        <Ionicons name="close-circle" size={22} color={colors.statusError} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {photoUris.length < 3 && (
                    <TouchableOpacity
                      style={[styles.photoAddSlot, { borderColor: colors.border, backgroundColor: colors.surfaceSubtle }]}
                      onPress={handleAddPhoto}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={32} color={colors.textSecondary} />
                      <Text style={[styles.photoAddText, { color: colors.textSecondary }]}>
                        Add Photo
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Weight section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Weight{' '}
                  <Text style={[styles.optionalLabel, { color: colors.textSecondary }]}>
                    (optional)
                  </Text>
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Used to calculate lean & fat mass.
                </Text>

                <View style={styles.weightInputRow}>
                  <TextInput
                    style={[
                      styles.weightInput,
                      {
                        color: colors.textPrimary,
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                      },
                    ]}
                    value={weightInput}
                    onChangeText={(v) => setWeightInput(v.replace(/[^0-9.,]/g, '').replace(/,/g, '.'))}
                    placeholder={weightUnit === 'kg' ? 'e.g. 75.0' : 'e.g. 165.0'}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[styles.weightUnit, { color: colors.textSecondary }]}>
                    {weightUnit}
                  </Text>
                </View>
              </View>

              {/* Disclaimer */}
              <View style={[styles.disclaimer, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
                  AI estimates are approximate. Results may vary based on photo quality and angles.
                </Text>
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={[
                  styles.scanBtn,
                  { backgroundColor: colors.textPrimary },
                  !canScan && { opacity: 0.4 },
                ]}
                onPress={handleRunScan}
                disabled={!canScan}
                activeOpacity={0.8}
              >
                <Ionicons name="scan" size={20} color={colors.bg} />
                <Text style={[styles.scanBtnText, { color: colors.bg }]}>Run Body Scan</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* Scanning step */}
        {step === 'scanning' && (
          <View style={styles.scanningContainer}>
            <Animated.View
              style={[
                styles.ringOuter,
                {
                  borderColor: colors.brandPrimary + '40',
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.ringSpinner,
                {
                  borderTopColor: colors.brandPrimary,
                  borderRightColor: colors.brandPrimary + '30',
                  borderBottomColor: colors.brandPrimary + '30',
                  borderLeftColor: colors.brandPrimary + '30',
                  transform: [{ rotate: spinInterpolate }],
                },
              ]}
            />
            <Animated.View style={[styles.scanningContent, { opacity: contentOpacity }]}>
              <View style={[styles.scanIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="scan" size={36} color={colors.brandPrimary} />
              </View>
              <Text style={[styles.scanningTitle, { color: colors.textPrimary }]}>
                Analyzing Your Body
              </Text>
              <Text style={[styles.scanningMessage, { color: colors.textSecondary }]}>
                {SCANNING_MESSAGES[currentMessageIndex]}…
              </Text>
            </Animated.View>
          </View>
        )}

        {/* Results step */}
        {step === 'results' && (
          <ScrollView
            contentContainerStyle={[styles.resultsContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {scanMetrics === null ? (
              // Teaser (free user)
              <View style={styles.teaserContainer}>
                <View style={[styles.teaserLock, { backgroundColor: colors.surfaceSubtle }]}>
                  <Ionicons name="lock-closed" size={40} color={colors.textSecondary} />
                </View>
                <Text style={[styles.teaserTitle, { color: colors.textPrimary }]}>
                  Upgrade to Pro
                </Text>
                <Text style={[styles.teaserSubtitle, { color: colors.textSecondary }]}>
                  Unlock AI body composition analysis with body fat %, lean mass, and physique
                  scores.
                </Text>
                <TouchableOpacity
                  style={[styles.scanBtn, { backgroundColor: colors.brandPrimary, marginTop: 24 }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.scanBtnText, { color: '#fff' }]}>Upgrade to Pro</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClose} style={{ marginTop: 16 }}>
                  <Text style={[styles.discardText, { color: colors.textSecondary }]}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={[styles.resultsTitle, { color: colors.textPrimary }]}>
                  Scan Complete
                </Text>

                {/* Primary metric */}
                {scanMetrics.body_fat_percentage !== null && (
                  <View style={[styles.primaryMetric, { backgroundColor: colors.surfaceSubtle }]}>
                    <Text style={[styles.primaryMetricValue, { color: colors.textPrimary }]}>
                      {scanMetrics.body_fat_percentage.toFixed(1)}%
                    </Text>
                    <Text style={[styles.primaryMetricLabel, { color: colors.textSecondary }]}>
                      Body Fat
                    </Text>
                  </View>
                )}

                {/* Secondary metrics */}
                <View style={styles.metricsGrid}>
                  {scanMetrics.lean_mass_kg !== null && (
                    <MetricCard
                      label="Lean Mass"
                      value={`${scanMetrics.lean_mass_kg.toFixed(1)} kg`}
                      colors={colors}
                    />
                  )}
                  {scanMetrics.fat_mass_kg !== null && (
                    <MetricCard
                      label="Fat Mass"
                      value={`${scanMetrics.fat_mass_kg.toFixed(1)} kg`}
                      colors={colors}
                    />
                  )}
                  {scanMetrics.bmi !== null && (
                    <MetricCard
                      label="BMI"
                      value={scanMetrics.bmi.toFixed(1)}
                      colors={colors}
                    />
                  )}
                  {scanMetrics.weight_kg !== null && (
                    <MetricCard
                      label="Weight"
                      value={formatWeight(scanMetrics.weight_kg)}
                      colors={colors}
                    />
                  )}
                </View>

                {/* Analysis summary */}
                {scanMetrics.analysis_summary && (
                  <View style={[styles.summaryCard, { backgroundColor: colors.surfaceSubtle }]}>
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                      {scanMetrics.analysis_summary}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <TouchableOpacity
                  style={[
                    styles.scanBtn,
                    { backgroundColor: colors.textPrimary },
                    isSaving && { opacity: 0.6 },
                  ]}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.8}
                >
                  {isSaving ? (
                    <ActivityIndicator color={colors.bg} size="small" />
                  ) : (
                    <Text style={[styles.scanBtnText, { color: colors.bg }]}>Save Results</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleClose} style={{ marginTop: 12 }}>
                  <Text style={[styles.discardText, { color: colors.textSecondary }]}>Discard</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}

function MetricCard({
  label,
  value,
  colors,
}: {
  label: string
  value: string
  colors: ReturnType<typeof useThemedColors>
}) {
  return (
    <View style={[metricCardStyles.card, { backgroundColor: colors.surfaceSubtle }]}>
      <Text style={[metricCardStyles.value, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[metricCardStyles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  )
}

const metricCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
})

type Colors = ReturnType<typeof useThemedColors>

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    closeBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Setup
    setupContent: {
      paddingHorizontal: 20,
      gap: 28,
    },
    section: {
      gap: 10,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    optionalLabel: {
      fontSize: 14,
      fontWeight: '500',
    },
    sectionSubtitle: {
      fontSize: 14,
      lineHeight: 20,
    },
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 4,
    },
    photoSlot: {
      width: (SCREEN_WIDTH - 40 - 20) / 3,
      aspectRatio: 3 / 4,
      borderRadius: 12,
      overflow: 'hidden',
    },
    photoThumb: {
      width: '100%',
      height: '100%',
    },
    photoRemoveBtn: {
      position: 'absolute',
      top: 4,
      right: 4,
      borderRadius: 11,
    },
    photoAddSlot: {
      width: (SCREEN_WIDTH - 40 - 20) / 3,
      aspectRatio: 3 / 4,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    photoAddText: {
      fontSize: 12,
      fontWeight: '600',
    },
    weightInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    weightInput: {
      flex: 1,
      fontSize: 24,
      fontWeight: '700',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 2,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    weightUnit: {
      fontSize: 18,
      fontWeight: '600',
      width: 32,
    },
    disclaimer: {
      flexDirection: 'row',
      gap: 8,
      padding: 14,
      borderRadius: 12,
      alignItems: 'flex-start',
    },
    disclaimerText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
    },
    scanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 16,
    },
    scanBtnText: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    // Scanning
    scanningContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0,
    },
    ringOuter: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      borderWidth: 2,
    },
    ringSpinner: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
      borderWidth: 3,
    },
    scanningContent: {
      alignItems: 'center',
      gap: 12,
    },
    scanIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanningTitle: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.5,
      marginTop: 8,
    },
    scanningMessage: {
      fontSize: 15,
      fontWeight: '500',
    },
    // Results
    resultsContent: {
      paddingHorizontal: 20,
      gap: 20,
    },
    resultsTitle: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.7,
      marginBottom: 4,
    },
    primaryMetric: {
      borderRadius: 20,
      paddingVertical: 32,
      alignItems: 'center',
    },
    primaryMetricValue: {
      fontSize: 56,
      fontWeight: '800',
      letterSpacing: -2,
    },
    primaryMetricLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginTop: 4,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    summaryCard: {
      borderRadius: 16,
      padding: 16,
    },
    summaryText: {
      fontSize: 14,
      lineHeight: 21,
    },
    discardText: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    // Teaser
    teaserContainer: {
      alignItems: 'center',
      paddingTop: 40,
      gap: 12,
    },
    teaserLock: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    teaserTitle: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.6,
    },
    teaserSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      maxWidth: 300,
    },
  })
