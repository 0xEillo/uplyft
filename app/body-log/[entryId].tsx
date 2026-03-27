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
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native'
import Animated, {
    FadeInDown,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BlurredHeader } from '@/components/blurred-header'
import { BodyLogProcessingModal } from '@/components/BodyLogProcessingModal'
import { BodyMetricInfoModal } from '@/components/BodyMetricInfoModal'
import { LockedResultsOverlay } from '@/components/LockedResultsOverlay'
import { Paywall } from '@/components/paywall'
import { ScreenHeader } from '@/components/screen-header'
import { SlideInView } from '@/components/slide-in-view'
import { WeightInputModal } from '@/components/WeightInputModal'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useUnit } from '@/contexts/unit-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
    getBMIExplanation,
    getBMIStatus,
    getBodyFatExplanation,
    getBodyFatStatus,
    getWeightExplanation,
    type BMIRange,
    type BodyFatRange,
    type Gender
} from '@/lib/body-log/composition-analysis'
import {
    type BodyLogEntryWithImages,
    type BodyLogImage,
} from '@/lib/body-log/metadata'
import { getCoach } from '@/lib/coaches'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import {
    getBodyLogImageUrls,
    prefetchBodyLogImages,
} from '@/lib/utils/body-log-storage'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const HERO_HEIGHT = SCREEN_HEIGHT * 0.45
const HEADER_ROW_HEIGHT = 68

const getLocalDateKey = (dateString: string): string => {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dateKeyToMiddayIso = (logDate: string): string => {
  const [year, month, day] = logDate
    .split('-')
    .map((value) => parseInt(value, 10))
  return new Date(year, Math.max(month - 1, 0), day, 12, 0, 0).toISOString()
}

const normalizeLogDateParam = (logDate?: string): string | null => {
  if (!logDate) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(logDate)) return logDate

  const parsed = new Date(logDate)
  if (Number.isNaN(parsed.getTime())) return null
  return getLocalDateKey(parsed.toISOString())
}

// Helper for intensity (1-4)


// Helper component for linear scale (Body Fat / BMI) - kept for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  value: number | null
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
  const displayValue = value !== null ? value : null
  const percent = displayValue !== null 
    ? Math.min(Math.max((displayValue - min) / (max - min), 0), 1) * 100
    : 0
  
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
              {displayValue !== null ? `${displayValue}${unit || ''}` : '--'}
            </Text>
            {subLabel && (
              <View style={[styles.statusBadge, { backgroundColor: (colorResolver && displayValue !== null) ? `${colorResolver(displayValue!)}20` : 'transparent' }]}>
                <Text style={[styles.scaleSubLabel, { color: (colorResolver && displayValue !== null) ? colorResolver(displayValue!) : colors.textSecondary }]}>
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
        {displayValue !== null && (
          <View style={[styles.scaleThumb, { left: `${percent}%`, backgroundColor: colors.surfaceCard, borderColor: colors.surfaceCard }]}>
             <View style={[styles.scaleThumbInner, { backgroundColor: colorResolver ? colorResolver(displayValue!) : colors.textPrimary }]} />
          </View>
        )}
        
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
  const { entryId, weightKg, bodyFatPercentage, bmi, logDate } = useLocalSearchParams<{
    entryId: string
    weightKg?: string
    bodyFatPercentage?: string
    bmi?: string
    logDate?: string
  }>()

  const colors = useThemedColors()
  const { formatWeight, weightUnit } = useUnit()
  const { user } = useAuth()
  const { coachId } = useProfile()
  const { isProMember } = useSubscription()
  const coach = getCoach(coachId)
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
  const [activeLogDate, setActiveLogDate] = useState<string | null>(
    normalizeLogDateParam(logDate),
  )

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

  const handleBack = () => {
    setShouldExit(true)
  }

  const handleExitComplete = () => {
    router.back()
  }

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
      const fallbackDate = getLocalDateKey(new Date().toISOString())
      const resolvedLogDate = normalizeLogDateParam(logDate) || fallbackDate
      void (async () => {
        try {
          const dailyEntry = await database.dailyLog.getDayEntry(
            user.id,
            resolvedLogDate,
          )
          const resolvedWeightKg = dailyEntry?.weight_kg ?? null
          const emptyEntry: BodyLogEntryWithImages = {
            id: 'new',
            user_id: user.id,
            created_at: dateKeyToMiddayIso(resolvedLogDate),
            weight_kg: resolvedWeightKg,
            body_fat_percentage: null,
            bmi: null,
            analysis_summary: null,
            muscle_mass_kg: null,
            images: [],
          }
          setEntry(emptyEntry)
          setMetrics((prev) => ({ ...prev, weight_kg: resolvedWeightKg }))
          setActiveLogDate(resolvedLogDate)
        } catch (error) {
          console.error('Error loading daily weight:', error)
        } finally {
          setLoading(false)
        }
      })()
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
        const resolvedLogDate = getLocalDateKey(entryData.created_at)
        const dailyEntry = await database.dailyLog.getDayEntry(
          user.id,
          resolvedLogDate,
        )
        const resolvedWeightKg = dailyEntry?.weight_kg ?? entryData.weight_kg

        const transformedEntry: BodyLogEntryWithImages = {
          id: entryData.id,
          user_id: entryData.user_id,
          created_at: entryData.created_at,
          weight_kg: resolvedWeightKg,
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
        setActiveLogDate(resolvedLogDate)

        // Update metrics from entry data
        setMetrics({
          weight_kg: resolvedWeightKg,
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
  }, [user, entryId, router, logDate])

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

      const targetLogDate =
        activeLogDate ||
        (entry?.created_at ? getLocalDateKey(entry.created_at) : null)

      if (!targetLogDate) {
        return
      }

      await database.dailyLog.updateDay(user.id, {
        logDate: targetLogDate,
        weightKg,
      })

      // Update local state
      setMetrics((prev) => ({ ...prev, weight_kg: weightKg }))
      setEntry((prev) => (prev ? { ...prev, weight_kg: weightKg } : prev))

      hapticSuccess()
    } catch (error) {
      console.error('Error saving weight:', error)
      Alert.alert('Error', 'Failed to save weight. Please try again.')
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
        const newEntry = await database.bodyLog.createEntry(user.id, {
          createdAt: activeLogDate ? dateKeyToMiddayIso(activeLogDate) : undefined,
        })
        actualEntryId = newEntry.id

        // Update URL with real entry ID
        router.setParams({ entryId: actualEntryId })
      }

      if (!actualEntryId) {
        return
      }

      // Import uploadBodyLogImage once for all uploads
      const { uploadBodyLogImage } = await import('@/lib/utils/body-log-storage')

      const startingSequence = (entry?.images.length ?? 0) + 1
      const uploadResults = await Promise.all(
        toUpload.map((photoUri, index) => {
          const sequence = startingSequence + index
          return uploadBodyLogImage(photoUri, user.id, actualEntryId, sequence)
        }),
      )

      await Promise.all(
        uploadResults.map((filePath, index) => {
          const sequence = startingSequence + index
          return database.bodyLog.addImage(
            actualEntryId,
            user.id,
            filePath,
            sequence,
          )
        }),
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
                    router.replace('/body-log/' as any)
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
      const resolvedWeightKg = analysisMetrics.weight_kg ?? entry.weight_kg
      const currentUserId = user?.id

      if (analysisMetrics.weight_kg !== undefined && currentUserId) {
        const targetLogDate =
          activeLogDate ||
          (entry?.created_at ? getLocalDateKey(entry.created_at) : null)

        if (targetLogDate) {
          await database.dailyLog.updateDay(currentUserId, {
            logDate: targetLogDate,
            weightKg: analysisMetrics.weight_kg,
          })
        }
      }

      // Update local state with analysis results
      setMetrics({
        weight_kg: resolvedWeightKg,
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
        setEntry((prev) =>
          prev ? { ...prev, ...updatedEntry, weight_kg: resolvedWeightKg } : null,
        )
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
              router.replace('/body-log/' as any)
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
  const getPhysiqueScoreTone = (value: number) => {
    if (value >= 75) return '#8B5CF6' // Advanced  — purple
    if (value >= 65) return '#10B981' // Intermediate — green
    if (value >= 55) return '#3B82F6' // Novice — blue
    return '#9CA3AF'                  // Beginner — gray
  }

  const getPhysiqueScoreTier = (value: number): string => {
    if (value >= 75) return 'Elite'
    if (value >= 65) return 'Good'
    if (value >= 55) return 'Fair'
    return 'Needs Work'
  }

  return (
    <SlideInView
      style={{ flex: 1, backgroundColor: colors.bg }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        <BlurredHeader>
          <ScreenHeader
            title={entry?.created_at ? new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Entry'}
            onLeftPress={handleBack}
            leftIcon="arrow-back"
            rightIcon="trash-outline"
            onRightPress={handleDelete}
          />
        </BlurredHeader>

        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          style={styles.container}
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ top: insets.top + HEADER_ROW_HEIGHT }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 100, paddingTop: insets.top + HEADER_ROW_HEIGHT + 16 }
          ]}
        >

            {/* Progress Photos — small thumbnail strip */}
            {imageUrls.length > 0 && (
              <View style={styles.photoStripSection}>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={
                    imageUrls.length < 3 && !(metrics.body_fat_percentage !== null || metrics.bmi !== null)
                      ? ([...imageUrls, 'add'] as (string | 'add')[])
                      : imageUrls
                  }
                  keyExtractor={(_, i) => `thumb-${i}`}
                  contentContainerStyle={styles.photoStripContent}
                  renderItem={({ item, index }) => {
                    if (item === 'add') {
                      return (
                        <TouchableOpacity
                          style={[styles.photoThumbAdd, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                          onPress={handleAddPhotos}
                          activeOpacity={0.7}
                        >
                          {isUploadingImage
                            ? <ActivityIndicator size="small" color={colors.textSecondary} />
                            : <Ionicons name="add" size={22} color={colors.textSecondary} />
                          }
                        </TouchableOpacity>
                      )
                    }
                    return (
                      <TouchableOpacity
                        style={styles.photoThumb}
                        onPress={() => { setCurrentImageIndex(index); setImageModalVisible(true) }}
                        activeOpacity={0.88}
                      >
                        <Image source={{ uri: item as string }} style={styles.photoThumbImg} contentFit="cover" transition={200} />
                      </TouchableOpacity>
                    )
                  }}
                />
              </View>
            )}

            {/* No photos: subtle add row (hidden after scan) */}
            {imageUrls.length === 0 && (metrics.body_fat_percentage === null && metrics.bmi === null) && (
              <TouchableOpacity
                style={[styles.addPhotosRow, { borderColor: colors.border }]}
                onPress={handleAddPhotos}
                activeOpacity={0.7}
              >
                <View style={[styles.addPhotosIconWrap, { backgroundColor: colors.surfaceSubtle }]}>
                  <Ionicons name="camera-outline" size={16} color={colors.textSecondary} />
                </View>
                <Text style={[styles.addPhotosRowText, { color: colors.textSecondary }]}>Add progress photos</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.border} />
              </TouchableOpacity>
            )}

            {/* Primary Metrics */}
            {(() => {
              const lean = metrics.lean_mass_kg ?? 0
              const fat = metrics.fat_mass_kg ?? 0
              const total = lean + fat
              const leanPct = total > 0 ? (lean / total) * 100 : 0
              const hasComposition = metrics.lean_mass_kg !== null || metrics.fat_mass_kg !== null
              return (
                <Animated.View
                  entering={FadeInDown.duration(400).delay(80)}
                  style={[styles.metricsDashboard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
                >
                  {/* Top row: Weight · Body Fat · BMI */}
                  <View style={[styles.metricsTopRow, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity style={styles.metricCell} onPress={handleLogWeight} activeOpacity={0.7}>
                      <View style={styles.metricCellValueRow}>
                        <Text style={[styles.metricCellValue, { color: colors.textPrimary }]}>
                          {metrics.weight_kg ? formatWeight(metrics.weight_kg).split(' ')[0] : '—'}
                        </Text>
                        {metrics.weight_kg !== null && (
                          <Text style={[styles.metricCellUnit, { color: colors.textSecondary }]}>{weightUnit}</Text>
                        )}
                      </View>
                      <Text style={[styles.metricCellLabel, { color: colors.textSecondary }]}>Weight</Text>
                    </TouchableOpacity>

                    <View style={[styles.metricCellDivider, { backgroundColor: colors.border }]} />

                    <TouchableOpacity
                      style={styles.metricCell}
                      onPress={() => {
                        if (metrics.body_fat_percentage !== null) {
                          handleInfoPress('bodyFat', metrics.body_fat_percentage.toString(), getBodyFatStatus(metrics.body_fat_percentage, userGender))
                        } else {
                          handleRunBodyScan()
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.metricCellValueRow}>
                        <Text style={[styles.metricCellValue, { color: colors.textPrimary }]}>
                          {metrics.body_fat_percentage !== null ? `${metrics.body_fat_percentage}` : '—'}
                        </Text>
                        {metrics.body_fat_percentage !== null && (
                          <Text style={[styles.metricCellUnit, { color: colors.textSecondary }]}>%</Text>
                        )}
                      </View>
                      <Text style={[styles.metricCellLabel, { color: colors.textSecondary }]}>Body Fat</Text>
                    </TouchableOpacity>

                    <View style={[styles.metricCellDivider, { backgroundColor: colors.border }]} />

                    <TouchableOpacity
                      style={styles.metricCell}
                      onPress={() => {
                        if (metrics.bmi !== null) {
                          handleInfoPress('bmi', metrics.bmi.toString(), getBMIStatus(metrics.bmi, userGender))
                        } else if (metrics.weight_kg && userHeight) {
                          handleInfoPress('bmi', '--', null)
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.metricCellValue, { color: colors.textPrimary }]}>
                        {metrics.bmi !== null ? metrics.bmi.toFixed(1) : '—'}
                      </Text>
                      <Text style={[styles.metricCellLabel, { color: colors.textSecondary }]}>BMI</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Composition bar */}
                  {hasComposition && (
                    <Animated.View entering={FadeInDown.duration(350).delay(160)} style={styles.compositionSection}>
                      <View style={[styles.compositionTrack, { backgroundColor: colors.surfaceSubtle }]}>
                        {leanPct > 0 && (
                          <View
                            style={[styles.compositionFill, { width: `${leanPct}%` as any, backgroundColor: colors.textPrimary }]}
                          />
                        )}
                      </View>
                      <View style={styles.compositionEndLabels}>
                        {metrics.lean_mass_kg !== null && (
                          <View>
                            <Text style={[styles.compositionEndValue, { color: colors.textPrimary }]}>
                              {formatWeight(metrics.lean_mass_kg)}
                            </Text>
                            <Text style={[styles.compositionEndName, { color: colors.textSecondary }]}>Lean Muscle</Text>
                          </View>
                        )}
                        {metrics.fat_mass_kg !== null && (
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.compositionEndValue, { color: colors.textPrimary }]}>
                              {formatWeight(metrics.fat_mass_kg)}
                            </Text>
                            <Text style={[styles.compositionEndName, { color: colors.textSecondary }]}>Body Fat</Text>
                          </View>
                        )}
                      </View>
                    </Animated.View>
                  )}
                </Animated.View>
              )
            })()}

            {/* Scan Results (Physique scores, Coach notes) */}
            {(metrics.lean_mass_kg !== null ||
              metrics.fat_mass_kg !== null ||
              metrics.score_v_taper !== null ||
              entry?.analysis_summary) && (
              <View style={styles.scanSection}>

                {/* Physique Scores */}
                {(metrics.score_v_taper !== null ||
                  metrics.score_chest !== null ||
                  metrics.score_shoulders !== null ||
                  metrics.score_abs !== null ||
                  metrics.score_arms !== null ||
                  metrics.score_back !== null ||
                  metrics.score_legs !== null) && (
                  <View style={[styles.scoresCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>

                    {/* Header */}
                    <View style={[styles.scoresHeader, { borderBottomColor: colors.border }]}>
                      <View style={styles.scoresHeaderText}>
                        <Text style={[styles.scoresTitle, { color: colors.textPrimary }]}>Physique Scores</Text>
                        <Text style={[styles.scoresSubtitle, { color: colors.textSecondary }]}>
                          AI-analyzed from your photos · each area rated 0–100
                        </Text>
                      </View>
                    </View>

                    {/* Legend */}
                    <View style={[styles.scoreLegendRow, { borderBottomColor: colors.border }]}>
                      {[
                        { label: 'Elite', color: '#8B5CF6' },
                        { label: 'Good', color: '#10B981' },
                        { label: 'Fair', color: '#3B82F6' },
                        { label: 'Needs Work', color: '#9CA3AF' },
                      ].map((tier) => (
                        <View key={tier.label} style={styles.scoreLegendItem}>
                          <View style={[styles.scoreLegendDot, { backgroundColor: tier.color }]} />
                          <Text style={[styles.scoreLegendLabel, { color: colors.textSecondary }]}>{tier.label}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Score rows */}
                    {[
                      { key: 'score_v_taper', label: 'V-Taper', val: metrics.score_v_taper },
                      { key: 'score_chest', label: 'Chest', val: metrics.score_chest },
                      { key: 'score_shoulders', label: 'Shoulders', val: metrics.score_shoulders },
                      { key: 'score_abs', label: 'Abs', val: metrics.score_abs },
                      { key: 'score_arms', label: 'Arms', val: metrics.score_arms },
                      { key: 'score_back', label: 'Back', val: metrics.score_back },
                      { key: 'score_legs', label: 'Legs', val: metrics.score_legs },
                    ].filter((item) => item.val !== null).map((item, idx, arr) => {
                      const tone = getPhysiqueScoreTone(item.val!)
                      const tier = getPhysiqueScoreTier(item.val!)
                      return (
                        <View
                          key={item.key}
                          style={[
                            styles.scoreRow,
                            idx < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                          ]}
                        >
                          <Text style={[styles.scoreRowLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                          <View style={[styles.scoreBarTrack, { backgroundColor: colors.surfaceSubtle }]}>
                            <View style={[styles.scoreBarFill, { width: `${item.val}%` as any, backgroundColor: tone }]} />
                          </View>
                          <View style={[styles.scoreBadge, { backgroundColor: tone + '1A' }]}>
                            <Text style={[styles.scoreBadgeTier, { color: tone }]}>{tier}</Text>
                            <Text style={[styles.scoreBadgeNum, { color: tone }]}>{item.val}</Text>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                )}

                {/* Coach Notes */}
                {entry?.analysis_summary && (
                  <View style={[styles.coachNotes, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                    <View style={styles.coachNotesHead}>
                      <Image source={coach.image} style={styles.coachAvatar} contentFit="cover" />
                      <Text style={[styles.coachNotesTitle, { color: colors.textSecondary }]}>Coach Notes</Text>
                    </View>
                    <Text style={[styles.coachNotesText, { color: colors.textPrimary }]}>{entry.analysis_summary}</Text>
                  </View>
                )}
              </View>
            )}

            {showTeaserResults && (
              <View style={[styles.sectionContainer, { marginTop: -20, marginBottom: 40 }]}>
                <View style={styles.resultsWrapper}>
                  <LockedResultsOverlay onUnlock={handleUnlockResults} />
                </View>
              </View>
            )}
         </Animated.ScrollView>

         {/* Dynamic Action Dock */}
        {(metrics.body_fat_percentage === null || imageUrls.length < 2) && (
          <Animated.View
            style={[
              styles.actionDockContainer,
              { bottom: insets.bottom + 20 },
              dockAnimatedStyle,
            ]}
          >
            {imageUrls.length < 2 ? (
                <TouchableOpacity 
                   style={[
                     styles.bodyScanButton, 
                     { 
                       backgroundColor: colors.textPrimary,
                       shadowColor: colors.textPrimary,
                     }
                   ]}
                   onPress={handleAddPhotos}
                   activeOpacity={0.8}
                 >
                   {isUploadingImage ? (
                     <ActivityIndicator color={colors.bg} size="small" />
                   ) : (
                     <>
                       <Ionicons name="camera" size={22} color={colors.bg} />
                       <Text style={[styles.bodyScanButtonText, { color: colors.bg }]}>Progress Pic</Text>
                     </>
                   )}
                 </TouchableOpacity>
            ) : (
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
            )}
          </Animated.View>
        )}



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
                initialNumToRender={1}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews
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

  // Progress Photos - Clean Horizontal Carousel
  progressSection: {
    marginBottom: 32,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressPhotoCard: {
    width: SCREEN_WIDTH - 60,
    height: 400,
    marginLeft: 20,
    borderRadius: 24,
    overflow: 'hidden',
  },
  progressPhoto: {
    width: '100%',
    height: '100%',
  },
  progressAddCard: {
    width: SCREEN_WIDTH - 60,
    height: 400,
    marginLeft: 20,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },

  progressAddText: {
    fontSize: 15,
    fontWeight: '600',
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
  emptyPhotosContainer: {
    marginHorizontal: 20,
    height: 180,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBig: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addPhotoText: {
    fontSize: 16,
    fontWeight: '700',
    opacity: 0.8,
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
  sectionSubtitle: {
    marginTop: 3,
    marginLeft: 2,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  foodMealsCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  foodSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  foodSummaryItem: {
    flex: 1,
    minWidth: 140,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  foodSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  foodSummaryLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  foodMealsDivider: {
    marginVertical: 14,
    height: 1,
    opacity: 0.5,
  },
  foodLoadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  foodEmptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  foodMealList: {
    gap: 0,
  },
  foodMealRow: {
    paddingVertical: 10,
  },
  foodMealRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  foodMealDescription: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  foodMealTime: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  foodMealMacros: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  
  // Dashboard Styles
  foodCaloriesCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle, // slightly lighter than card background
    borderRadius: 20,
    padding: 20,
    width: '100%',
  },
  foodCaloriesValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1,
    marginBottom: 4,
  },
  foodCaloriesLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chartContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartIcon: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallChartContainer: {
    marginTop: 8,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodMacroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  foodMacroCard: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foodMacroValueSmall: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  foodMacroLabelSmall: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  foodDetailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
  },
  foodDetailsToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },

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
  measurementRow: {
    flexDirection: 'row',
    gap: 12,
  },
  measurementPanel: {
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  measurementCard: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 118,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  measurementAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  measurementCardTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  measurementIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  measurementCardEmpty: {
    opacity: 0.9,
  },
  measurementPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  measurementValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  measurementLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    opacity: 0.75,
    letterSpacing: 0.9,
    marginTop: 6,
  },
  measurementUnit: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.55,
  },

  scanResultsCard: {
    borderRadius: 24,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
    position: 'relative',
  },
  scanResultsGlow: {
    position: 'absolute',
    top: -60,
    right: -30,
    width: 180,
    height: 140,
    borderRadius: 90,
    backgroundColor: 'rgba(99,102,241,0.06)',
  },
  scanResultsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  scanResultsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  scanResultsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  scanResultsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scanMetricChip: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'flex-start',
    borderWidth: 1,
  },
  scanMetricIconPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  scanMetricValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  scanMetricLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  physiqueScoresRow: {
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  physiqueScoresTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  physiqueScoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  physiqueScoreChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    minWidth: 86,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  physiqueScoreAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  physiqueScoreValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  physiqueScoreLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  analysisSummary: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  analysisSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analysisSummaryCoachAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  analysisSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  analysisSummaryText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
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
    borderRadius: 12,
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

  // Photo Strip (small thumbnails)
  photoStripSection: {
    marginBottom: 24,
  },
  photoStripContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  photoThumb: {
    width: 88,
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoThumbImg: {
    width: '100%',
    height: '100%',
  },
  photoThumbAdd: {
    width: 88,
    height: 110,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  addPhotosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 24,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addPhotosIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotosRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },

  // Metrics Dashboard
  metricsDashboard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  metricsTopRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
    gap: 4,
  },
  metricCellValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  metricCellValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 30,
  },
  metricCellUnit: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
  },
  metricCellLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.55,
  },
  metricCellDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  compositionSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 10,
  },
  compositionTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  compositionFill: {
    height: '100%',
    borderRadius: 5,
  },
  compositionEndLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compositionEndValue: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  compositionEndName: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
    opacity: 0.6,
  },

  // Scan Section
  scanSection: {
    marginHorizontal: 20,
    gap: 12,
    marginBottom: 32,
  },
  scoresCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scoresHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scoresHeaderText: {
    gap: 3,
  },
  scoresTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  scoresSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    opacity: 0.75,
  },
  scoreLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scoreLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scoreLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  scoreLegendLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    gap: 12,
  },
  scoreRowLabel: {
    width: 76,
    fontSize: 13,
    fontWeight: '600',
  },
  scoreBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  scoreBadgeTier: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  scoreBadgeNum: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.65,
  },
  coachNotes: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  coachNotesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  coachNotesTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  coachNotesText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
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
