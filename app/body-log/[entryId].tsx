import { haptic, hapticSuccess } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native'
import Animated, {
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BodyLogProcessingModal } from '@/components/BodyLogProcessingModal'
import { BodyMetricInfoModal } from '@/components/BodyMetricInfoModal'
import { LockedResultsOverlay } from '@/components/LockedResultsOverlay'
import { Paywall } from '@/components/paywall'
import { ScreenHeader } from '@/components/screen-header'
import { SlideInView } from '@/components/slide-in-view'
import { WeightInputModal } from '@/components/WeightInputModal'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useTutorial } from '@/contexts/tutorial-context'
import { useUnit } from '@/contexts/unit-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
    getBMIExplanation,
    getBMIStatus,
    getBodyFatExplanation,
    getBodyFatStatus,
    getStatusColor,
    getWeightExplanation,
    type BMIRange,
    type BodyFatRange,
    type Gender,
} from '@/lib/body-log/composition-analysis'
import {
    type BodyLogEntryWithImages,
    type BodyLogImage,
} from '@/lib/body-log/metadata'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import {
    getBodyLogImageUrls,
    prefetchBodyLogImages,
} from '@/lib/utils/body-log-storage'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const HERO_HEIGHT = SCREEN_HEIGHT * 0.45

// Helper for intensity (1-4)
const getScoreIntensity = (score: number | null) => {
  if (score === null) return 1
  if (score < 50) return 1 // Red
  if (score < 75) return 2 // Orange
  if (score < 90) return 3 // Green
  return 4 // Blue
}

// Helper component for linear scale (Body Fat / BMI)
const LinearScale = ({ 
  value, 
  min = 0, 
  max = 50, 
  ranges = [], 
  label, 
  unit,
  subLabel,
  colorResolver,
  onPress,
  styles
}: {
  value: number
  min?: number
  max?: number
  ranges?: { label: string, start: number, end: number, color?: string }[]
  label: string
  unit?: string
  subLabel?: string
  colorResolver?: (val: number) => string
  onPress?: () => void
  styles: ReturnType<typeof createStyles>
}) => {
  const colors = useThemedColors()
  const percent = Math.min(Math.max((value - min) / (max - min), 0), 1) * 100
  
  // Calculate specific markers position if ranges provided
  // Only show markers that are within range and not at the very ends to avoid overlap
  const markers = ranges ? ranges
    .filter(r => r.start > min && r.start < max)
    .map(r => ({
      left: Math.min(Math.max((r.start - min) / (max - min), 0), 1) * 100,
      label: r.start
    })) : []
  
  const hideMin = markers.some(m => m.left < 10)
  const hideMax = markers.some(m => m.left > 90)

  return (
    <TouchableOpacity 
      activeOpacity={0.7} 
      onPress={onPress}
      style={styles.scaleContainer}
    >
      <View style={styles.scaleHeader}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.scaleValueBig, { color: colors.textPrimary }]}>
              {value}{unit}
            </Text>
            {subLabel && (
              <View style={[styles.statusBadge, { backgroundColor: colorResolver ? `${colorResolver(value)}20` : 'transparent' }]}>
                <Text style={[styles.scaleSubLabel, { color: colorResolver ? colorResolver(value) : colors.textSecondary }]}>
                  {subLabel}
                </Text>
              </View>
            )}
        </View>
        <View style={[styles.chevronCircle, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
      </View>

      <View style={styles.scaleTrackContainer}>
        {/* Track Background */}
        <View style={[styles.scaleTrack, { backgroundColor: colors.border, opacity: 0.5 }]}>
          {ranges && ranges.map((range, index) => {
             const left = Math.min(Math.max((range.start - min) / (max - min), 0), 1) * 100
             const width = Math.min(Math.max((range.end - range.start) / (max - min), 0), 1) * 100
             return (
                <View 
                  key={index} 
                  style={{ 
                    position: 'absolute', 
                    left: `${left}%`, 
                    width: `${width}%`, 
                    height: '100%', 
                    backgroundColor: range.color || colors.brandPrimary,
                    opacity: 0.35,
                    borderRadius: 2,
                  }} 
                />
              )
           })}
           
           {/* Color segments border (optional subtle dividers) */}
           {ranges && ranges.map((range, index) => {
              const left = Math.min(Math.max((range.start - min) / (max - min), 0), 1) * 100
              if (left === 0) return null
              return (
                <View 
                  key={`div-${index}`} 
                  style={{ 
                    position: 'absolute', 
                    left: `${left}%`, 
                    width: 1, 
                    height: '100%', 
                    backgroundColor: 'rgba(255,255,255,0.1)',
                  }} 
                />
              )
           })}
        </View>

        {/* Thumb */}
        <View style={[styles.scaleThumb, { left: `${percent}%`, backgroundColor: colors.surfaceCard, borderColor: colors.surfaceCard }]}>
           <View style={[styles.scaleThumbInner, { backgroundColor: colorResolver ? colorResolver(value) : colors.textPrimary }]} />
        </View>
        
        {/* Markers */}
        <View style={styles.scaleMarkers}>
           {!hideMin && (
             <View style={{ position: 'absolute', left: '0%', width: 30, marginLeft: -15, alignItems: 'center' }}>
               <View style={[styles.markerTick, { backgroundColor: colors.textSecondary }]} />
               <Text style={[styles.scaleMarkerText, { color: colors.textSecondary }]}>{min}</Text>
             </View>
           )}
           {!hideMax && (
             <View style={{ position: 'absolute', right: '0%', width: 30, marginRight: -15, alignItems: 'center' }}>
               <View style={[styles.markerTick, { backgroundColor: colors.textSecondary }]} />
               <Text style={[styles.scaleMarkerText, { color: colors.textSecondary }]}>{max}</Text>
             </View>
           )}
           {markers.map((m, i) => (
             <View key={i} style={{ position: 'absolute', left: `${m.left}%`, width: 30, marginLeft: -15, alignItems: 'center' }}>
               <View style={[styles.markerTick, { backgroundColor: colors.textSecondary }]} />
               <Text style={[styles.scaleMarkerText, { color: colors.textSecondary, textAlign: 'center' }]}>
                 {m.label}
               </Text>
             </View>
           ))}
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function BodyLogDetailScreen() {
  const { entryId, weightKg, bodyFatPercentage, bmi } = useLocalSearchParams<{
    entryId: string
    weightKg?: string
    bodyFatPercentage?: string
    bmi?: string
  }>()

  const colors = useThemedColors()
  const { formatWeight, weightUnit } = useUnit()
  const { user } = useAuth()
  const { isProMember } = useSubscription()
  const { completeStep } = useTutorial()
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [entry, setEntry] = useState<BodyLogEntryWithImages | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [, setImagesLoading] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [userGender, setUserGender] = useState<Gender>('male')
  const [userHeight, setUserHeight] = useState<number | null>(null)
  const [shouldExit, setShouldExit] = useState(false)

  // Modal states
  const [infoModalVisible, setInfoModalVisible] = useState(false)
  const [weightModalVisible, setWeightModalVisible] = useState(false)
  const [heightModalVisible, setHeightModalVisible] = useState(false)
  const [heightInput, setHeightInput] = useState('')
  const [genderModalVisible, setGenderModalVisible] = useState(false)
  const [paywallVisible, setPaywallVisible] = useState(false)
  const [isRunningBodyScan, setIsRunningBodyScan] = useState(false)
  const [showTeaserResults, setShowTeaserResults] = useState(false)
  const [showProcessingModal, setShowProcessingModal] = useState(false)
  const [processingComplete, setProcessingComplete] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<{
    type: 'bodyFat' | 'bmi' | 'weight'
    value: string
    status: BodyFatRange | BMIRange | null
    explanation: string
  } | null>(null)

  // Parse numeric values from URL params (for initial display)
  const [metrics, setMetrics] = useState({
    weight_kg: weightKg ? parseFloat(weightKg) : null,
    body_fat_percentage: bodyFatPercentage
      ? parseFloat(bodyFatPercentage)
      : null,
    bmi: bmi ? parseFloat(bmi) : null,
    lean_mass_kg: null as number | null,
    fat_mass_kg: null as number | null,
    score_v_taper: null as number | null,
    score_chest: null as number | null,
    score_shoulders: null as number | null,
    score_abs: null as number | null,
    score_arms: null as number | null,
    score_back: null as number | null,
    score_legs: null as number | null,
  })

  // Image modal state
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [fullscreenImageLoading, setFullscreenImageLoading] = useState(true)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Animation for the bottom dock
  const isDockHidden = useSharedValue(0)
  const lastScrollY = useSharedValue(0)

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y
      const diff = currentY - lastScrollY.value

      if (currentY <= 0) {
        isDockHidden.value = 0
      } else if (diff > 5 && currentY > 50) {
        isDockHidden.value = 1
      } else if (diff < -5) {
        isDockHidden.value = 0
      }
      lastScrollY.value = currentY
    }
  })

  const dockAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: withTiming(isDockHidden.value ? 100 : 0, { duration: 250 }) }
      ],
      opacity: withTiming(isDockHidden.value ? 0 : 1, { duration: 200 })
    }
  })



  // Fetch entry data
  useEffect(() => {
    if (!user || !entryId) return

    // Handle "new" entry case - don't fetch, just setup empty state
    if (entryId === 'new') {
      const emptyEntry: BodyLogEntryWithImages = {
        id: 'new',
        user_id: user.id,
        created_at: new Date().toISOString(),
        weight_kg: null,
        body_fat_percentage: null,
        bmi: null,
        analysis_summary: null,
        muscle_mass_kg: null,
        images: [],
      }
      setEntry(emptyEntry)
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchEntry = async () => {
      try {
        setLoading(true)

        const { data: entryData, error: entryError } = await supabase
          .from('body_log_entries')
          .select(
            `
            id,
            user_id,
            created_at,
            weight_kg,
            body_fat_percentage,
            bmi,
            muscle_mass_kg,
            lean_mass_kg,
            fat_mass_kg,
            score_v_taper,
            score_chest,
            score_shoulders,
            score_abs,
            score_arms,
            score_back,
            score_legs,
            analysis_summary,
            body_log_images (
              id,
              entry_id,
              user_id,
              file_path,
              sequence,
              created_at
            )
          `,
          )
          .eq('id', entryId)
          .eq('user_id', user.id)
          .single()

        if (cancelled) return

        if (entryError || !entryData) {
          console.error('Error fetching entry:', entryError)
          Alert.alert(
            'Error',
            'Failed to load body log entry.',
            [{ text: 'OK', onPress: () => handleBack() }],
          )
          return
        }

        // Transform the data to match our type
        const transformedEntry: BodyLogEntryWithImages = {
          id: entryData.id,
          user_id: entryData.user_id,
          created_at: entryData.created_at,
          weight_kg: entryData.weight_kg,
          body_fat_percentage: entryData.body_fat_percentage,
          bmi: entryData.bmi,
          analysis_summary: entryData.analysis_summary,
          muscle_mass_kg: entryData.muscle_mass_kg,
          lean_mass_kg: entryData.lean_mass_kg,
          fat_mass_kg: entryData.fat_mass_kg,
          score_v_taper: entryData.score_v_taper,
          score_chest: entryData.score_chest,
          score_shoulders: entryData.score_shoulders,
          score_abs: entryData.score_abs,
          score_arms: entryData.score_arms,
          score_back: entryData.score_back,
          score_legs: entryData.score_legs,
          images: (entryData.body_log_images || []).sort(
            (a: BodyLogImage, b: BodyLogImage) => a.sequence - b.sequence,
          ),
        }

        setEntry(transformedEntry)

        // Update metrics from entry data
        setMetrics({
          weight_kg: entryData.weight_kg,
          body_fat_percentage: entryData.body_fat_percentage,
          bmi: entryData.bmi,
          lean_mass_kg: entryData.lean_mass_kg,
          fat_mass_kg: entryData.fat_mass_kg,
          score_v_taper: entryData.score_v_taper,
          score_chest: entryData.score_chest,
          score_shoulders: entryData.score_shoulders,
          score_abs: entryData.score_abs,
          score_arms: entryData.score_arms,
          score_back: entryData.score_back,
          score_legs: entryData.score_legs,
        })

        // Fetch signed URLs for all images (hero size for detail view)
        if (transformedEntry.images.length > 0) {
          if (!cancelled) {
            setImagesLoading(true)
          }
          const filePaths = transformedEntry.images.map((img) => img.file_path)
          const urls = await getBodyLogImageUrls(filePaths, 'hero')
          if (!cancelled) {
            setImageUrls(urls)
            setImagesLoading(false)
            // Prefetch images for smooth carousel experience
            prefetchBodyLogImages(urls)
          }
        }
      } catch (error) {
        console.error('Error fetching entry:', error)
        if (!cancelled) {
          setImagesLoading(false)
          Alert.alert(
            'Error',
            'Failed to load body log entry.',
            [{ text: 'OK', onPress: () => handleBack() }],
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchEntry()

    return () => {
      cancelled = true
    }
  }, [user, entryId, router])

  // Fetch user profile for gender and height
  useEffect(() => {
    if (!user) return

    let cancelled = false

    const fetchUserProfile = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('gender, height_cm')
          .eq('id', user.id)
          .single()

        if (!cancelled && profile) {
          if (profile.gender === 'male' || profile.gender === 'female') {
            setUserGender(profile.gender)
          }
          if (typeof profile.height_cm === 'number') {
            setUserHeight(profile.height_cm)
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
      }
    }

    fetchUserProfile()

    return () => {
      cancelled = true
    }
  }, [user])

  // Handle opening info modal
  const handleInfoPress = async (
    type: 'bodyFat' | 'bmi' | 'weight',
    value: string,
    status: BodyFatRange | BMIRange | null,
  ) => {
    haptic('light')

    let explanation = ''
    if (type === 'bodyFat') {
      explanation = getBodyFatExplanation(userGender)
    } else if (type === 'bmi') {
      explanation = getBMIExplanation(userGender)
    } else {
      explanation = getWeightExplanation(userGender)
    }

    setSelectedMetric({ type, value, status, explanation })
    setInfoModalVisible(true)
  }

  const handleLogWeight = async () => {
    haptic('light')
    setWeightModalVisible(true)
  }

  const handleSaveWeight = async (weightKg: number) => {
    try {
      if (!user) {
        return
      }

      let actualEntryId = entryId

      // Create entry if this is a new entry
      if (entryId === 'new') {
        const newEntry = await database.bodyLog.createEntry(user.id, {
          weightKg: weightKg,
        })
        actualEntryId = newEntry.id

        // Fetch the full entry to ensure we have all the data
        const { data: fullEntry } = await supabase
          .from('body_log_entries')
          .select(`
            *,
            body_log_images (
              id,
              entry_id,
              user_id,
              file_path,
              sequence,
              created_at
            )
          `)
          .eq('id', actualEntryId)
          .single()

        if (fullEntry) {
          const images = (fullEntry.body_log_images || []).sort(
            (a: BodyLogImage, b: BodyLogImage) => a.sequence - b.sequence
          )

          // Update entry with full data
          setEntry({
            id: fullEntry.id,
            user_id: fullEntry.user_id,
            created_at: fullEntry.created_at,
            weight_kg: fullEntry.weight_kg,
            body_fat_percentage: fullEntry.body_fat_percentage,
            bmi: fullEntry.bmi,
            analysis_summary: fullEntry.analysis_summary,
            muscle_mass_kg: fullEntry.muscle_mass_kg,
            images,
          })

          setMetrics({
            weight_kg: fullEntry.weight_kg,
            body_fat_percentage: fullEntry.body_fat_percentage,
            bmi: fullEntry.bmi,
            lean_mass_kg: fullEntry.lean_mass_kg,
            fat_mass_kg: fullEntry.fat_mass_kg,
            score_v_taper: fullEntry.score_v_taper,
            score_chest: fullEntry.score_chest,
            score_shoulders: fullEntry.score_shoulders,
            score_abs: fullEntry.score_abs,
            score_arms: fullEntry.score_arms,
            score_back: fullEntry.score_back,
            score_legs: fullEntry.score_legs,
          })
        }

        // Update URL with real entry ID
        router.setParams({ entryId: actualEntryId })

        // Complete tutorial step for body log

        completeStep('body_log')

        hapticSuccess()
        return
      }

      if (!actualEntryId) {
        return
      }

      // Update entry with weight
      await database.bodyLog.updateEntryMetrics(actualEntryId, { weight_kg: weightKg })

      // Update local state
      setMetrics((prev) => ({ ...prev, weight_kg: weightKg }))

      // Refresh entry data
      if (user) {
        const { data: updatedEntry } = await supabase
          .from('body_log_entries')
          .select('*')
          .eq('id', actualEntryId)
          .single()

        if (updatedEntry) {
          setEntry((prev) => prev ? { ...prev, weight_kg: updatedEntry.weight_kg } : null)
        }
      }

      hapticSuccess()
    } catch (error) {
      console.error('Error saving weight:', error)
      Alert.alert('Error', 'Failed to save weight. Please try again.')
    }
  }

  const handleSaveHeight = async (heightCm: number) => {
    try {
      if (!user) return

      await supabase
        .from('profiles')
        .update({ height_cm: heightCm })
        .eq('id', user.id)

      setUserHeight(heightCm)
      setHeightInput('')
      setHeightModalVisible(false)
      hapticSuccess()
    } catch (error) {
      console.error('Error saving height:', error)
      Alert.alert('Error', 'Failed to save height. Please try again.')
    }
  }

  const handleHeightClose = () => {
    setHeightInput('')
    setHeightModalVisible(false)
  }

  // Height conversion helpers
  const isMetric = weightUnit === 'kg'
  const CM_PER_INCH = 2.54
  const INCHES_PER_FOOT = 12

  const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
    const totalInches = cm / CM_PER_INCH
    const feet = Math.floor(totalInches / INCHES_PER_FOOT)
    const inches = Math.round(totalInches % INCHES_PER_FOOT)
    return { feet, inches }
  }

  const feetInchesToCm = (feet: number, inches: number): number => {
    const totalInches = feet * INCHES_PER_FOOT + inches
    return totalInches * CM_PER_INCH
  }

  const formatHeightDisplay = (heightCm: number | null): string => {
    if (!heightCm) return '—'
    if (isMetric) {
      return `${heightCm} cm`
    } else {
      const { feet, inches } = cmToFeetInches(heightCm)
      return `${feet}'${inches}"`
    }
  }

  const parseHeightInput = (): number | null => {
    const normalized = heightInput.replace(',', '.').trim()
    if (!normalized) return null

    if (isMetric) {
      // Parse as cm
      const cm = parseFloat(normalized)
      if (Number.isNaN(cm) || cm < 100 || cm > 250) return null
      return Math.round(cm)
    } else {
      // Parse as feet'inches" or just feet.inches
      // Support formats: 5'10", 5'10, 5.10, 5 10, 510
      let feet = 0
      let inches = 0
      
      // Try feet'inches" format first
      const feetInchesMatch = normalized.match(/^(\d+)\s*['']\s*(\d+)\s*[""]?$/)
      if (feetInchesMatch) {
        feet = parseInt(feetInchesMatch[1], 10)
        inches = parseInt(feetInchesMatch[2], 10)
      } else {
        // Try decimal format (5.10 = 5 feet 10 inches)
        const decimalMatch = normalized.match(/^(\d+)[.\s](\d{1,2})$/)
        if (decimalMatch) {
          feet = parseInt(decimalMatch[1], 10)
          inches = parseInt(decimalMatch[2], 10)
        } else {
          // Try just a number (assume feet if small, cm if large)
          const num = parseFloat(normalized)
          if (Number.isNaN(num)) return null
          if (num > 10) {
            // Assume it's total inches
            feet = Math.floor(num / 12)
            inches = Math.round(num % 12)
          } else {
            // Assume it's just feet
            feet = Math.floor(num)
            inches = 0
          }
        }
      }
      
      if (feet < 3 || feet > 8 || inches < 0 || inches > 11) return null
      return Math.round(feetInchesToCm(feet, inches))
    }
  }

  const heightCmFromInput = parseHeightInput()
  const hasValidHeight = heightCmFromInput !== null


  const handleSaveGender = async (gender: Gender) => {
    try {
      if (!user) return

      await supabase
        .from('profiles')
        .update({ gender })
        .eq('id', user.id)

      setUserGender(gender)
      setGenderModalVisible(false)
      hapticSuccess()
    } catch (error) {
      console.error('Error saving gender:', error)
      Alert.alert('Error', 'Failed to save sex. Please try again.')
    }
  }

  const handleAddPhotos = async () => {
    if (!user) return

    // Limit to 3 images per entry
    const currentCount = entry?.images.length ?? 0
    if (currentCount >= 3) {
      Alert.alert(
        'Limit Reached',
        'You can only have up to 3 photos per entry. Please delete an existing photo if you want to add a new one.',
        [{ text: 'OK' }]
      )
      return
    }

    haptic('light')

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex: number) => {
          if (buttonIndex === 1) {
            launchCameraForBodyLog()
          } else if (buttonIndex === 2) {
            launchLibraryForBodyLog()
          }
        }
      )
    } else {
      // Android fallback using Alert
      Alert.alert(
        'Add Photo',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: launchCameraForBodyLog },
          { text: 'Choose from Library', onPress: launchLibraryForBodyLog },
        ]
      )
    }
  }

  const launchCameraForBodyLog = async () => {
    if (!user) return

    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission',
          'Rep AI needs camera access to take photos. You can enable this in your device settings.',
          [{ text: 'OK' }],
        )
        return
      }

      // Launch camera with lower quality to reduce file size for AI processing
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        aspect: [3, 4],
        quality: 0.8,
        base64: false,
      })

      if (!result.canceled && result.assets.length > 0) {
        await handleImageSelected(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      Alert.alert(
        'Camera Error',
        'Failed to access camera. Please try again.',
      )
    }
  }

  const launchLibraryForBodyLog = async () => {
    if (!user) return

    try {
      // Request photo library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Photo Library Permission',
          'Rep AI needs photo library access to select photos. You can enable this in your device settings.',
          [{ text: 'OK' }],
        )
        return
      }

      // Launch photo library with multi-select enabled
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        aspect: [3, 4],
        quality: 0.8,
        base64: false,
        allowsMultipleSelection: true,
      })

      if (!result.canceled && result.assets.length > 0) {
        // Upload all selected images
        const imageUris = result.assets.map(asset => asset.uri)
        await handleImagesSelected(imageUris)
      }
    } catch (error) {
      console.error('Error accessing photo library:', error)
      Alert.alert(
        'Photo Library Error',
        'Failed to access photo library. Please try again.',
      )
    }
  }

  // Handle single image selected (from camera)
  const handleImageSelected = async (photoUri: string) => {
    await handleImagesSelected([photoUri])
  }

  // Handle multiple images selected (from library)
  const handleImagesSelected = async (photoUris: string[]) => {
    if (!user || photoUris.length === 0) return

    try {
      // Check limits before starting
      const currentCount = entry?.images.length ?? 0
      const remainingSlots = 3 - currentCount

      if (remainingSlots <= 0) {
        Alert.alert(
          'Limit Reached',
          'You can only have up to 3 photos per entry. Please delete an existing photo first.',
          [{ text: 'OK' }]
        )
        return
      }

      // Filter to only what we can accept
      const toUpload = photoUris.slice(0, remainingSlots)
      
      if (toUpload.length < photoUris.length) {
        Alert.alert(
          'Limit Reached',
          `Only the first ${remainingSlots} photo(s) will be uploaded as each entry is limited to 3 photos.`,
          [{ text: 'OK' }]
        )
      }

      setIsUploadingImage(true)

      let actualEntryId = entryId

      // Create entry if this is a new entry
      if (entryId === 'new') {
        const newEntry = await database.bodyLog.createEntry(user.id, {})
        actualEntryId = newEntry.id

        // Update URL with real entry ID
        router.setParams({ entryId: actualEntryId })
      }

      if (!actualEntryId) {
        return
      }

      // Import uploadBodyLogImage once for all uploads
      const { uploadBodyLogImage } = await import('@/lib/utils/body-log-storage')

      // Upload each image sequentially
      let currentPosition = (entry?.images.length ?? 0) + 1
      for (const photoUri of toUpload) {
        const filePath = await uploadBodyLogImage(photoUri, user.id, actualEntryId, currentPosition)

        await database.bodyLog.addImage(
          actualEntryId,
          user.id,
          filePath,
          currentPosition,
        )
        currentPosition++
      }

      // Refresh entry data with images
      const { data: updatedEntry } = await supabase
        .from('body_log_entries')
        .select(`
          *,
          body_log_images (
            id,
            entry_id,
            user_id,
            file_path,
            sequence,
            created_at
          )
        `)
        .eq('id', actualEntryId)
        .single()

      if (updatedEntry) {
        const images = (updatedEntry.body_log_images || []).sort(
          (a: BodyLogImage, b: BodyLogImage) => a.sequence - b.sequence
        )

        setEntry((prev) =>
          prev
            ? { ...prev, images }
            : null
        )

        // Refresh image URLs - map to file paths (hero size)
        if (images.length > 0) {
          setImagesLoading(true)
          const filePaths = images.map((img: BodyLogImage) => img.file_path)
          const newUrls = await getBodyLogImageUrls(filePaths, 'hero')
          setImageUrls(newUrls)
          setImagesLoading(false)
          prefetchBodyLogImages(newUrls)
        }
      }

      hapticSuccess()
    } catch (error) {
      console.error('Error uploading photo(s):', error)
      setImagesLoading(false)
      Alert.alert('Error', 'Failed to upload photo(s). Please try again.')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleDeleteImage = async (imageId: string, imageIndex: number) => {
    if (!user || !entryId || entryId === 'new') return

    haptic('medium')

    Alert.alert(
      'Delete Photo?',
      'This photo will be permanently deleted from this entry.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from database
              await database.bodyLog.deleteImage(imageId, user.id)

              // Also delete from storage
              const imageToDelete = entry?.images[imageIndex]
              if (imageToDelete?.file_path) {
                const { deleteBodyLogImage } = await import('@/lib/utils/body-log-storage')
                await deleteBodyLogImage(imageToDelete.file_path)
              }

              // Refresh entry data
              const { data: updatedEntry } = await supabase
                .from('body_log_entries')
                .select(`
                  *,
                  body_log_images (
                    id,
                    entry_id,
                    user_id,
                    file_path,
                    sequence,
                    created_at
                  )
                `)
                .eq('id', entryId)
                .single()

              if (updatedEntry) {
                const images = (updatedEntry.body_log_images || []).sort(
                  (a: BodyLogImage, b: BodyLogImage) => a.sequence - b.sequence
                )

                // Check if entry is now empty (no images AND no weight)
                const hasImages = images.length > 0
                const hasWeight = updatedEntry.weight_kg !== null
                const isEmpty = !hasImages && !hasWeight

                if (isEmpty) {
                  // Entry is empty, delete it
                  await database.bodyLog.deleteEntry(entryId)
        hapticSuccess()
                  // Navigate back to body log list
                  if (navigation.canGoBack()) {
                    router.back()
                  } else {
                    router.replace('/body-log')
                  }
                  return
                }

                // Entry still has data, update it
                setEntry((prev) =>
                  prev
                    ? { ...prev, images }
                    : null
                )

                // Refresh image URLs (hero size)
                if (images.length > 0) {
                  setImagesLoading(true)
                  const filePaths = images.map((img: BodyLogImage) => img.file_path)
                  const newUrls = await getBodyLogImageUrls(filePaths, 'hero')
                  setImageUrls(newUrls)
                  setImagesLoading(false)
                  prefetchBodyLogImages(newUrls)
                } else {
                  setImageUrls([])
                }

                hapticSuccess()
              }
            } catch (error) {
              console.error('Error deleting photo:', error)
              setImagesLoading(false)
              Alert.alert('Error', 'Failed to delete photo. Please try again.')
            }
          },
        },
      ]
    )
  }

  const handleRunBodyScan = async () => {
    if (!entry || !entryId || entryId === 'new') {
      Alert.alert('Incomplete Entry', 'Please add at least 2 photos and your weight before running a scan.')
      return
    }

    // Check if body scan has already been run for this entry
    const alreadyScanned = entry.body_fat_percentage !== null || entry.bmi !== null
    
    if (alreadyScanned && isProMember) {
      haptic('light')
      Alert.alert(
        'Body Scan Already Completed',
        'This entry has already been analyzed. To run another body scan, please create a new entry.',
        [{ text: 'OK' }]
      )
      return
    }

    // Check requirements
    const hasEnoughPhotos = entry.images.length >= 1
    const hasWeight = entry.weight_kg !== null

    if (!hasEnoughPhotos || !hasWeight) {
      haptic('light')

      const missing: string[] = []
      if (!hasEnoughPhotos) {
        missing.push('at least 1 photo')
      }
      if (!hasWeight) {
        missing.push('weight')
      }

      Alert.alert(
        'Body Scan Requirements',
        `To run a body scan, you need:\n\n• At least 1 photo (multiple angles recommended for accuracy)\n• Your current weight\n\n${missing.length > 0 ? `Missing: ${missing.join(' and ')}` : ''}`,
        [{ text: 'OK' }]
      )
      return
    }

    haptic('medium') // Mapping heavy to medium for non-intrusive feel

    // Start processing modal for both flows
    setProcessingComplete(false)
    setShowProcessingModal(true)

    // For free users: Show teaser flow (fake processing, then locked results)
    if (!isProMember) {
      // Simulate slightly variable processing time (3.5-5 seconds) for realism
      // This makes it feel like it's actually doing something complex
      const teaserTime = 3500 + Math.random() * 1500
      setTimeout(() => {
        setProcessingComplete(true)
      }, teaserTime)
      return
    }

    // For Pro users: Run actual body scan
    setIsRunningBodyScan(true)

    try {
      // Get session token
      const { data: sessionData } = await supabase.auth.getSession()
      const sessionToken = sessionData.session?.access_token

      if (!sessionToken) {
        throw new Error('Not authenticated')
      }

      // Call AI analysis function
      const { callSupabaseFunction } = await import('@/lib/supabase-functions-client')
      const response = await callSupabaseFunction(
        'body-log-analyze',
        'POST',
        { entryId },
        {},
        sessionToken,
      )

      if (!response.ok) {
        let errorMessage = `Analysis failed with status ${response.status}`
        try {
          const errorData = await response.json()
          if (errorData.error || errorData.message) {
            errorMessage = errorData.error || errorData.message
          }
        } catch {}
        throw new Error(errorMessage)
      }

      const { metrics: analysisMetrics } = await response.json()

      // Update local state with analysis results
      setMetrics({
        weight_kg: analysisMetrics.weight_kg ?? entry.weight_kg,
        body_fat_percentage: analysisMetrics.body_fat_percentage,
        bmi: analysisMetrics.bmi,
        lean_mass_kg: analysisMetrics.lean_mass_kg,
        fat_mass_kg: analysisMetrics.fat_mass_kg,
        score_v_taper: analysisMetrics.score_v_taper,
        score_chest: analysisMetrics.score_chest,
        score_shoulders: analysisMetrics.score_shoulders,
        score_abs: analysisMetrics.score_abs,
        score_arms: analysisMetrics.score_arms,
        score_back: analysisMetrics.score_back,
        score_legs: analysisMetrics.score_legs,
      })

      // Refresh entry to get updated data
      const { data: updatedEntry } = await supabase
        .from('body_log_entries')
        .select('*')
        .eq('id', entryId)
        .single()

      if (updatedEntry) {
        setEntry((prev) => (prev ? { ...prev, ...updatedEntry } : null))
      }

      setProcessingComplete(true)
      hapticSuccess()
    } catch (error) {
      console.error('Error running body scan:', error)
      setShowProcessingModal(false)
      setIsRunningBodyScan(false)
      Alert.alert(
        'Analysis Failed',
        'Failed to analyze your photos. Please try again.',
      )
    } finally {
      setIsRunningBodyScan(false)
    }
  }

  // Handle teaser processing completion
  const handleTeaserProcessingComplete = async () => {
    setShowProcessingModal(false)
    setProcessingComplete(false)
    
    // Set realistic mock metrics for the teaser
    setMetrics({
      weight_kg: entry?.weight_kg ?? 75,
      body_fat_percentage: 14.2,
      bmi: 23.5,
      lean_mass_kg: 64.3,
      fat_mass_kg: 10.7,
      score_v_taper: 82,
      score_chest: 78,
      score_shoulders: 85,
      score_abs: 72,
      score_arms: 80,
      score_back: 84,
      score_legs: 76,
    })

    // Trigger success haptic even for teaser for tactile feedback
    hapticSuccess()
    // Show the locked results overlay
    setShowTeaserResults(true)
  }

  // Handle unlock button press (opens paywall)
  const handleUnlockResults = async () => {
    haptic('light')
    setPaywallVisible(true)
  }

  const handleDelete = async () => {
    // If this is a new entry that hasn't been created yet, just go back
    if (entryId === 'new') {
      handleBack()
      return
    }

    haptic('medium')

    const imageCount = entry?.images?.length || 0
    const hasWeight = entry?.weight_kg !== null

    let message = 'This entry will be permanently deleted.'
    if (imageCount > 0 && hasWeight) {
      message = `This entry with ${imageCount} photo${imageCount > 1 ? 's' : ''} and weight will be permanently deleted.`
    } else if (imageCount > 0) {
      message = `This entry with ${imageCount} photo${imageCount > 1 ? 's' : ''} will be permanently deleted.`
    } else if (hasWeight) {
      message = 'This weight entry will be permanently deleted.'
    }

    Alert.alert('Delete Entry?', message, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!entryId) {
              return
            }

            // Delete from database (CASCADE will delete images too)
            await database.bodyLog.deleteEntry(entryId)

            // Haptic feedback for success
            hapticSuccess()

            // Navigate back to body log listing
            if (navigation.canGoBack()) {
              router.back()
            } else {
              router.replace('/body-log')
            }
          } catch (error) {
            console.error('Error deleting body log entry:', error)
            Alert.alert(
              'Delete Failed',
              'Failed to delete entry. Please try again.',
              [{ text: 'OK' }],
            )
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </View>
    )
  }

  if (!entry) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Entry not found
          </Text>
        </View>
      </View>
    )
  }

  const imageCount = imageUrls.length

  const handleBack = () => {
    setShouldExit(true)
  }

  const handleExitComplete = () => {
    router.back()
  }

  return (
    <SlideInView
      style={{ flex: 1, backgroundColor: colors.bg }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        <ScreenHeader
          title={entry?.created_at ? new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Entry'}
          onLeftPress={handleBack}
          leftIcon="arrow-back"
          rightIcon="trash-outline"
          onRightPress={handleDelete}
        />

        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 100, paddingTop: 16 }
          ]}
        >


           {/* Photos Section */}
           <View style={styles.photoSection}>
              {imageUrls.length === 0 ? (
                <TouchableOpacity
                  style={[styles.emptyPhotoState, { backgroundColor: colors.surfaceCard, borderColor: colors.border, marginHorizontal: 20 }]}
                  onPress={isUploadingImage ? undefined : handleAddPhotos}
                >
                  {isUploadingImage ? (
                    <ActivityIndicator color={colors.brandPrimary} />
                  ) : (
                    <>
                      <View style={[styles.cameraIconContainer, { backgroundColor: colors.bg }]}>
                        <Ionicons name="camera" size={32} color={colors.brandPrimary} />
                      </View>
                      <Text style={[styles.emptyPhotoText, { color: colors.textPrimary }]}>Add Progress Photos</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <FlatList
                  horizontal
                  data={imageUrls}
                  keyExtractor={(item, index) => `${index}-${item}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[
                        styles.photoCard, 
                        { 
                          width: (Dimensions.get('window').width - 40 - 12) / 2, 
                          height: 280 
                        }
                      ]}
                      onPress={() => {
                        setCurrentImageIndex(index)
                        setImageModalVisible(true)
                      }}
                    >
                      <Image source={{ uri: item }} style={styles.photoImage} contentFit="cover" />
                    </TouchableOpacity>
                  )}
                  ListFooterComponent={
                    imageUrls.length < 3 ? (
                      <TouchableOpacity
                        style={[
                          styles.addPhotoSmall,
                          {
                            width: (Dimensions.get('window').width - 40 - 12) / 2,
                            height: 280,
                            backgroundColor: colors.surfaceCard,
                            borderWidth: 1,
                            borderColor: colors.border
                          }
                        ]}
                        onPress={handleAddPhotos}
                      >
                         {isUploadingImage ? (
                           <ActivityIndicator color={colors.brandPrimary} />
                         ) : (
                           <>
                             <Ionicons name="add" size={28} color={colors.brandPrimary} />
                             <Text style={[styles.addPhotoSmallText, { color: colors.textSecondary }]}>Add Photo</Text>
                           </>
                         )}
                      </TouchableOpacity>
                    ) : null
                  }
                />
              )}
           </View>

            {/* User Info Section - Editable */}
            <View style={styles.userInfoRow}>
              <TouchableOpacity 
                style={styles.userInfoItem}
                onPress={handleLogWeight}
                activeOpacity={0.7}
              >
                <Ionicons name="scale-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.userInfoValue, { color: colors.textPrimary }]}>
                  {metrics.weight_kg ? formatWeight(metrics.weight_kg) : '—'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} style={{ opacity: 0.5 }} />
              </TouchableOpacity>

              <View style={[styles.userInfoDivider, { backgroundColor: colors.border }]} />

              <TouchableOpacity 
                style={styles.userInfoItem}
                onPress={() => setHeightModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="resize-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.userInfoValue, { color: colors.textPrimary }]}>
                  {formatHeightDisplay(userHeight)}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} style={{ opacity: 0.5 }} />
              </TouchableOpacity>

              <View style={[styles.userInfoDivider, { backgroundColor: colors.border }]} />

              <TouchableOpacity 
                style={styles.userInfoItem}
                onPress={() => setGenderModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.userInfoValue, { color: colors.textPrimary }]}>
                  {userGender === 'male' ? 'Male' : 'Female'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} style={{ opacity: 0.5 }} />
              </TouchableOpacity>
            </View>

            {/* Analysis Results Section */}
            <View style={[styles.sectionContainer, { marginBottom: 100 }]}>

              <View style={styles.resultsWrapper}>
                <View style={[styles.metricCardStack, showTeaserResults && styles.blurredContent]}>
                  
                  {/* Body Fat Section */}
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 8 }]}>Body Fat</Text>
                    <View style={[styles.premiumCard, { backgroundColor: colors.surfaceCard }]}>
                      <LinearScale
                        label=""
                        unit="%"
                        value={metrics.body_fat_percentage ?? 0}
                        min={5}
                        max={40}
                        subLabel={getBodyFatStatus(metrics.body_fat_percentage ?? 0, userGender)?.label}
                        ranges={userGender === 'male' ? [
                           { label: 'Low', start: 5, end: 7, color: '#F59E0B' },
                           { label: 'Ath.', start: 7, end: 12, color: '#10B981' },
                           { label: 'Fit.', start: 12, end: 15, color: '#3B82F6' },
                           { label: 'Avg.', start: 15, end: 20, color: '#F59E0B' },
                           { label: 'Obs.', start: 20, end: 40, color: '#EF4444' },
                        ] : [
                          { label: 'Low', start: 12, end: 15, color: '#F59E0B' },
                          { label: 'Ath.', start: 15, end: 22, color: '#10B981' },
                          { label: 'Fit.', start: 22, end: 25, color: '#3B82F6' },
                          { label: 'Avg.', start: 25, end: 30, color: '#F59E0B' },
                          { label: 'Obs.', start: 30, end: 45, color: '#EF4444' },
                        ]}
                        colorResolver={(val) => getStatusColor(getBodyFatStatus(val, userGender)?.color || 'moderate').primary}
                        onPress={() => handleInfoPress('bodyFat', (metrics.body_fat_percentage ?? 0).toString(), getBodyFatStatus(metrics.body_fat_percentage ?? 0, userGender))}
                        styles={styles}
                      />
                    </View>
                  </View>

                  {/* BMI Section */}
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 8 }]}>BMI</Text>
                    <View style={[styles.premiumCard, { backgroundColor: colors.surfaceCard }]}>
                      <LinearScale
                        label=""
                        value={metrics.bmi ?? 0}
                        min={15}
                        max={45}
                        subLabel={getBMIStatus(metrics.bmi ?? 0, userGender)?.label}
                         ranges={[
                           { label: 'U.', start: 15, end: 18.5, color: '#3B82F6' },
                           { label: 'N.', start: 18.5, end: 25, color: '#10B981' },
                           { label: 'O.', start: 25, end: 30, color: '#F59E0B' },
                           { label: 'H.', start: 30, end: 45, color: '#EF4444' },
                        ]}
                        colorResolver={(val) => getStatusColor(getBMIStatus(val, userGender)?.color || 'moderate').primary}
                        onPress={() => handleInfoPress('bmi', (metrics.bmi ?? 0).toString(), getBMIStatus(metrics.bmi ?? 0, userGender))}
                        styles={styles}
                      />
                    </View>
                  </View>

                  {/* Physique Section */}
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 8 }]}>Physique</Text>
                    <View style={[styles.premiumCard, { backgroundColor: colors.surfaceCard, paddingVertical: 18, paddingHorizontal: 20 }]}>
                      <View style={styles.scoreGridModern}>
                         {[
                            { label: 'Chest', score: metrics.score_chest },
                            { label: 'Shoulders', score: metrics.score_shoulders },
                            { label: 'Abs', score: metrics.score_abs },
                            { label: 'Arms', score: metrics.score_arms },
                            { label: 'Back', score: metrics.score_back },
                            { label: 'Legs', score: metrics.score_legs },
                         ].map((item, i) => {
                           const intensity = getScoreIntensity(item.score)
                           const color = ['#333', '#EF4444', '#F59E0B', '#10B981', '#3B82F6'][intensity]
                           return (
                               <View key={i} style={styles.modernScoreItem}>
                                <View style={styles.modernScoreHeader}>
                                <Text style={[styles.modernScoreLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                              </View>
                              <Text style={[styles.modernScoreValue, { color: colors.textPrimary }]}>{item.score ?? '--'}</Text>
                              <View style={[styles.modernProgressBarBg, { backgroundColor: colors.border }]}>
                                 <View style={{ height: '100%', width: `${item.score ?? 0}%`, backgroundColor: color, borderRadius: 2 }} />
                              </View>
                            </View>
                         )
                       })}
                    </View>
                  </View>
                </View>
              </View>

                {showTeaserResults && (
                  <LockedResultsOverlay onUnlock={handleUnlockResults} />
                )}
              </View>
            </View>


         </Animated.ScrollView>

         {/* Dynamic Action Dock */}
        {metrics.body_fat_percentage === null && (
          <Animated.View style={[styles.actionDockContainer, { bottom: insets.bottom + 20 }]}>
             <TouchableOpacity 
               style={[
                 styles.bodyScanButton, 
                 { 
                   backgroundColor: colors.textPrimary,
                   shadowColor: colors.textPrimary,
                 },
                 isRunningBodyScan && styles.bodyScanButtonDisabled
               ]}
               onPress={handleRunBodyScan}
               disabled={isRunningBodyScan}
               activeOpacity={0.8}
             >
               {isRunningBodyScan ? (
                 <ActivityIndicator color={colors.bg} size="small" />
               ) : (
                 <>
                   <Ionicons name="scan" size={22} color={colors.bg} />
                   <Text style={[styles.bodyScanButtonText, { color: colors.bg }]}>Body Scan</Text>
                 </>
               )}
             </TouchableOpacity>
          </Animated.View>
        )}



        {/* Modals */}
        <WeightInputModal
            visible={weightModalVisible}
            onClose={() => setWeightModalVisible(false)}
            onSave={handleSaveWeight}
            initialValue={entry?.weight_kg}
        />

        {/* Height Input Modal */}
        <Modal
          visible={heightModalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleHeightClose}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            style={styles.modalOverlay}
          >
            <View style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Update Height</Text>
                <TouchableOpacity onPress={handleHeightClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalContent}>
                {/* Current unit indicator */}
                <View style={styles.unitIndicator}>
                  <Text style={[styles.unitIndicatorText, { color: colors.textSecondary }]}>
                    {isMetric ? 'Enter height in centimeters' : 'Enter height as feet\'inches" (e.g. 5\'10")'}
                  </Text>
                </View>

                {/* Height Input */}
                <TextInput
                  style={[
                    styles.heightTextInput,
                    { 
                      color: colors.textPrimary,
                      borderColor: heightInput && !hasValidHeight ? colors.statusError : colors.border,
                      backgroundColor: colors.surfaceSubtle,
                    }
                  ]}
                  value={heightInput}
                  onChangeText={setHeightInput}
                  placeholder={isMetric ? 'e.g. 175' : "e.g. 5'10\""}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType={isMetric ? 'decimal-pad' : 'default'}
                  onSubmitEditing={() => {
                    if (hasValidHeight && heightCmFromInput) {
                      handleSaveHeight(heightCmFromInput)
                    }
                  }}
                  autoFocus
                />

                {heightInput && !hasValidHeight && (
                  <Text style={[styles.heightErrorText, { color: colors.statusError }]}>
                    {isMetric 
                      ? 'Enter a valid height (100-250 cm)' 
                      : 'Enter a valid height (3\'0" - 8\'0")'}
                  </Text>
                )}

                {/* Preview conversion */}
                {hasValidHeight && heightCmFromInput && (
                  <Text style={[styles.heightPreviewText, { color: colors.brandPrimary }]}>
                    {isMetric 
                      ? `${(() => { const { feet, inches } = cmToFeetInches(heightCmFromInput); return `${feet}'${inches}"`; })()}` 
                      : `${heightCmFromInput} cm`}
                  </Text>
                )}
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[
                    styles.modalSaveButton,
                    {
                      backgroundColor: colors.textPrimary,
                    },
                    !hasValidHeight && { opacity: 0.5 }
                  ]}
                  onPress={() => {
                    if (hasValidHeight && heightCmFromInput) {
                      handleSaveHeight(heightCmFromInput)
                    }
                  }}
                  disabled={!hasValidHeight}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.modalSaveButtonText,
                      { color: colors.bg },
                    ]}
                  >
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Gender Selection Modal */}
        <Modal
          visible={genderModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setGenderModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Update Sex</Text>
                <TouchableOpacity onPress={() => setGenderModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalContent}>
                <View style={styles.genderOptions}>
                  <TouchableOpacity
                    style={[
                      styles.genderOption,
                      { 
                        backgroundColor: userGender === 'male' ? colors.brandPrimary : colors.surfaceSubtle,
                        borderColor: userGender === 'male' ? colors.brandPrimary : colors.border,
                      }
                    ]}
                    onPress={() => handleSaveGender('male')}
                  >
                    <Ionicons 
                      name="male" 
                      size={24} 
                      color={userGender === 'male' ? colors.surface : colors.textPrimary} 
                    />
                    <Text style={[
                      styles.genderOptionText,
                      { color: userGender === 'male' ? colors.surface : colors.textPrimary }
                    ]}>
                      Male
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.genderOption,
                      { 
                        backgroundColor: userGender === 'female' ? colors.brandPrimary : colors.surfaceSubtle,
                        borderColor: userGender === 'female' ? colors.brandPrimary : colors.border,
                      }
                    ]}
                    onPress={() => handleSaveGender('female')}
                  >
                    <Ionicons 
                      name="female" 
                      size={24} 
                      color={userGender === 'female' ? colors.surface : colors.textPrimary} 
                    />
                    <Text style={[
                      styles.genderOptionText,
                      { color: userGender === 'female' ? colors.surface : colors.textPrimary }
                    ]}>
                      Female
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {selectedMetric && (
            <BodyMetricInfoModal
            visible={infoModalVisible}
            onClose={() => setInfoModalVisible(false)}
            metricType={selectedMetric.type}
            currentValue={selectedMetric.value}
            status={selectedMetric.status}
            explanation={selectedMetric.explanation}
            gender={userGender}
            />
        )}
        <Paywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
        <BodyLogProcessingModal
        visible={showProcessingModal}
        imageUri={imageUrls[0] ?? null}
        isComplete={processingComplete}
            onComplete={() => {
              if (!isProMember) {
                handleTeaserProcessingComplete()
              } else {
                setShowProcessingModal(false)
                setProcessingComplete(false)
              }
            }}
        />

        {/* Fullscreen Image Modal */}
        {imageModalVisible && imageCount > 0 && (
            <Modal
            visible={imageModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setImageModalVisible(false)}
            >
            <View style={styles.imageModalOverlay}>
                <View style={[styles.fullscreenSafeArea, { paddingTop: insets.top }]}>
                <TouchableOpacity
                    style={styles.fullscreenCloseButton}
                    onPress={() => setImageModalVisible(false)}
                >
                    <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.fullscreenCounter}>
                    <Text style={styles.fullscreenCounterText}>
                    {currentImageIndex + 1} / {imageCount}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.fullscreenDeleteButton}
                    onPress={() => {
                    const image = entry?.images[currentImageIndex]
                    if (image?.id) {
                        setImageModalVisible(false)
                        handleDeleteImage(image.id, currentImageIndex)
                    }
                    }}
                >
                    <Ionicons name="trash-outline" size={24} color={colors.surface} />
                </TouchableOpacity>
                </View>

                <FlatList
                data={imageUrls}
                renderItem={({ item, index }) => (
                    <Pressable
                    style={styles.fullscreenImageWrapper}
                    onPress={() => setImageModalVisible(false)}
                    >
                    <Image
                        source={{ uri: item }}
                        style={styles.fullscreenImage}
                        contentFit="contain"
                        cachePolicy="disk"
                        transition={300}
                        recyclingKey={`fullscreen-${index}`}
                        onLoadStart={() => setFullscreenImageLoading(true)}
                        onLoad={() => setFullscreenImageLoading(false)}
                    />
                    {fullscreenImageLoading && (
                        <View style={styles.fullscreenLoadingOverlay}>
                        <ActivityIndicator size="large" color={colors.surface} />
                        </View>
                    )}
                    </Pressable>
                )}
                keyExtractor={(item, index) => `fullscreen-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={currentImageIndex}
                getItemLayout={(data, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                })}
                onMomentumScrollEnd={(event) => {
                    const index = Math.round(
                    event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
                    )
                    setCurrentImageIndex(index)
                }}
                />
            </View>
            </Modal>
        )}
      </View>
    </SlideInView>
  )
}

type Colors = ReturnType<typeof useThemedColors>

const createStyles = (colors: Colors) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Floating Header
  floatingHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60,
    zIndex: 100,
  },
  headerCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerDateText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // Hero Section Logic
  heroContainer: {
    height: HERO_HEIGHT,
    position: 'relative',
  },
  carouselImageContainer: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT * 0.5,
  },
  dateOverlay: {
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  dateOverlayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroPlaceholder: {
    height: HERO_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  placeholderIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 15,
    fontWeight: '500',
  },
  placeholderWeight: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
  },

  // Pagination and Date Overlay
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 24,
    paddingHorizontal: 20,
    gap: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  paginationCounter: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  paginationCounterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Action Dock
  actionDockContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  actionDock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 35,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  dockAction: {
    flex: 1,
    minWidth: 80,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  dockLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  dockDivider: {
    width: 1,
    height: 24,
    opacity: 0.5,
  },
  dockWeightValue: {
    alignItems: 'center',
  },
  dockWeightText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dockWeightLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // Body Scan Button (replaces multi-button dock)
  bodyScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 64,
    width: '100%',
    borderRadius: 32,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  bodyScanButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  bodyScanButtonText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // Photos Section
  photoSection: {
    marginBottom: 24,
  },
  emptyPhotoState: {
    height: 240,
    borderRadius: 16,
    borderWidth: 0,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cameraIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyPhotoText: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyPhotoSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  photoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  photoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0,
    borderColor: colors.border,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  morePhotosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  morePhotosText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  addPhotoSmall: {
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addPhotoSmallText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // User Info Row
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: colors.surfaceCard,
    borderRadius: 12,
  },
  userInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  userInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  userInfoDivider: {
    width: 1,
    height: 20,
    opacity: 0.4,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 34, // Extra padding for home indicator safe area
  },
  heightOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  heightOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: 80,
    alignItems: 'center',
  },
  heightOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 16,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  genderOptionText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Height Input Modal Styles
  unitIndicator: {
    alignItems: 'center',
    marginBottom: 12,
  },
  unitIndicatorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  heightTextInput: {
    fontSize: 32,
    fontWeight: '700',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  heightErrorText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  heightPreviewText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 34, // Extra padding for home indicator safe area
  },
  modalSaveButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // General Spacing
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
    position: 'relative',
  },
  resultsWrapper: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  blurredContent: {
    opacity: 0.6,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
    paddingLeft: 2, // Prevent first character cutoff
  },

  // Premium Cards
  premiumCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 0,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  metricCardStack: {
    gap: 16,
  },
  physiqueCardSubTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    opacity: 0.7,
  },

  // Score GridModern
  scoreGridModern: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -10,
    marginTop: -8,
  },
  modernScoreItem: {
    width: '50%',
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  modernScoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modernScoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  modernScoreValue: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  modernProgressBarBg: {
    height: 5,
    borderRadius: 2.5,
    marginTop: 6,
    width: '100%',
  },

  // Linear Scale Redesign
  scaleContainer: {
    width: '100%',
  },
  scaleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    paddingBottom: 4,
  },
  scaleLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    opacity: 0.6,
    display: 'none', // Hide label if it renders
  },
  scaleValueBig: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  statusBadge: {
    paddingHorizontal: 10, // Reduced padding
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 12,
    alignSelf: 'center',
  },
  scaleSubLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  chevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    // Background handled inline
  },
  scaleTrackContainer: {
    height: 28, // Thinner container
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  scaleTrack: {
    width: '100%',
    height: 6, // Thinner track
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  scaleThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12, // Circle
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -12, // Center on percent
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    borderWidth: 4, // create ring effect
  },
  scaleThumbInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scaleMarkers: {
    position: 'absolute',
    bottom: -24,
    left: 0,
    right: 0,
    height: 20,
  },
  markerTick: {
    width: 1,
    height: 4,
    opacity: 0.3,
    marginBottom: 4,
  },
  scaleMarkerText: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.5,
    width: 30,
    textAlign: 'center',
  },

  // Fullscreen Image Modal
  imageModalOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenSafeArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
    zIndex: 10,
  },
  fullscreenCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenDeleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCounter: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fullscreenCounterText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  fullscreenImageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullscreenLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
})
