import { BodyLogProcessingModal } from '@/app/components/BodyLogProcessingModal'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { type BodyLogRecord } from '@/lib/body-log/metadata'
import { database } from '@/lib/database'
import {
  getBodyLogImageUrl,
  getBodyLogImageUrls,
  uploadBodyLogImage,
} from '@/lib/utils/body-log-storage'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { supabase } from '@/lib/supabase'

const SCREEN_WIDTH = Dimensions.get('window').width
const IMAGE_SPACING = 4
const NUM_COLUMNS = 2
const IMAGE_SIZE =
  (SCREEN_WIDTH - IMAGE_SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS

type BodyLogImageStatus = 'idle' | 'loading' | 'loaded' | 'error'

type AnalysisStatus = 'idle' | 'pending' | 'success' | 'error'

interface BodyLogImageRecord extends BodyLogRecord {
  signedUrl: string | null
  status: BodyLogImageStatus
  analysisStatus: AnalysisStatus
}

interface BodyLogImageItemProps {
  image: BodyLogImageRecord
  onPress: (image: BodyLogImageRecord) => void
  onLoadStart: (imageId: string) => void
  onLoadSuccess: (imageId: string) => void
  onLoadError: (imageId: string) => void
}

const BodyLogImageItem = memo(
  ({
    image,
    onPress,
    onLoadStart,
    onLoadSuccess,
    onLoadError,
  }: BodyLogImageItemProps) => {
    const colors = useThemedColors()
    const styles = useMemo(() => createImageItemStyles(colors), [colors])

    const handlePress = useCallback(() => {
      if (image.signedUrl) {
        onPress(image)
      }
    }, [image, onPress])

    const showAnalysisSpinner = image.analysisStatus === 'pending'

    return (
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={handlePress}
        activeOpacity={image.signedUrl ? 0.9 : 1}
        disabled={!image.signedUrl}
      >
        {image.signedUrl ? (
          <>
            <Image
              source={{ uri: image.signedUrl }}
              style={styles.image}
              resizeMode="cover"
              onLoadStart={() => onLoadStart(image.id)}
              onLoad={() => onLoadSuccess(image.id)}
              onError={() => onLoadError(image.id)}
            />
            {(image.status !== 'loaded' || showAnalysisSpinner) && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </>
        ) : (
          <View style={styles.imageLoadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </TouchableOpacity>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.image.id === nextProps.image.id &&
      prevProps.image.signedUrl === nextProps.image.signedUrl &&
      prevProps.image.status === nextProps.image.status &&
      prevProps.image.analysisStatus === nextProps.image.analysisStatus
    )
  },
)

BodyLogImageItem.displayName = 'BodyLogImageItem'

export default function BodyLogScreen() {
  const colors = useThemedColors()
  const { user } = useAuth()
  const router = useRouter()
  const styles = createStyles(colors)

  const [imageOrder, setImageOrder] = useState<string[]>([])
  const [imageStore, setImageStore] = useState<
    Record<string, BodyLogImageRecord>
  >({})
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isOpeningCamera, setIsOpeningCamera] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  // Processing modal state
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingImageUri, setProcessingImageUri] = useState<string | null>(
    null,
  )
  const [processingImageId, setProcessingImageId] = useState<string | null>(
    null,
  )
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false)

  const images = useMemo(() => {
    return imageOrder
      .map((id) => imageStore[id])
      .filter((image): image is BodyLogImageRecord => Boolean(image))
  }, [imageOrder, imageStore])

  useEffect(() => {
    if (!user) {
      setImageOrder([])
      setImageStore({})
      setIsInitialLoading(false)
      setSessionToken(null)
      return
    }

    let cancelled = false

    const loadImages = async () => {
      setIsInitialLoading(true)

      try {
        const bodyLogData = await database.bodyLog.getAll(user.id)
        if (cancelled) return

        if (!bodyLogData || bodyLogData.length === 0) {
          setImageOrder([])
          setImageStore({})
          return
        }

        const filePaths = bodyLogData.map((img: any) => img.file_path)
        const signedUrls = await getBodyLogImageUrls(filePaths)
        if (cancelled) return

        const records: BodyLogImageRecord[] = bodyLogData.map(
          (img: any, index: number) => ({
            id: img.id,
            user_id: img.user_id,
            file_path: img.file_path,
            created_at: img.created_at,
            weight_kg: img.weight_kg ?? null,
            body_fat_percentage: img.body_fat_percentage ?? null,
            bmi: img.bmi ?? null,
            muscle_mass_kg: img.muscle_mass_kg ?? null,
            signedUrl: signedUrls[index] ?? null,
            status: signedUrls[index] ? 'idle' : 'error',
            analysisStatus:
              img.body_fat_percentage !== null ||
              img.bmi !== null ||
              img.muscle_mass_kg !== null ||
              img.weight_kg !== null
                ? 'success'
                : 'idle',
          }),
        )

        setImageStore(() => {
          const next: Record<string, BodyLogImageRecord> = {}
          records.forEach((record) => {
            next[record.id] = record
          })
          return next
        })
        setImageOrder(records.map((record) => record.id))
      } catch (error) {
        console.error('Error loading body log images:', error)
      } finally {
        if (!cancelled) {
          setIsInitialLoading(false)
        }
      }
    }

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token || null
      if (!cancelled) setSessionToken(accessToken)
    }

    loadImages()
    syncSession()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!cancelled) {
          setSessionToken(nextSession?.access_token || null)
        }
      },
    )

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [user])

  const markImageStatus = useCallback(
    (imageId: string, status: BodyLogImageStatus) => {
      setImageStore((prev) => {
        const current = prev[imageId]
        if (!current || current.status === status) {
          return prev
        }

        if (current.status === 'loaded' && status === 'loading') {
          // Keep loaded thumbnails from regressing when FlatList re-renders.
          return prev
        }

        return {
          ...prev,
          [imageId]: {
            ...current,
            status,
          },
        }
      })
    },
    [],
  )

  const handleBackPress = useCallback(() => {
    router.push('/(tabs)/explore')
  }, [router])

  const handleImageOpen = useCallback(
    (image: BodyLogImageRecord) => {
      const params: { imageId: string; createdAt: string; [key: string]: string } = {
        imageId: image.id,
        createdAt: image.created_at,
      }

      if (image.file_path) {
        params.filePath = image.file_path
      }

      if (image.signedUrl) {
        params.signedUrl = image.signedUrl
      }

      // Add metrics if they exist
      if (image.weight_kg !== null) {
        params.weightKg = image.weight_kg.toString()
      }
      if (image.body_fat_percentage !== null) {
        params.bodyFatPercentage = image.body_fat_percentage.toString()
      }
      if (image.bmi !== null) {
        params.bmi = image.bmi.toString()
      }
      if (image.muscle_mass_kg !== null) {
        params.muscleMassKg = image.muscle_mass_kg.toString()
      }

      router.push({
        pathname: '/body-log/[imageId]',
        params,
      })
    },
    [router],
  )

  const handleImageLoadStart = useCallback(
    (imageId: string) => {
      markImageStatus(imageId, 'loading')
    },
    [markImageStatus],
  )

  const handleImageLoadSuccess = useCallback(
    (imageId: string) => {
      markImageStatus(imageId, 'loaded')
    },
    [markImageStatus],
  )

  const handleImageLoadError = useCallback(
    (imageId: string) => {
      markImageStatus(imageId, 'error')
    },
    [markImageStatus],
  )

  const analyzeImageMetrics = useCallback(
    async (imageId: string, accessToken: string | null) => {
      if (!accessToken) {
        console.warn('Skipping analysis: missing access token')
        return
      }

      setImageStore((prev) => {
        const current = prev[imageId]
        if (!current) return prev
        return {
          ...prev,
          [imageId]: {
            ...current,
            analysisStatus: 'pending',
          },
        }
      })

      try {
        const response = await fetch('/api/body-log/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ imageId }),
        })

        if (!response.ok) {
          throw new Error(`Analysis failed with status ${response.status}`)
        }

        const { metrics } = await response.json()

        setImageStore((prev) => {
          const current = prev[imageId]
          if (!current) return prev
          return {
            ...prev,
            [imageId]: {
              ...current,
              weight_kg: metrics.weight_kg ?? current.weight_kg,
              body_fat_percentage:
                metrics.body_fat_percentage ?? current.body_fat_percentage,
              bmi: metrics.bmi ?? current.bmi,
              muscle_mass_kg:
                metrics.muscle_mass_kg ?? current.muscle_mass_kg,
              analysisStatus: 'success',
            },
          }
        })
      } catch (error) {
        console.error('Body log analysis failed:', error)
        setImageStore((prev) => {
          const current = prev[imageId]
          if (!current) return prev
          return {
            ...prev,
            [imageId]: {
              ...current,
              analysisStatus: 'error',
            },
          }
        })
      }
    },
    [],
  )

  const handleCameraPress = useCallback(async () => {
    if (!user) {
      alert('You must be logged in to add photos')
      return
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsOpeningCamera(true)

    const placeholderId = `temp-${Date.now()}`

    const addPlaceholder = () => {
      const placeholder: BodyLogImageRecord = {
        id: placeholderId,
        user_id: user.id,
        file_path: '',
        created_at: new Date().toISOString(),
        weight_kg: null,
        body_fat_percentage: null,
        bmi: null,
        muscle_mass_kg: null,
        signedUrl: null,
        status: 'loading',
        analysisStatus: 'pending',
      }

      setImageStore((prev) => ({
        ...prev,
        [placeholderId]: placeholder,
      }))
      setImageOrder((prev) => [placeholderId, ...prev])
    }

    const removePlaceholder = () => {
      setImageStore((prev) => {
        if (!prev[placeholderId]) return prev
        const next = { ...prev }
        delete next[placeholderId]
        return next
      })
      setImageOrder((prev) => prev.filter((id) => id !== placeholderId))
    }

    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync()

      if (!permissionResult.granted) {
        alert('Permission to access camera is required!')
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      })

      if (result.canceled || !result.assets?.[0]) {
        return
      }

      const localUri = result.assets[0].uri

      // Show processing modal immediately
      setProcessingImageUri(localUri)
      setIsProcessing(true)
      setIsAnalysisComplete(false)

      addPlaceholder()

      try {
        const filePath = await uploadBodyLogImage(localUri, user.id)
        const newImage = await database.bodyLog.create(user.id, filePath)
        const signedUrl = await getBodyLogImageUrl(filePath)

        // Store the image ID for navigation later
        setProcessingImageId(newImage.id)

        setImageStore((prev) => {
          const next = { ...prev }
          delete next[placeholderId]

          next[newImage.id] = {
            id: newImage.id,
            user_id: newImage.user_id,
            file_path: filePath,
            created_at: newImage.created_at,
            weight_kg: newImage.weight_kg ?? null,
            body_fat_percentage: newImage.body_fat_percentage ?? null,
            bmi: newImage.bmi ?? null,
            muscle_mass_kg: newImage.muscle_mass_kg ?? null,
            signedUrl,
            status: 'idle',
            analysisStatus: 'pending',
          }

          return next
        })

        setImageOrder((prev) => {
          const withoutPlaceholder = prev.filter((id) => id !== placeholderId)
          return [newImage.id, ...withoutPlaceholder]
        })

        analyzeImageMetrics(newImage.id, sessionToken)
      } catch (uploadError) {
        console.error('Error uploading photo:', uploadError)
        alert('Failed to save photo. Please try again.')
        removePlaceholder()
        // Hide processing modal on error
        setIsProcessing(false)
        setProcessingImageUri(null)
        setProcessingImageId(null)
        setIsAnalysisComplete(false)
      }
    } catch (error) {
      console.error('Error opening camera:', error)
      alert('Failed to save photo. Please try again.')
      removePlaceholder()
      // Hide processing modal on error
      setIsProcessing(false)
      setProcessingImageUri(null)
      setProcessingImageId(null)
      setIsAnalysisComplete(false)
    } finally {
      setIsOpeningCamera(false)
    }
  }, [analyzeImageMetrics, sessionToken, user])

  useEffect(() => {
    if (!sessionToken) {
      return
    }

    images.forEach((image) => {
      if (image.analysisStatus !== 'idle') {
        return
      }

      const hasAnyMetric =
        image.weight_kg !== null ||
        image.body_fat_percentage !== null ||
        image.bmi !== null ||
        image.muscle_mass_kg !== null

      if (hasAnyMetric) {
        return
      }

      if (!image.file_path) {
        return
      }

      analyzeImageMetrics(image.id, sessionToken)
    })
  }, [analyzeImageMetrics, images, sessionToken])

  // Helper to check if all metrics are null
  const hasNoStats = useCallback(
    (imageId: string): boolean => {
      const image = imageStore[imageId]
      if (!image) return true

      return (
        image.weight_kg === null &&
        image.body_fat_percentage === null &&
        image.bmi === null &&
        image.muscle_mass_kg === null
      )
    },
    [imageStore],
  )

  // Watch for analysis completion and navigate to detail page
  useEffect(() => {
    if (!processingImageId || !isProcessing) {
      return
    }

    const processingImage = imageStore[processingImageId]
    if (!processingImage) {
      return
    }

    // When analysis is complete, show success animation then navigate
    if (processingImage.analysisStatus === 'success') {
      setIsAnalysisComplete(true)
    }
  }, [processingImageId, imageStore, isProcessing])

  // Handle navigation after success animation completes
  const handleProcessingComplete = useCallback(() => {
    if (!processingImageId) return

    const image = imageStore[processingImageId]
    if (!image) return

    // Reset modal state
    setIsProcessing(false)
    setProcessingImageUri(null)
    setProcessingImageId(null)
    setIsAnalysisComplete(false)

    // Navigate to detail page with all the metrics
    const params: { imageId: string; createdAt: string; [key: string]: string } =
      {
        imageId: image.id,
        createdAt: image.created_at,
      }

    if (image.file_path) {
      params.filePath = image.file_path
    }

    if (image.signedUrl) {
      params.signedUrl = image.signedUrl
    }

    // Add metrics if they exist
    if (image.weight_kg !== null) {
      params.weightKg = image.weight_kg.toString()
    }
    if (image.body_fat_percentage !== null) {
      params.bodyFatPercentage = image.body_fat_percentage.toString()
    }
    if (image.bmi !== null) {
      params.bmi = image.bmi.toString()
    }
    if (image.muscle_mass_kg !== null) {
      params.muscleMassKg = image.muscle_mass_kg.toString()
    }

    router.push({
      pathname: '/body-log/[imageId]',
      params,
    })
  }, [processingImageId, imageStore, router])

  const renderImage = useCallback(
    ({ item }: { item: BodyLogImageRecord }) => (
      <BodyLogImageItem
        image={item}
        onPress={handleImageOpen}
        onLoadStart={handleImageLoadStart}
        onLoadSuccess={handleImageLoadSuccess}
        onLoadError={handleImageLoadError}
      />
    ),
    [
      handleImageLoadError,
      handleImageLoadStart,
      handleImageLoadSuccess,
      handleImageOpen,
    ],
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
          accessibilityLabel="Go back to profile"
          accessibilityRole="button"
          accessibilityHint="Navigate back to the profile page"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Ionicons name="body" size={20} color={colors.text} />
        </View>
        <View style={styles.placeholder} />
      </View>

      {isInitialLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={images}
          renderItem={renderImage}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.cameraFabContainer}>
        <View
          style={[
            styles.cameraFabBackground,
            { backgroundColor: colors.background },
          ]}
        />
        <TouchableOpacity
          style={styles.cameraFab}
          onPress={handleCameraPress}
          disabled={isOpeningCamera}
          accessibilityLabel="Take photo"
          accessibilityRole="button"
          accessibilityHint="Open camera to take a body progress photo"
        >
          <Ionicons name="camera" size={28} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Processing Modal */}
      <BodyLogProcessingModal
        visible={isProcessing}
        imageUri={processingImageUri}
        isComplete={isAnalysisComplete}
        hasNoStats={processingImageId ? hasNoStats(processingImageId) : false}
        onComplete={handleProcessingComplete}
      />
    </SafeAreaView>
  )
}

const createImageItemStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    imageContainer: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      margin: IMAGE_SPACING / 2,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: colors.backgroundLight,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imageLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
    },
  })

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      width: 24,
      alignItems: 'center',
    },
    placeholder: {
      width: 24,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    gridContent: {
      padding: IMAGE_SPACING,
      paddingBottom: 120,
    },
    cameraFabContainer: {
      position: 'absolute',
      bottom: 32,
      alignSelf: 'center',
      justifyContent: 'center',
      alignItems: 'center',
    },
    cameraFabBackground: {
      position: 'absolute',
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    cameraFab: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
  })
