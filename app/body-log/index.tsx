import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { type BodyLogRecord } from '@/lib/body-log/metadata'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import {
    getBodyLogImageUrls,
} from '@/lib/utils/body-log-storage'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
    ActivityIndicator,
    Dimensions,
    Image,
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

const SCREEN_WIDTH = Dimensions.get('window').width
const IMAGE_SPACING = 4
const NUM_COLUMNS = 2
const GRID_PADDING = 16
const IMAGE_SIZE =
  (SCREEN_WIDTH - GRID_PADDING * 2 - IMAGE_SPACING) / NUM_COLUMNS

// Format date like Google Photos
function formatSectionDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const imageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (imageDate.getTime() === today.getTime()) {
    return 'Today'
  } else if (imageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  } else {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
    const month = monthNames[date.getMonth()]
    const day = date.getDate()
    const year = date.getFullYear()

    // Show year only if not current year
    if (year === now.getFullYear()) {
      return `${month} ${day}`
    } else {
      return `${month} ${day}, ${year}`
    }
  }
}

// Get date key for grouping (YYYY-MM-DD)
function getDateKey(dateString: string): string {
  const date = new Date(dateString)
  return date.toISOString().split('T')[0]
}

type BodyLogImageStatus = 'idle' | 'loading' | 'loaded' | 'error'

type AnalysisStatus = 'idle' | 'pending' | 'success' | 'error'

interface BodyLogImageRecord extends BodyLogRecord {
  signedUrl: string | null
  status: BodyLogImageStatus
  analysisStatus: AnalysisStatus
}

interface ImageSection {
  title: string
  dateKey: string
  data: BodyLogImageRecord[]
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

  const [userGender, setUserGender] = useState<'male' | 'female' | null>(null)

  // Snapchat-like slide animation
  const translateX = useSharedValue(SCREEN_WIDTH)

  useEffect(() => {
    // Slide in from right with smooth Snapchat-like animation
    translateX.value = withTiming(0, {
      duration: 300,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run on mount. translateX is a stable SharedValue

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    }
  })

  const [imageOrder, setImageOrder] = useState<string[]>([])
  const [imageStore, setImageStore] = useState<
    Record<string, BodyLogImageRecord>
  >({})
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  const sections = useMemo(() => {
    const images = imageOrder
      .map((id) => imageStore[id])
      .filter((image): image is BodyLogImageRecord => Boolean(image))

    // Group images by date
    const grouped = new Map<string, BodyLogImageRecord[]>()
    images.forEach((image) => {
      const dateKey = getDateKey(image.created_at)
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, [])
      }
      grouped.get(dateKey)!.push(image)
    })

    // Convert to sections array and sort by date (newest first)
    const sectionsArray: ImageSection[] = Array.from(grouped.entries())
      .map(([dateKey, data]) => ({
        title: formatSectionDate(data[0].created_at),
        dateKey,
        data,
      }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))

    return sectionsArray
  }, [imageOrder, imageStore])

  useEffect(() => {
    if (!user) {
      setImageOrder([])
      setImageStore({})
      setIsInitialLoading(false)
      setUserGender(null)
      return
    }

    let cancelled = false

    const loadImages = async () => {
      setIsInitialLoading(true)

      try {
        // Fetch user profile for gender
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
            signedUrl: signedUrls[index] ?? null,
            status: signedUrls[index] ? 'idle' : 'error',
            analysisStatus:
              img.body_fat_percentage !== null ||
              img.bmi !== null ||
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

  const navigateToProfile = () => {
    router.push('/(tabs)/explore')
  }

  const handleBackPress = useCallback(() => {
    // Slide out to right with reverse animation
    translateX.value = withTiming(
      SCREEN_WIDTH,
      {
        duration: 300,
      },
      (finished) => {
        if (finished) {
          // Navigate to profile page after animation completes
          runOnJS(navigateToProfile)()
        }
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - translateX and router are stable

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

    // Navigate to intro page with user gender
    router.push({
      pathname: '/body-log/intro',
      params: { userGender: userGender || '' },
    })
  }, [user, userGender, router])


  const renderSectionHeader = useCallback(
    ({ section }: { section: ImageSection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    ),
    [styles],
  )

  const renderSectionContent = useCallback(
    ({ section }: { section: ImageSection }) => (
      <View style={styles.sectionContent}>
        {section.data.map((item) => (
          <BodyLogImageItem
            key={item.id}
            image={item}
            onPress={handleImageOpen}
            onLoadStart={handleImageLoadStart}
            onLoadSuccess={handleImageLoadSuccess}
            onLoadError={handleImageLoadError}
          />
        ))}
      </View>
    ),
    [
      handleImageLoadError,
      handleImageLoadStart,
      handleImageLoadSuccess,
      handleImageOpen,
      styles,
    ],
  )

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
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
          <Text style={styles.headerTitleText}>Body log</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {isInitialLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={() => null}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={renderSectionContent}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={true}
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
          accessibilityLabel="Take photo"
          accessibilityRole="button"
          accessibilityHint="Open camera to take a body progress photo"
        >
          <Ionicons name="camera" size={28} color={colors.white} />
        </TouchableOpacity>
      </View>

    </SafeAreaView>
    </Animated.View>
  )
}

const createImageItemStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    imageContainer: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      margin: IMAGE_SPACING / 2,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.backgroundLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
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
      paddingVertical: 14,
      backgroundColor: colors.background,
      borderBottomWidth: 0,
      gap: 12,
    },
    headerTitle: {
      alignItems: 'center',
      flex: 1,
    },
    headerTitleText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
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
      paddingHorizontal: GRID_PADDING,
      paddingVertical: 8,
      paddingBottom: 120,
    },
    sectionContent: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginLeft: -IMAGE_SPACING / 2,
      marginRight: -IMAGE_SPACING / 2,
    },
    sectionHeader: {
      backgroundColor: colors.background,
      paddingTop: 20,
      paddingBottom: 12,
      paddingHorizontal: 0,
      borderBottomWidth: 0,
    },
    sectionHeaderText: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: 0.35,
    },
    cameraFabContainer: {
      position: 'absolute',
      bottom: 36,
      alignSelf: 'center',
      justifyContent: 'center',
      alignItems: 'center',
    },
    cameraFabBackground: {
      position: 'absolute',
      width: 76,
      height: 76,
      borderRadius: 38,
    },
    cameraFab: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 12,
    },
  })
