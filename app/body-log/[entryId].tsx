import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { BodyMetricInfoModal } from '@/components/BodyMetricInfoModal'
import { Paywall } from '@/components/paywall'
import { WeightInputModal } from '@/components/WeightInputModal'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
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
    formatBMI,
    formatBodyFat,
    formatBodyLogDate,
    type BodyLogEntryWithImages,
} from '@/lib/body-log/metadata'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { getBodyLogImageUrls } from '@/lib/utils/body-log-storage'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const HERO_HEIGHT = SCREEN_HEIGHT * 0.58
const CARD_RADIUS = 24
const METRIC_CARD_RADIUS = 20

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
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [entry, setEntry] = useState<BodyLogEntryWithImages | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [userGender, setUserGender] = useState<Gender>('male')

  // Modal states
  const [infoModalVisible, setInfoModalVisible] = useState(false)
  const [weightModalVisible, setWeightModalVisible] = useState(false)
  const [paywallVisible, setPaywallVisible] = useState(false)
  const [isRunningBodyScan, setIsRunningBodyScan] = useState(false)
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
  })

  // Image modal state and animations
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [fullscreenImageLoading, setFullscreenImageLoading] = useState(true)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fullscreenOpacity = useRef(new Animated.Value(0)).current
  const scrollX = useRef(new Animated.Value(0)).current

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
            [{ text: 'OK', onPress: () => router.back() }],
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
        })

        // Fetch signed URLs for all images
        if (transformedEntry.images.length > 0) {
          if (!cancelled) {
            setImagesLoading(true)
          }
          const filePaths = transformedEntry.images.map((img) => img.file_path)
          const urls = await getBodyLogImageUrls(filePaths)
          if (!cancelled) {
            setImageUrls(urls)
            setImagesLoading(false)
          }
        }
      } catch (error) {
        console.error('Error fetching entry:', error)
        if (!cancelled) {
          setImagesLoading(false)
          Alert.alert(
            'Error',
            'Failed to load body log entry.',
            [{ text: 'OK', onPress: () => router.back() }],
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
          })
        }

        // Update URL with real entry ID
        router.setParams({ entryId: actualEntryId })

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

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

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
        quality: 0.8, // Reduced from 0.9 to save memory in edge function
        base64: false,
      })

      if (!result.canceled && result.assets.length > 0) {
        const photoUri = result.assets[0].uri

        // Upload and save photo
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

            // Refresh image URLs - map to file paths
            if (images.length > 0) {
              setImagesLoading(true)
              const filePaths = images.map((img: any) => img.file_path)
              const newUrls = await getBodyLogImageUrls(filePaths)
              setImageUrls(newUrls)
              setImagesLoading(false)
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
    } catch (error) {
      console.error('Error accessing camera:', error)
      Alert.alert(
        'Camera Error',
        'Failed to access camera. Please try again.',
      )
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
                  router.push('/body-log')
                  return
                }

                // Entry still has data, update it
                setEntry((prev) =>
                  prev
                    ? { ...prev, images }
                    : null
                )

                // Refresh image URLs
                if (images.length > 0) {
                  setImagesLoading(true)
                  const filePaths = images.map((img: any) => img.file_path)
                  const newUrls = await getBodyLogImageUrls(filePaths)
                  setImageUrls(newUrls)
                  setImagesLoading(false)
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
    // Check if user is Pro member first
    if (!isProMember) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setPaywallVisible(true)
      return
    }

    if (!entry || !entryId || entryId === 'new') return

    // Check if body scan has already been run for this entry
    const alreadyScanned = entry.body_fat_percentage !== null || entry.bmi !== null
    if (alreadyScanned) {
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

  const handleDelete = async () => {
    // If this is a new entry that hasn't been created yet, just go back
    if (entryId === 'new') {
      router.back()
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
            router.push('/body-log')
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
        resizeMode="cover"
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Image Section with Carousel */}
        <View style={[styles.heroContainer, { backgroundColor: colors.background }]}>
          {imagesLoading ? (
            <View style={styles.heroPlaceholder}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                Loading images...
              </Text>
            </View>
          ) : imageUrls.length > 0 ? (
            <>
              <FlatList
                data={imageUrls}
                renderItem={renderImageItem}
                keyExtractor={(item, index) => `image-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x
                  scrollX.setValue(offsetX)
                  const index = Math.round(offsetX / SCREEN_WIDTH)
                  if (index !== currentImageIndex && index >= 0 && index < imageCount) {
                    setCurrentImageIndex(index)
                  }
                }}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(
                    event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
                  )
                  setCurrentImageIndex(index)
                }}
              />

              {/* Pagination indicator and date */}
              <View style={styles.bottomOverlay}>
                <View style={styles.dateOverlay}>
                  <Text style={styles.dateOverlayText}>
                    {entry.created_at ? formatBodyLogDate(entry.created_at) : '--'}
                  </Text>
                </View>
                {imageCount > 1 && (
                  <View style={styles.paginationCounter}>
                    <Text style={styles.paginationCounterText}>
                      {currentImageIndex + 1} / {imageCount}
                    </Text>
                  </View>
                )}
              </View>
            </>
          ) : isUploadingImage ? (
            <View style={styles.heroPlaceholder}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                Uploading photo...
              </Text>
            </View>
          ) : (
            <View style={styles.heroPlaceholder}>
              {entry.weight_kg !== null ? (
                <>
                  <View
                    style={[
                      styles.placeholderIconContainer,
                      { backgroundColor: colors.backgroundWhite },
                    ]}
                  >
                    <Ionicons
                      name="barbell-outline"
                      size={56}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={[styles.placeholderWeight, { color: colors.text }]}>
                    {formatWeight(entry.weight_kg)}
                  </Text>
                  <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                    Logged {formatBodyLogDate(entry.created_at)}
                  </Text>
                </>
              ) : (
                <>
                  <View
                    style={[
                      styles.placeholderIconContainer,
                      { backgroundColor: colors.backgroundWhite },
                    ]}
                  >
                    <Ionicons
                      name="images-outline"
                      size={56}
                      color={colors.textSecondary}
                    />
                  </View>
                  <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                    Take progress pic
                  </Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Metrics List */}
          <View style={styles.metricsList}>
            <Text style={[styles.overviewTitle, { color: colors.textSecondary }]}>
              OVERVIEW
            </Text>

            {/* Weight */}
            <View style={[styles.metricRow, { borderBottomColor: `${colors.border}40` }]}>
              <View style={styles.metricRowLeft}>
                <Ionicons name="barbell-outline" size={20} color={colors.primary} />
                <Text style={[styles.metricRowLabel, { color: colors.textSecondary }]}>
                  Weight
                </Text>
              </View>
              <Text style={[styles.metricRowValue, { color: colors.text }]}>
                {formatWeight(metrics.weight_kg)}
              </Text>
            </View>

            {/* Body Fat */}
            <TouchableOpacity
              style={[styles.metricRow, { borderBottomColor: `${colors.border}40` }]}
              onPress={() =>
                metrics.body_fat_percentage !== null &&
                handleInfoPress(
                  'bodyFat',
                  formatBodyFat(metrics.body_fat_percentage),
                  bodyFatStatus,
                )
              }
              disabled={metrics.body_fat_percentage === null}
              activeOpacity={0.7}
            >
              <View style={styles.metricRowLeft}>
                <Ionicons
                  name="body-outline"
                  size={20}
                  color={
                    bodyFatStatus
                      ? getStatusColor(bodyFatStatus.color).primary
                      : colors.primary
                  }
                />
                <Text style={[styles.metricRowLabel, { color: colors.textSecondary }]}>
                  Body Fat
                </Text>
              </View>
              <Text style={[styles.metricRowValue, { color: colors.text }]}>
                {formatBodyFat(metrics.body_fat_percentage)}
              </Text>
            </TouchableOpacity>

            {/* BMI */}
            <TouchableOpacity
              style={[styles.metricRow, { borderBottomWidth: 0 }]}
              onPress={() =>
                metrics.bmi !== null &&
                handleInfoPress('bmi', formatBMI(metrics.bmi), bmiStatus)
              }
              disabled={metrics.bmi === null}
              activeOpacity={0.7}
            >
              <View style={styles.metricRowLeft}>
                <Ionicons
                  name="analytics-outline"
                  size={20}
                  color={
                    bmiStatus ? getStatusColor(bmiStatus.color).primary : colors.primary
                  }
                />
                <Text style={[styles.metricRowLabel, { color: colors.textSecondary }]}>
                  BMI
                </Text>
              </View>
              <Text style={[styles.metricRowValue, { color: colors.text }]}>
                {formatBMI(metrics.bmi)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* AI Summary Card */}
          {summaryText && (
            <View
              style={[
                styles.overallStatusCard,
                {
                  backgroundColor:
                    summaryStatusColors?.background ?? colors.backgroundWhite,
                  borderColor:
                    summaryStatusColors?.primary
                      ? summaryStatusColors.primary + '25'
                      : colors.border,
                },
              ]}
            >
              <View style={styles.statusHeader}>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={summaryStatusColors?.primary ?? colors.primary}
                />
                <Text
                  style={[
                    styles.overallStatusTitle,
                    {
                      color: summaryStatusColors?.text ?? colors.text,
                    },
                  ]}
                >
                  {summaryTitle}
                </Text>
              </View>
              <Text style={[styles.overallStatusSummary, { color: colors.text }]}>
                {summaryText}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Top Actions */}
      <SafeAreaView edges={['top']} style={styles.topActionsContainer}>
        <View style={styles.topActions}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.back()}
            style={[
              styles.topButton,
              {
                backgroundColor: colors.backgroundWhite,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.topActionsSpacer} />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleDelete}
            style={[
              styles.topButton,
              {
                backgroundColor: colors.backgroundWhite,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Image Fullscreen Modal */}
      {imageUrls.length > 0 && (
        <Modal
          visible={imageModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImageModalVisible(false)}
        >
          <View style={styles.imageModalOverlay}>
            <View style={[styles.fullscreenSafeArea, { paddingTop: insets.top }]}>
              {/* Close button */}
              <TouchableOpacity
                style={styles.fullscreenCloseButton}
                onPress={() => setImageModalVisible(false)}
              >
                <Ionicons name="close" size={28} color={colors.white} />
              </TouchableOpacity>

              {/* Image counter */}
              {imageCount > 1 && (
                <View style={styles.fullscreenCounter}>
                  <Text style={styles.fullscreenCounterText}>
                    {currentImageIndex + 1} / {imageCount}
                  </Text>
                </View>
              )}

              {/* Delete button */}
              <TouchableOpacity
                style={styles.fullscreenDeleteButton}
                onPress={() => {
                  const image = entry?.images[currentImageIndex]
                  if (image?.id) {
                    setImageModalVisible(false)
                    handleDeleteImage(image.id, currentImageIndex)
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={24} color={colors.white} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={imageUrls}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.fullscreenImageWrapper}
                  onPress={() => setImageModalVisible(false)}
                >
                  <Animated.Image
                    source={{ uri: item }}
                    style={[
                      styles.fullscreenImage,
                      { opacity: fullscreenOpacity },
                    ]}
                    resizeMode="contain"
                    onLoadStart={() => setFullscreenImageLoading(true)}
                    onLoad={() => {
                      setFullscreenImageLoading(false)
                      Animated.timing(fullscreenOpacity, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                      }).start()
                    }}
                    onError={(error) => {
                      console.error(
                        'Failed to load fullscreen image:',
                        error.nativeEvent.error,
                      )
                      setFullscreenImageLoading(false)
                    }}
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

      {/* Bottom Action Buttons */}
      <SafeAreaView edges={['bottom']} style={[styles.actionBarContainer, styles.buttonContainer]}>
        <TouchableOpacity
          style={[styles.actionButtonIcon, { backgroundColor: colors.backgroundWhite, borderColor: colors.border }]}
          onPress={handleLogWeight}
          activeOpacity={0.6}
          accessibilityLabel={entry?.weight_kg ? 'Update Weight' : 'Log Weight'}
        >
          <Ionicons name="barbell-outline" size={24} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButtonIcon, { backgroundColor: colors.backgroundWhite, borderColor: colors.border }]}
          onPress={handleAddPhotos}
          activeOpacity={0.6}
          accessibilityLabel={imageUrls.length > 0 ? 'Add More Photos' : 'Add Photos'}
        >
          <Ionicons name="camera-outline" size={24} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButtonIcon,
            {
              backgroundColor: (entry && (entry.body_fat_percentage !== null || entry.bmi !== null))
                ? colors.success
                : (entry?.images.length ?? 0) >= 2 && entry?.weight_kg !== null
                ? colors.primary
                : colors.backgroundLight,
              borderColor: (entry && (entry.body_fat_percentage !== null || entry.bmi !== null))
                ? colors.success
                : (entry?.images.length ?? 0) >= 2 && entry?.weight_kg !== null
                ? colors.primary
                : colors.border,
            },
          ]}
          onPress={handleRunBodyScan}
          disabled={isRunningBodyScan || (entry && (entry.body_fat_percentage !== null || entry.bmi !== null))}
          activeOpacity={0.6}
          accessibilityLabel={entry && (entry.body_fat_percentage !== null || entry.bmi !== null) ? 'Body Scan Completed' : 'Run Body Scan'}
        >
          {isRunningBodyScan ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : entry && (entry.body_fat_percentage !== null || entry.bmi !== null) ? (
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={colors.white}
            />
          ) : (
            <Ionicons
              name="body-outline"
              size={24}
              color={(entry?.images.length ?? 0) >= 2 && entry?.weight_kg !== null ? colors.white : colors.textSecondary}
            />
          )}
        </TouchableOpacity>
      </SafeAreaView>

      {/* Weight Input Modal */}
      <WeightInputModal
        visible={weightModalVisible}
        onClose={() => {
          console.log('[WEIGHT_FLOW] 🚪 Closing weight modal')
          setWeightModalVisible(false)
        }}
        onSave={handleSaveWeight}
        initialValue={entry?.weight_kg}
      />

      {/* Info Modal */}
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

      {/* Paywall Modal */}
      <Paywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        title="Body Scan - Premium Feature"
        message="Body scan analysis is a premium feature. Upgrade to unlock AI-powered body composition analysis."
      />
    </View>
  )
}

type Colors = ReturnType<typeof useThemedColors>

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200,
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

  // Hero Section
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
    flex: 1,
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
  dateOverlay: {
    alignItems: 'flex-start',
  },

  // Content Section
  contentSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 12,
    gap: 32,
  },

  // Metrics List
  metricsList: {
    gap: 1,
  },
  overviewTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
  },
  metricRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricRowLabel: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  metricRowValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // Overall Status Card
  overallStatusCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  overallStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    flex: 1,
  },
  overallStatusSummary: {
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.2,
  },

  // Top Actions
  topActionsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  topActionsSpacer: {
    flex: 1,
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  // Image Modal
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.98)',
  },
  fullscreenSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  fullscreenCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  fullscreenDeleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  fullscreenCounter: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backdropFilter: 'blur(10px)',
  },
  fullscreenCounterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  imageModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },

  // Action Buttons
  actionBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  actionButtonIcon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 52,
  },
})
