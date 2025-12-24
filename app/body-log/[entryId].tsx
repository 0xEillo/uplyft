import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
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
    getOverallStatus,
    getStatusColor,
    getWeightExplanation,
    type BMIRange,
    type BodyFatRange,
    type Gender,
} from '@/lib/body-log/composition-analysis'
import {
    type BodyLogEntryWithImages
} from '@/lib/body-log/metadata'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import {
    getBodyLogImageUrls,
    prefetchBodyLogImages,
} from '@/lib/utils/body-log-storage'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const HERO_HEIGHT = SCREEN_HEIGHT * 0.45
const CARD_RADIUS = 24

// Helper for intensity (1-4)
const getScoreIntensity = (score: number | null) => {
  if (score === null) return 1
  if (score < 50) return 1 // Red
  if (score < 75) return 2 // Orange
  if (score < 90) return 3 // Green
  return 4 // Blue
}

const METRIC_CARD_RADIUS = 20

// Helper component for linear scale (Body Fat / BMI)
const LinearScale = ({ 
  value, 
  min = 0, 
  max = 50, 
  ranges = [], 
  label, 
  subLabel,
  colorResolver 
}: {
  value: number
  min?: number
  max?: number
  ranges?: { label: string, start: number, end: number, color?: string }[]
  label: string
  subLabel?: string
  colorResolver?: (val: number) => string
}) => {
  const colors = useThemedColors()
  const percent = Math.min(Math.max((value - min) / (max - min), 0), 1) * 100
  
  // Calculate specific markers position if ranges provided
  const markers = ranges ? ranges.map(r => ({
    left: Math.min(Math.max((r.start - min) / (max - min), 0), 1) * 100,
    label: r.start
  })) : []
  
  const hideMin = markers.some(m => m.left < 10)
  const hideMax = markers.some(m => m.left > 90)

  return (
    <View style={styles.scaleContainer}>
      <View style={styles.scaleHeader}>
        <View>
          <Text style={[styles.scaleLabel, { color: colors.textSecondary }]}>{label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={[styles.scaleValueBig, { color: colors.text }]}>{value}</Text>
            {subLabel && <Text style={[styles.scaleSubLabel, { color: colors.textSecondary }]}>{subLabel}</Text>}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>

      <View style={styles.scaleTrackContainer}>
        {/* Track Background */}
        <View style={[styles.scaleTrack, { backgroundColor: colors.border }]}>
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
                   backgroundColor: range.color || colors.primary,
                   opacity: 0.3
                 }} 
               />
             )
          })}
          
          {/* Main Gradient Bar (Fallback) */}
          {(!ranges || ranges.length === 0) && (
            <LinearGradient
                colors={['#FFB74D', '#F57C00', '#EF6C00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 4, opacity: 0.8 }]} 
            />
          )}
        </View>

        {/* Thumb */}
        <View style={[styles.scaleThumb, { left: `${percent}%`, backgroundColor: colors.feedCardBackground }]}>
           <View style={[styles.scaleThumbInner, { backgroundColor: colorResolver ? colorResolver(value) : colors.text }]} />
        </View>
        
        {/* Markers */}
        <View style={styles.scaleMarkers}>
           {!hideMin && <Text style={[styles.scaleMarkerText, { color: colors.textSecondary, left: '0%' }]}>{min}</Text>}
           {!hideMax && <Text style={[styles.scaleMarkerText, { color: colors.textSecondary, right: '0%' }]}>{max}</Text>}
           {markers.map((m, i) => (
             <Text key={i} style={[styles.scaleMarkerText, { color: colors.textSecondary, left: `${m.left}%`, transform: [{translateX: -10}] }]}>
               {m.label}
             </Text>
           ))}
        </View>
      </View>
    </View>
  )
}

export default function BodyLogDetailScreen() {
  const { entryId, weightKg, bodyFatPercentage, bmi, isNew } = useLocalSearchParams<{
    entryId: string
    weightKg?: string
    bodyFatPercentage?: string
    bmi?: string
    isNew?: string
  }>()

  const colors = useThemedColors()
  const { formatWeight } = useUnit()
  const { user } = useAuth()
  const { isProMember } = useSubscription()
  const { completeStep } = useTutorial()
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()

  const [entry, setEntry] = useState<BodyLogEntryWithImages | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [userGender, setUserGender] = useState<Gender>('male')
  const [shouldExit, setShouldExit] = useState(false)

  // Modal states
  const [infoModalVisible, setInfoModalVisible] = useState(false)
  const [weightModalVisible, setWeightModalVisible] = useState(false)
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
  const scrollXRef = useRef(0)

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
            (a: any, b: any) => a.sequence - b.sequence,
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

  // Fetch user profile for gender
  useEffect(() => {
    if (!user) return

    let cancelled = false

    const fetchUserProfile = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', user.id)
          .single()

        if (!cancelled && profile?.gender) {
          if (profile.gender === 'male' || profile.gender === 'female') {
            setUserGender(profile.gender)
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

  // Get status for metrics
  const bodyFatStatus = getBodyFatStatus(metrics.body_fat_percentage, userGender)
  const bmiStatus = getBMIStatus(metrics.bmi, userGender)
  const overallStatus = getOverallStatus(
    metrics.body_fat_percentage,
    metrics.bmi,
    userGender,
  )

  const analysisSummary = entry?.analysis_summary?.trim()
  const summaryText = analysisSummary && analysisSummary.length > 0
    ? analysisSummary
    : overallStatus?.summary ?? null
  const summaryStatusColors = overallStatus
    ? getStatusColor(overallStatus.color)
    : null
  const summaryTitle = overallStatus?.title ?? 'AI Summary'

  // Handle opening info modal
  const handleInfoPress = async (
    type: 'bodyFat' | 'bmi' | 'weight',
    value: string,
    status: BodyFatRange | BMIRange | null,
  ) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
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
            (a: any, b: any) => a.sequence - b.sequence
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
        console.log('[BodyLog] Successful entry save. Completing body_log tutorial step.')
        completeStep('body_log')

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
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

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      console.error('Error saving weight:', error)
      Alert.alert('Error', 'Failed to save weight. Please try again.')
    }
  }

  const handleAddPhotos = async () => {
    if (!user) return

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

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

      // Launch photo library
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        aspect: [3, 4],
        quality: 0.8,
        base64: false,
      })

      if (!result.canceled && result.assets.length > 0) {
        await handleImageSelected(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Error accessing photo library:', error)
      Alert.alert(
        'Photo Library Error',
        'Failed to access photo library. Please try again.',
      )
    }
  }

  const handleImageSelected = async (photoUri: string) => {
    if (!user) return

    try {
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

      const imagePosition = (entry?.images.length ?? 0) + 1

      // Import and use uploadBodyLogImage directly with the correct sequence
      const { uploadBodyLogImage } = await import('@/lib/utils/body-log-storage')
      const filePath = await uploadBodyLogImage(photoUri, user.id, actualEntryId, imagePosition)

      await database.bodyLog.addImage(
        actualEntryId,
        user.id,
        filePath,
        imagePosition,
      )

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
          (a: any, b: any) => a.sequence - b.sequence
        )

        setEntry((prev) =>
          prev
            ? { ...prev, images }
            : null
        )

        // Refresh image URLs - map to file paths (hero size)
        if (images.length > 0) {
          setImagesLoading(true)
          const filePaths = images.map((img: any) => img.file_path)
          const newUrls = await getBodyLogImageUrls(filePaths, 'hero')
          setImageUrls(newUrls)
          setImagesLoading(false)
          prefetchBodyLogImages(newUrls)
        }
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      )
    } catch (error) {
      console.error('Error uploading photo:', error)
      setImagesLoading(false)
      Alert.alert('Error', 'Failed to upload photo. Please try again.')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleDeleteImage = async (imageId: string, imageIndex: number) => {
    if (!user || !entryId || entryId === 'new') return

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

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
                  (a: any, b: any) => a.sequence - b.sequence
                )

                // Check if entry is now empty (no images AND no weight)
                const hasImages = images.length > 0
                const hasWeight = updatedEntry.weight_kg !== null
                const isEmpty = !hasImages && !hasWeight

                if (isEmpty) {
                  // Entry is empty, delete it
                  await database.bodyLog.deleteEntry(entryId)
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
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
                  const filePaths = images.map((img: any) => img.file_path)
                  const newUrls = await getBodyLogImageUrls(filePaths, 'hero')
                  setImageUrls(newUrls)
                  setImagesLoading(false)
                  prefetchBodyLogImages(newUrls)
                } else {
                  setImageUrls([])
                }

                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
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
    if (!entry || !entryId || entryId === 'new') return

    // Check if body scan has already been run for this entry (for Pro users)
    const alreadyScanned = entry.body_fat_percentage !== null || entry.bmi !== null
    if (alreadyScanned && isProMember) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Alert.alert(
        'Body Scan Already Completed',
        'This entry has already been analyzed. To run another body scan, please create a new entry.',
        [{ text: 'OK' }]
      )
      return
    }

    // Check requirements and provide specific feedback
    const hasEnoughPhotos = entry.images.length >= 2
    const hasWeight = entry.weight_kg !== null

    if (!hasEnoughPhotos || !hasWeight) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      const missing: string[] = []
      if (!hasEnoughPhotos) {
        const photosNeeded = 2 - entry.images.length
        missing.push(`${photosNeeded} more photo${photosNeeded > 1 ? 's' : ''} from different angles`)
      }
      if (!hasWeight) {
        missing.push('weight')
      }

      Alert.alert(
        'Body Scan Requirements',
        `To run a body scan, you need:\n\n• At least 2 photos from different angles (front, side, or back)\n• Your current weight\n\n${missing.length > 0 ? `Missing: ${missing.join(' and ')}` : ''}`,
        [{ text: 'OK' }]
      )
      return
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    // For free users: Show teaser flow (fake processing, then locked results)
    if (!isProMember) {
      setProcessingComplete(false)
      setShowProcessingModal(true)

      // Simulate processing time (3 seconds)
      setTimeout(() => {
        setProcessingComplete(true)
      }, 3000)
      return
    }

    // For Pro users: Run actual body scan
    setIsRunningBodyScan(true)

    try {
      // Get session token
      const { data } = await supabase.auth.getSession()
      const sessionToken = data.session?.access_token

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
        // Try to get error details from response
        let errorMessage = `Analysis failed with status ${response.status}`
        try {
          const errorData = await response.json()
          if (errorData.error || errorData.message) {
            errorMessage = errorData.error || errorData.message
          }
        } catch (e) {
          // If we can't parse the error response, use the status text
        }
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
        setEntry((prev) => prev ? { ...prev, ...updatedEntry } : null)
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      Alert.alert(
        'Body Scan Complete!',
        'Your body composition analysis is ready.',
      )
    } catch (error) {
      console.error('Error running body scan:', error)
      Alert.alert(
        'Analysis Failed',
        'Failed to analyze your photos. Please try again.',
      )
    } finally {
      setIsRunningBodyScan(false)
    }
  }

  // Handle teaser processing completion
  const handleTeaserProcessingComplete = () => {
    setShowProcessingModal(false)
    setProcessingComplete(false)
    // Don't set fake metrics - keep them null so they show "--"
    // Just show the locked results overlay
    setShowTeaserResults(true)
  }

  // Handle unlock button press (opens paywall)
  const handleUnlockResults = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPaywallVisible(true)
  }

  const handleDelete = async () => {
    // If this is a new entry that hasn't been created yet, just go back
    if (entryId === 'new') {
      handleBack()
      return
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

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
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            )

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

  const renderImageItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => {
        setCurrentImageIndex(index)
        setImageModalVisible(true)
      }}
      style={styles.carouselImageContainer}
    >
      <Image
        source={{ uri: item }}
        style={styles.heroImage}
        contentFit="cover"
        cachePolicy="disk"
        transition={200}
        recyclingKey={`hero-${index}`}
      />
      <LinearGradient
        colors={['transparent', 'transparent', 'rgba(0,0,0,0.6)']}
        style={styles.heroGradient}
      />
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    )
  }

  if (!entry) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
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
      style={{ flex: 1, backgroundColor: colors.background }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />

        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 100 }
          ]}
        >
            {/* Header Space */}
           <View style={{ height: insets.top + 60 }} />

           {/* Photos Section */}
           <View style={styles.photoSection}>
              {imageUrls.length === 0 ? (
                <TouchableOpacity
                  style={[styles.emptyPhotoState, { backgroundColor: colors.feedCardBackground, borderColor: colors.border }]}
                  onPress={isUploadingImage ? undefined : handleAddPhotos}
                >
                  {isUploadingImage ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <View style={[styles.cameraIconContainer, { backgroundColor: colors.background }]}>
                        <Ionicons name="camera" size={32} color={colors.primary} />
                      </View>
                      <Text style={[styles.emptyPhotoText, { color: colors.text }]}>Add Progress Photos</Text>
                      <Text style={[styles.emptyPhotoSubtext, { color: colors.textSecondary }]}>Visually track your transformation</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.photoGrid}>
                  {imageUrls.slice(0, 2).map((url, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.photoCard, { flex: 1, height: 280 }]}
                      onPress={() => {
                        setCurrentImageIndex(idx)
                        setImageModalVisible(true)
                      }}
                    >
                      <Image source={{ uri: url }} style={styles.photoImage} contentFit="cover" />
                      {idx === 1 && imageUrls.length > 2 && (
                        <View style={styles.morePhotosOverlay}>
                          <Text style={styles.morePhotosText}>+{imageUrls.length - 2}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                  {imageUrls.length < 2 && (
                     <TouchableOpacity
                       style={[styles.addPhotoSmall, { flex: 1, height: 280, backgroundColor: colors.feedCardBackground, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border }]}
                       onPress={handleAddPhotos}
                     >
                        {isUploadingImage ? (
                          <ActivityIndicator color={colors.primary} />
                        ) : (
                          <>
                            <Ionicons name="add" size={28} color={colors.primary} />
                            <Text style={[styles.addPhotoSmallText, { color: colors.textSecondary }]}>Add Photo</Text>
                          </>
                        )}
                     </TouchableOpacity>
                  )}
                </View>
              )}
           </View>

           {/* Body Composition Section */}
           <View style={styles.sectionContainer}>
             <View style={styles.sectionHeader}>
               <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Body Composition</Text>
               {!showTeaserResults && (
                  <TouchableOpacity onPress={() => setInfoModalVisible(true)} hitSlop={10}>
                     <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
               )}
             </View>

             {showTeaserResults ? (
                <LockedResultsOverlay onUnlock={handleUnlockResults} />
             ) : (
               <View style={styles.metricCardStack}>
                 {/* Body Fat Card */}
                 <View style={[styles.premiumCard, { backgroundColor: colors.feedCardBackground }]}>
                   <LinearScale
                     label="Body Fat %"
                     value={metrics.body_fat_percentage ?? 0}
                     min={5}
                     max={40}
                     subLabel={getBodyFatStatus(metrics.body_fat_percentage ?? 0, userGender)?.label}
                     ranges={[
                        { label: 'Ess.', start: 2, end: 5, color: '#EF4444' },
                        { label: 'Ath.', start: 6, end: 13, color: '#10B981' },
                        { label: 'Fit.', start: 14, end: 17, color: '#3B82F6' },
                        { label: 'Avg.', start: 18, end: 24, color: '#F59E0B' },
                        { label: 'Obs.', start: 25, end: 40, color: '#EF4444' },
                     ]}
                     colorResolver={(val) => getStatusColor(getBodyFatStatus(val, userGender)?.color || 'moderate').primary}
                   />
                 </View>

                 {/* BMI Card */}
                 <View style={[styles.premiumCard, { backgroundColor: colors.feedCardBackground }]}>
                   <LinearScale
                     label="BMI"
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
                   />
                 </View>
               </View>
             )}
           </View>

           {/* Physique Analysis Section */}
           <View style={[styles.sectionContainer, { marginBottom: 100 }]}>
             <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Physique Analysis</Text>
             </View>

             {showTeaserResults ? (
                <LockedResultsOverlay onUnlock={handleUnlockResults} />
             ) : (
               <View style={[styles.premiumCard, { backgroundColor: colors.feedCardBackground, padding: 20 }]}>
                    <Text style={[styles.physiqueCardSubTitle, { color: colors.textSecondary }]}>Detailed Muscle Distribution</Text>

                    {/* Score Grid */}
                    <View style={styles.scoreGridModern}>
                       {[
                          { label: 'Chest', score: metrics.score_chest, icon: 'fitness' },
                          { label: 'Shoulders', score: metrics.score_shoulders, icon: 'trending-up' },
                          { label: 'Abs', score: metrics.score_abs, icon: 'grid' },
                          { label: 'Arms', score: metrics.score_arms, icon: 'barbell' },
                          { label: 'Back', score: metrics.score_back, icon: 'medal' },
                          { label: 'Legs', score: metrics.score_legs, icon: 'walk' },
                       ].map((item, i) => {
                         const intensity = getScoreIntensity(item.score)
                         const color = ['#333', '#EF4444', '#F59E0B', '#10B981', '#3B82F6'][intensity]
                         return (
                           <View key={i} style={[styles.modernScoreItem, { backgroundColor: colors.background }]}>
                             <View style={styles.modernScoreHeader}>
                               <Text style={[styles.modernScoreLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                               <Ionicons name={item.icon as any} size={14} color={color} />
                             </View>
                             <Text style={[styles.modernScoreValue, { color: colors.text }]}>{item.score ?? '--'}</Text>
                             <View style={styles.modernProgressBarBg}>
                                <View style={{ height: '100%', width: `${item.score ?? 0}%`, backgroundColor: color, borderRadius: 2 }} />
                             </View>
                           </View>
                         )
                       })}
                    </View>
               </View>
             )}
           </View>


         </Animated.ScrollView>

        {/* Dynamic Action Dock */}
        <Animated.View style={[styles.actionDockContainer, { bottom: insets.bottom + 20 }, dockAnimatedStyle]}>
           <View style={[styles.actionDock, { backgroundColor: 'rgba(28, 28, 30, 0.85)', borderColor: 'rgba(255, 255, 255, 0.1)' }]}>
              {/* Add Progress Photos */}
              <TouchableOpacity style={styles.dockAction} onPress={handleAddPhotos}>
                 <Ionicons name="camera" size={22} color={colors.primary} />
                 <Text style={[styles.dockLabel, { color: colors.text }]}>Photo</Text>
              </TouchableOpacity>

              <View style={[styles.dockDivider, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} />

              {/* Log Weight */}
              <TouchableOpacity style={styles.dockAction} onPress={handleLogWeight}>
                 <View style={styles.dockWeightValue}>
                    <Text style={[styles.dockWeightText, { color: colors.text }]}>
                       {metrics.weight_kg ? formatWeight(metrics.weight_kg) : '--'}
                    </Text>
                    <Text style={[styles.dockWeightLabel, { color: colors.textSecondary }]}>Weight</Text>
                 </View>
              </TouchableOpacity>

              <View style={[styles.dockDivider, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} />

              {/* Run Scan / Analyze */}
              <TouchableOpacity 
                style={styles.dockAction} 
                onPress={handleRunBodyScan}
                disabled={isRunningBodyScan}
              >
                 {isRunningBodyScan ? (
                   <ActivityIndicator color={colors.primary} size="small" />
                 ) : (
                   <>
                    <Ionicons name="scan" size={22} color={colors.primary} />
                    <Text style={[styles.dockLabel, { color: colors.text }]}>Analyze</Text>
                   </>
                 )}
              </TouchableOpacity>
           </View>
        </Animated.View>

        {/* Floating Top Header */}
        <View style={[styles.floatingHeader, { top: insets.top }]}>
          <TouchableOpacity onPress={handleBack} style={[styles.headerCircleBtn, { backgroundColor: 'rgba(28, 28, 30, 0.8)', borderColor: 'rgba(255, 255, 255, 0.1)' }]}>
             <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
             <Text style={[styles.headerDateText, { color: colors.text }]}>
               {entry?.created_at ? new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Entry'}
             </Text>
          </View>

          <TouchableOpacity onPress={handleDelete} style={[styles.headerCircleBtn, { backgroundColor: 'rgba(28, 28, 30, 0.8)', borderColor: 'rgba(255, 255, 255, 0.1)' }]}>
             <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>

        {/* Modals */}
        <WeightInputModal
            visible={weightModalVisible}
            onClose={() => setWeightModalVisible(false)}
            onSave={handleSaveWeight}
            initialValue={entry?.weight_kg}
        />
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
            setShowProcessingModal(false)
            setProcessingComplete(false)
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
                    <Ionicons name="trash-outline" size={24} color={colors.white} />
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
                        <ActivityIndicator size="large" color={colors.white} />
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

const styles = StyleSheet.create({
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
  },
  headerTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    shadowColor: '#000',
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

  // Photos Section
  photoSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  emptyPhotoState: {
    height: 240,
    borderRadius: 28,
    borderWidth: 1,
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
    borderRadius: 24,
    overflow: 'hidden',
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
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addPhotoSmallText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // General Spacing
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // Premium Cards
  premiumCard: {
    borderRadius: 28,
    padding: 24,
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
    marginBottom: 20,
    opacity: 0.8,
  },

  // Score GridModern
  scoreGridModern: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modernScoreItem: {
    width: '48.4%',
    borderRadius: 20,
    padding: 14,
    gap: 6,
  },
  modernScoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modernScoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modernScoreValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modernProgressBarBg: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginTop: 4,
    width: '100%',
  },

  // Linear Scale Redesign
  scaleContainer: {
    width: '100%',
  },
  scaleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  scaleLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scaleValueBig: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  scaleSubLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.9,
  },
  scaleTrackContainer: {
    height: 32,
    justifyContent: 'center',
  },
  scaleTrack: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  scaleThumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -14,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scaleThumbInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  scaleMarkers: {
    position: 'absolute',
    top: 36,
    left: 0,
    right: 0,
  },
  scaleMarkerText: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.6,
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
