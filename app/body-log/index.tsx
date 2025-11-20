import { ScreenHeader } from '@/components/screen-header'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useUnit } from '@/contexts/unit-context'
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
import { useFocusEffect, useRouter } from 'expo-router'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
    const { formatWeight } = useUnit()
    const styles = useMemo(() => createImageItemStyles(colors), [colors])

    const hasImages = entry.images.length > 0
    const handlePress = useCallback(() => {
      // Allow opening all entries (including empty ones for editing)
      onPress(entry)
    }, [entry, onPress])

    const primaryImageUrl = entry.signedUrls[0]
    const imageCount = entry.images.length
    const hasWeight =
      entry.weight_kg !== null && entry.weight_kg !== undefined
    const formattedWeight = hasWeight ? formatWeight(entry.weight_kg) : null
    const isEmpty = !hasImages && !hasWeight
    const hasBodyScan = entry.body_fat_percentage !== null || entry.bmi !== null

    return (
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={handlePress}
        activeOpacity={0.9}
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
            {hasWeight && formattedWeight && (
              <View style={styles.weightOverlay}>
                <Text style={styles.weightOverlayLabel}>Weight</Text>
                <Text style={styles.weightOverlayValue}>{formattedWeight}</Text>
              </View>
            )}
            {hasBodyScan && (
              <View style={[styles.scanBadge, { backgroundColor: colors.success }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.white} />
                <Text style={styles.scanBadgeText}>Scanned</Text>
              </View>
            )}
          </>
        ) : hasImages ? (
          <View style={styles.imageLoadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : hasWeight && formattedWeight ? (
          <View style={styles.weightCard}>
            <Ionicons
              name="barbell-outline"
              size={20}
              color={colors.primary}
              style={styles.weightCardIcon}
            />
            <Text style={styles.weightCardLabel}>Weight logged</Text>
            <Text style={styles.weightCardValue}>{formattedWeight}</Text>
          </View>
        ) : isEmpty ? (
          <View style={styles.emptyEntryCard}>
            <Ionicons
              name="add-circle-outline"
              size={32}
              color={colors.textSecondary}
              style={styles.emptyEntryIcon}
            />
            <Text style={styles.emptyEntryLabel}>Empty Entry</Text>
            <Text style={styles.emptyEntryHint}>Tap to add data</Text>
          </View>
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
      prevProps.entry.imageLoadStatus === nextProps.entry.imageLoadStatus &&
      prevProps.entry.weight_kg === nextProps.entry.weight_kg &&
      prevProps.entry.body_fat_percentage === nextProps.entry.body_fat_percentage &&
      prevProps.entry.bmi === nextProps.entry.bmi
    )
  },
)

BodyLogEntryItem.displayName = 'BodyLogEntryItem'

export default function BodyLogScreen() {
  const colors = useThemedColors()
  const { user } = useAuth()
  const router = useRouter()
  const styles = createStyles(colors)
  const insets = useSafeAreaInsets()

  const [userGender, setUserGender] = useState<'male' | 'female' | null>(null)
  const [shouldExit, setShouldExit] = useState(false)

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

  // Load entries function that can be called on mount and on focus
  const loadEntries = useCallback(async () => {
    if (!user) {
      setEntryOrder([])
      setEntryStore({})
      setIsInitialLoading(false)
      setUserGender(null)
      return
    }

    setIsInitialLoading(true)

    try {
      // Fetch user profile for gender
      const { data: profile } = await supabase
        .from('profiles')
        .select('gender')
        .eq('id', user.id)
        .single()

      if (profile?.gender) {
        if (profile.gender === 'male' || profile.gender === 'female') {
          setUserGender(profile.gender)
        }
      }

      const entries = await database.bodyLog.getAllEntries(user.id)

      if (!entries || entries.length === 0) {
        setEntryOrder([])
        setEntryStore({})
        setIsInitialLoading(false)
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
      setIsInitialLoading(false)
    }
  }, [user])

  // Reload data when screen comes into focus (user navigates back)
  useFocusEffect(
    useCallback(() => {
      loadEntries()
    }, [loadEntries])
  )

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

  const handleBackPress = useCallback(() => {
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

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

  const handleAddNewEntry = useCallback(async () => {
    if (!user) {
      alert('You must be logged in to add entries')
      return
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Navigate to detail page with special "new" ID
    // Entry will be created when user adds data
    router.push({
      pathname: '/body-log/[entryId]',
      params: {
        entryId: 'new',
      },
    })
  }, [user, router])

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
    <SlideInView
      style={{ flex: 1, backgroundColor: colors.background }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Body log"
        onLeftPress={handleBackPress}
        leftIcon="arrow-back"
        rightIcon="add"
        onRightPress={handleAddNewEntry}
      />

      {isInitialLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.addNewEntryContainer}>
          </View>
          <View style={styles.emptyStateContent}>
            <Text style={styles.emptyStateDescription}>
              Track your fitness journey with weight and progress photos.
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
          ListHeaderComponent={
            <View style={styles.addNewEntryContainer} />
          }
        />
      )}

    </View>
    </SlideInView>
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
    weightOverlay: {
      position: 'absolute',
      left: 10,
      bottom: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
    },
    weightOverlayLabel: {
      fontSize: 10,
      color: 'rgba(255, 255, 255, 0.9)',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 2,
      fontWeight: '500',
    },
    weightOverlayValue: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    weightCard: {
      flex: 1,
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 16,
      gap: 6,
      backgroundColor: colors.backgroundLight,
      borderWidth: 1.5,
      borderColor: `${colors.primary}30`,
    },
    weightCardIcon: {
      marginBottom: 4,
    },
    weightCardLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.0,
      fontWeight: '600',
    },
    weightCardValue: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    scanBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 3,
    },
    scanBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.2,
      textTransform: 'uppercase',
    },
    emptyEntryCard: {
      flex: 1,
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 16,
      gap: 8,
      backgroundColor: colors.backgroundLight,
      borderWidth: 2,
      borderColor: colors.border,
    },
    emptyEntryIcon: {
      marginBottom: 4,
    },
    emptyEntryLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    emptyEntryHint: {
      fontSize: 11,
      color: colors.textSecondary,
      opacity: 0.7,
    },
  })

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyStateContainer: {
      flex: 1,
      paddingTop: 20,
      alignItems: 'flex-start',
    },
    emptyStateContent: {
      alignItems: 'center',
      maxWidth: 320,
      alignSelf: 'center',
      marginTop: 40,
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
    addNewEntryContainer: {
      paddingHorizontal: GRID_PADDING,
      paddingTop: 8,
      paddingBottom: 12,
    },
  })
