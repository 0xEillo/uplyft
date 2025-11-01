import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { type BodyLogEntryWithImages } from '@/lib/body-log/metadata'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import {
  getBodyLogImageUrls,
} from '@/lib/utils/body-log-storage'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
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

// Tutorial storage key (must match the one in profile page)
const HAS_VISITED_BODY_LOG_KEY = 'hasVisitedBodyLog'

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

type ImageLoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

interface EntryWithSignedUrls extends BodyLogEntryWithImages {
  signedUrls: (string | null)[]
  imageLoadStatus: ImageLoadStatus
}

interface EntrySection {
  title: string
  dateKey: string
  data: EntryWithSignedUrls[]
}

interface BodyLogEntryItemProps {
  entry: EntryWithSignedUrls
  onPress: (entry: EntryWithSignedUrls) => void
  onLoadStart: (entryId: string) => void
  onLoadSuccess: (entryId: string) => void
  onLoadError: (entryId: string) => void
}

const BodyLogEntryItem = memo(
  ({
    entry,
    onPress,
    onLoadStart,
    onLoadSuccess,
    onLoadError,
  }: BodyLogEntryItemProps) => {
    const colors = useThemedColors()
    const styles = useMemo(() => createImageItemStyles(colors), [colors])

    const handlePress = useCallback(() => {
      if (entry.signedUrls[0]) {
        onPress(entry)
      }
    }, [entry, onPress])

    const primaryImageUrl = entry.signedUrls[0]
    const imageCount = entry.images.length

    return (
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={handlePress}
        activeOpacity={primaryImageUrl ? 0.9 : 1}
        disabled={!primaryImageUrl}
      >
        {primaryImageUrl ? (
          <>
            <Image
              source={{ uri: primaryImageUrl }}
              style={styles.image}
              resizeMode="cover"
              onLoadStart={() => onLoadStart(entry.id)}
              onLoad={() => onLoadSuccess(entry.id)}
              onError={() => onLoadError(entry.id)}
            />
            {entry.imageLoadStatus !== 'loaded' && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
            {imageCount > 1 && (
              <View style={[styles.imageBadge, { backgroundColor: `${colors.primary}E6` }]}>
                <Text style={styles.imageBadgeText}>{imageCount}</Text>
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
      prevProps.entry.id === nextProps.entry.id &&
      prevProps.entry.signedUrls[0] === nextProps.entry.signedUrls[0] &&
      prevProps.entry.imageLoadStatus === nextProps.entry.imageLoadStatus
    )
  },
)

BodyLogEntryItem.displayName = 'BodyLogEntryItem'

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

  // Mark tutorial as completed when user visits body log for the first time
  useEffect(() => {
    const markTutorialCompleted = async () => {
      try {
        await AsyncStorage.setItem(HAS_VISITED_BODY_LOG_KEY, 'true')
      } catch (error) {
        console.error('Error marking tutorial as completed:', error)
      }
    }

    markTutorialCompleted()
  }, [])

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    }
  })

  const [entryOrder, setEntryOrder] = useState<string[]>([])
  const [entryStore, setEntryStore] = useState<
    Record<string, EntryWithSignedUrls>
  >({})
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  const sections = useMemo(() => {
    const entries = entryOrder
      .map((id) => entryStore[id])
      .filter((entry): entry is EntryWithSignedUrls => Boolean(entry))

    // Group entries by date
    const grouped = new Map<string, EntryWithSignedUrls[]>()
    entries.forEach((entry) => {
      const dateKey = getDateKey(entry.created_at)
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, [])
      }
      grouped.get(dateKey)!.push(entry)
    })

    // Convert to sections array and sort by date (newest first)
    const sectionsArray: EntrySection[] = Array.from(grouped.entries())
      .map(([dateKey, data]) => ({
        title: formatSectionDate(data[0].created_at),
        dateKey,
        data,
      }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))

    return sectionsArray
  }, [entryOrder, entryStore])

  useEffect(() => {
    if (!user) {
      setEntryOrder([])
      setEntryStore({})
      setIsInitialLoading(false)
      setUserGender(null)
      return
    }

    let cancelled = false

    const loadEntries = async () => {
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

        const entries = await database.bodyLog.getAllEntries(user.id)
        if (cancelled) return

        if (!entries || entries.length === 0) {
          setEntryOrder([])
          setEntryStore({})
          return
        }

        // Collect all image file paths from all entries
        const allFilePaths: string[] = []
        const filePathToEntryMap: Record<string, { entryId: string; imageIndex: number }> = {}

        entries.forEach((entry: any) => {
          const images = entry.images || []
          if (Array.isArray(images)) {
            images.forEach((image, imageIndex) => {
              allFilePaths.push(image.file_path)
              filePathToEntryMap[image.file_path] = { entryId: entry.id, imageIndex }
            })
          }
        })

        // Get all signed URLs in one call
        const signedUrls = allFilePaths.length > 0 ? await getBodyLogImageUrls(allFilePaths) : []
        if (cancelled) return

        // Build entries with signed URLs
        const entriesWithUrls: EntryWithSignedUrls[] = entries.map((entry: any) => {
          const images = entry.images || []
          return {
            ...entry,
            images: Array.isArray(images) ? images : [],
            signedUrls: Array.isArray(images)
              ? images.map((image) => {
                  const filePathIndex = allFilePaths.indexOf(image.file_path)
                  return filePathIndex >= 0 ? signedUrls[filePathIndex] ?? null : null
                })
              : [],
            imageLoadStatus: 'idle' as ImageLoadStatus,
          }
        })

        setEntryStore(() => {
          const next: Record<string, EntryWithSignedUrls> = {}
          entriesWithUrls.forEach((entry) => {
            next[entry.id] = entry
          })
          return next
        })
        setEntryOrder(entriesWithUrls.map((entry) => entry.id))
      } catch (error) {
        console.error('Error loading body log entries:', error)
      } finally {
        if (!cancelled) {
          setIsInitialLoading(false)
        }
      }
    }

    loadEntries()

    return () => {
      cancelled = true
    }
  }, [user])

  const markEntryImageStatus = useCallback(
    (entryId: string, status: ImageLoadStatus) => {
      setEntryStore((prev) => {
        const current = prev[entryId]
        if (!current || current.imageLoadStatus === status) {
          return prev
        }

        if (current.imageLoadStatus === 'loaded' && status === 'loading') {
          // Keep loaded thumbnails from regressing when FlatList re-renders.
          return prev
        }

        return {
          ...prev,
          [entryId]: {
            ...current,
            imageLoadStatus: status,
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

  const handleEntryOpen = useCallback(
    (entry: EntryWithSignedUrls) => {
      const params: { entryId: string; createdAt: string; [key: string]: string } = {
        entryId: entry.id,
        createdAt: entry.created_at,
      }

      // Add metrics if they exist
      if (entry.weight_kg !== null) {
        params.weightKg = entry.weight_kg.toString()
      }
      if (entry.body_fat_percentage !== null) {
        params.bodyFatPercentage = entry.body_fat_percentage.toString()
      }
      if (entry.bmi !== null) {
        params.bmi = entry.bmi.toString()
      }

      router.push({
        pathname: '/body-log/[entryId]',
        params,
      })
    },
    [router],
  )

  const handleImageLoadStart = useCallback(
    (entryId: string) => {
      markEntryImageStatus(entryId, 'loading')
    },
    [markEntryImageStatus],
  )

  const handleImageLoadSuccess = useCallback(
    (entryId: string) => {
      markEntryImageStatus(entryId, 'loaded')
    },
    [markEntryImageStatus],
  )

  const handleImageLoadError = useCallback(
    (entryId: string) => {
      markEntryImageStatus(entryId, 'error')
    },
    [markEntryImageStatus],
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
    ({ section }: { section: EntrySection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    ),
    [styles],
  )

  const renderSectionContent = useCallback(
    ({ section }: { section: EntrySection }) => (
      <View style={styles.sectionContent}>
        {section.data.map((item) => (
          <BodyLogEntryItem
            key={item.id}
            entry={item}
            onPress={handleEntryOpen}
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
      handleEntryOpen,
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
      ) : sections.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyStateContent}>
            <View style={styles.emptyStateIconContainer}>
              <Ionicons name="body-outline" size={80} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyStateTitle}>No progress photos yet</Text>
            <Text style={styles.emptyStateDescription}>
              Track your fitness journey with progress photos.
            </Text>
          </View>
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
      borderRadius: 2,
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
    imageBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      minWidth: 26,
      height: 26,
      paddingHorizontal: 8,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    imageBadgeText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: -0.1,
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
    emptyStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      paddingBottom: 100,
    },
    emptyStateContent: {
      alignItems: 'center',
      maxWidth: 320,
    },
    emptyStateIconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    emptyStateTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    emptyStateDescription: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      letterSpacing: -0.2,
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
