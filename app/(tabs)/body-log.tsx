import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
  getPlaceholderBodyLogAnalysis,
  type BodyLogAnalysisSnapshot,
} from '@/lib/body-log/metadata'
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

const SCREEN_WIDTH = Dimensions.get('window').width
const IMAGE_SPACING = 4
const NUM_COLUMNS = 2
const IMAGE_SIZE =
  (SCREEN_WIDTH - IMAGE_SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS

type BodyLogImageStatus = 'idle' | 'loading' | 'loaded' | 'error'

interface BodyLogImageRecord {
  id: string
  filePath: string
  signedUrl: string | null
  status: BodyLogImageStatus
  analysis: BodyLogAnalysisSnapshot
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
            {image.status !== 'loaded' && (
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
      prevProps.image.analysis.date === nextProps.image.analysis.date &&
      prevProps.image.analysis.weight === nextProps.image.analysis.weight &&
      prevProps.image.analysis.bodyfat === nextProps.image.analysis.bodyfat &&
      prevProps.image.analysis.bmi === nextProps.image.analysis.bmi
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

  const images = useMemo(() => {
    return imageOrder
      .map((id) => imageStore[id])
      .filter((image): image is BodyLogImageRecord => Boolean(image))
  }, [imageOrder, imageStore])

  const syncImages = useCallback((records: BodyLogImageRecord[]) => {
    setImageStore((prev) => {
      const next = { ...prev }
      records.forEach((record) => {
        next[record.id] = record
      })
      return next
    })
    setImageOrder((prev) => {
      const existing = new Set(prev)
      const incomingIds = records.map((record) => record.id)
      const filtered = prev.filter((id) => !incomingIds.includes(id))
      return [...incomingIds, ...filtered]
    })
  }, [])

  useEffect(() => {
    if (!user) {
      setImageOrder([])
      setImageStore({})
      setIsInitialLoading(false)
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
            filePath: img.file_path,
            signedUrl: signedUrls[index] ?? null,
            status: signedUrls[index] ? 'idle' : 'error',
            analysis: getPlaceholderBodyLogAnalysis(),
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

    loadImages()

    return () => {
      cancelled = true
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
      const params: Record<string, string> = {
        imageId: image.id,
        analysisDate: image.analysis.date,
        analysisWeight: image.analysis.weight,
        analysisBodyfat: image.analysis.bodyfat,
        analysisBmi: image.analysis.bmi,
      }

      if (image.filePath) {
        params.filePath = image.filePath
      }

      if (image.signedUrl) {
        params.signedUrl = image.signedUrl
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
        filePath: '',
        signedUrl: null,
        status: 'loading',
        analysis: getPlaceholderBodyLogAnalysis(),
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

      addPlaceholder()

      try {
        const localUri = result.assets[0].uri
        const filePath = await uploadBodyLogImage(localUri, user.id)
        const newImage = await database.bodyLog.create(user.id, filePath)
        const signedUrl = await getBodyLogImageUrl(filePath)

        setImageStore((prev) => {
          const next = { ...prev }
          delete next[placeholderId]

          next[newImage.id] = {
            id: newImage.id,
            filePath,
            signedUrl,
            status: 'idle',
            analysis: getPlaceholderBodyLogAnalysis(),
          }

          return next
        })

        setImageOrder((prev) => {
          const withoutPlaceholder = prev.filter((id) => id !== placeholderId)
          return [newImage.id, ...withoutPlaceholder]
        })
      } catch (uploadError) {
        console.error('Error uploading photo:', uploadError)
        alert('Failed to save photo. Please try again.')
        removePlaceholder()
      }
    } catch (error) {
      console.error('Error opening camera:', error)
      alert('Failed to save photo. Please try again.')
      removePlaceholder()
    } finally {
      setIsOpeningCamera(false)
    }
  }, [user])

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
