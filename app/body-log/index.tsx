import { ScreenHeader } from '@/components/screen-header'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useUnit } from '@/contexts/unit-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { type BodyLogEntryWithImages } from '@/lib/body-log/metadata'
import { database } from '@/lib/database'
import { getThumbnailUrlsWithPrefetch } from '@/lib/utils/body-log-storage'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { useFocusEffect, useRouter } from 'expo-router'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
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
  (SCREEN_WIDTH - GRID_PADDING * 2 - IMAGE_SPACING * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS

const PAGE_SIZE = 40

// Tutorial storage key (must match the one in profile page)
const HAS_VISITED_BODY_LOG_KEY = 'hasVisitedBodyLog'

// Format date like Google Photos
function formatSectionDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const imageDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  )

  if (imageDate.getTime() === today.getTime()) {
    return 'Today'
  } else if (imageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  } else {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]
    const month = monthNames[date.getMonth()]
    const day = date.getDate()
    const year = date.getFullYear()

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

interface EntryWithSignedUrl extends BodyLogEntryWithImages {
  thumbnailUrl: string | null
}

interface Section {
  title: string
  dateKey: string
  entries: EntryWithSignedUrl[]
}

interface BodyLogEntryItemProps {
  entry: EntryWithSignedUrl
  onPress: (entry: EntryWithSignedUrl) => void
}

const BodyLogEntryItem = memo(
  ({ entry, onPress }: BodyLogEntryItemProps) => {
    const colors = useThemedColors()
    const { formatWeight } = useUnit()
    const styles = useMemo(() => createImageItemStyles(colors), [colors])

    const hasImages = entry.images.length > 0
    const handlePress = useCallback(() => {
      onPress(entry)
    }, [entry, onPress])

    const thumbnailUrl = entry.thumbnailUrl
    const imageCount = entry.images.length
    const hasWeight = entry.weight_kg !== null && entry.weight_kg !== undefined
    const formattedWeight = hasWeight ? formatWeight(entry.weight_kg) : null
    const isEmpty = !hasImages && !hasWeight
    const hasBodyScan =
      entry.body_fat_percentage !== null || entry.bmi !== null

    return (
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {thumbnailUrl ? (
          <>
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="disk"
              transition={200}
              recyclingKey={entry.id}
            />
            <View style={styles.overlaysContainer}>
              <View style={styles.topBadgesRow}>
                {hasBodyScan && (
                  <View style={styles.scanBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={colors.white}
                    />
                    <Text style={styles.scanBadgeText}>Scanned</Text>
                  </View>
                )}
                {imageCount > 1 && (
                  <View style={[styles.imageBadge, { marginLeft: 'auto' }]}>
                    <Ionicons
                      name="images"
                      size={12}
                      color={colors.white}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.imageBadgeText}>{imageCount}</Text>
                  </View>
                )}
              </View>

              {hasWeight && formattedWeight && (
                <View style={styles.weightPill}>
                  <Text style={styles.weightPillValue}>{formattedWeight}</Text>
                </View>
              )}
            </View>
          </>
        ) : hasImages ? (
          <View style={styles.imageLoadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : hasWeight && formattedWeight ? (
          <View style={styles.weightCard}>
            <Text style={styles.weightCardValue}>{formattedWeight}</Text>
            <Text style={styles.weightCardLabel}>Weight</Text>
          </View>
        ) : isEmpty ? (
          <View style={styles.emptyEntryCard}>
            <Ionicons name="add" size={28} color={colors.primary} />
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
      prevProps.entry.thumbnailUrl === nextProps.entry.thumbnailUrl &&
      prevProps.entry.weight_kg === nextProps.entry.weight_kg &&
      prevProps.entry.body_fat_percentage ===
        nextProps.entry.body_fat_percentage &&
      prevProps.entry.bmi === nextProps.entry.bmi
    )
  },
)

BodyLogEntryItem.displayName = 'BodyLogEntryItem'

interface SectionItemProps {
  section: Section
  onEntryPress: (entry: EntryWithSignedUrl) => void
}

const SectionItem = memo(
  ({ section, onEntryPress }: SectionItemProps) => {
    const colors = useThemedColors()

    return (
      <View>
        <View
          style={[sectionStyles.header, { backgroundColor: colors.background }]}
        >
          <Text style={[sectionStyles.headerText, { color: colors.text }]}>
            {section.title}
          </Text>
        </View>
        <View style={sectionStyles.grid}>
          {section.entries.map((entry) => (
            <BodyLogEntryItem
              key={entry.id}
              entry={entry}
              onPress={onEntryPress}
            />
          ))}
        </View>
      </View>
    )
  },
  (prevProps, nextProps) => {
    if (prevProps.section.dateKey !== nextProps.section.dateKey) return false
    if (prevProps.section.entries.length !== nextProps.section.entries.length)
      return false
    // Compare entry IDs and thumbnail URLs
    for (let i = 0; i < prevProps.section.entries.length; i++) {
      const prev = prevProps.section.entries[i]
      const next = nextProps.section.entries[i]
      if (
        prev.id !== next.id ||
        prev.thumbnailUrl !== next.thumbnailUrl ||
        prev.weight_kg !== next.weight_kg
      ) {
        return false
      }
    }
    return true
  },
)

SectionItem.displayName = 'SectionItem'

const sectionStyles = StyleSheet.create({
  header: {
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IMAGE_SPACING,
  },
})

export default function BodyLogScreen() {
  const colors = useThemedColors()
  const { user } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [shouldExit, setShouldExit] = useState(false)
  const [entries, setEntries] = useState<EntryWithSignedUrl[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)

  // Build sections from entries
  const sections = useMemo(() => {
    const grouped = new Map<string, EntryWithSignedUrl[]>()

    entries.forEach((entry) => {
      const dateKey = getDateKey(entry.created_at)
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, [])
      }
      grouped.get(dateKey)!.push(entry)
    })

    const result: Section[] = Array.from(grouped.entries())
      .map(([dateKey, sectionEntries]) => ({
        dateKey,
        title: formatSectionDate(sectionEntries[0].created_at),
        entries: sectionEntries,
      }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))

    return result
  }, [entries])

  // Fetch signed URLs for entries
  const fetchThumbnailUrls = useCallback(
    async (
      rawEntries: BodyLogEntryWithImages[],
    ): Promise<EntryWithSignedUrl[]> => {
      // Collect all first-image file paths
      const pathIndexMap = new Map<string, number>()
      const paths: string[] = []

      rawEntries.forEach((entry, index) => {
        if (entry.images.length > 0) {
          const path = entry.images[0].file_path
          if (!pathIndexMap.has(path)) {
            pathIndexMap.set(path, paths.length)
            paths.push(path)
          }
        }
      })

      // Get thumbnail URLs with prefetch
      let urls: string[] = []
      if (paths.length > 0) {
        urls = await getThumbnailUrlsWithPrefetch(paths)
      }

      // Map URLs back to entries
      return rawEntries.map((entry) => {
        if (entry.images.length > 0) {
          const path = entry.images[0].file_path
          const pathIndex = pathIndexMap.get(path)
          return {
            ...entry,
            thumbnailUrl: pathIndex !== undefined ? urls[pathIndex] : null,
          }
        }
        return { ...entry, thumbnailUrl: null }
      })
    },
    [],
  )

  // Load initial entries
  const loadEntries = useCallback(
    async (refresh = false) => {
      if (!user) {
        setEntries([])
        setIsInitialLoading(false)
        return
      }

      if (refresh) {
        setIsRefreshing(true)
        pageRef.current = 0
      } else {
        setIsInitialLoading(true)
      }

      try {
        // Mark tutorial as completed
        await AsyncStorage.setItem(HAS_VISITED_BODY_LOG_KEY, 'true')

        const { entries: rawEntries, hasMore: more } =
          await database.bodyLog.getEntriesPage(user.id, 0, PAGE_SIZE)

        if (!rawEntries || rawEntries.length === 0) {
          setEntries([])
          setHasMore(false)
          return
        }

        const entriesWithUrls = await fetchThumbnailUrls(rawEntries)
        setEntries(entriesWithUrls)
        setHasMore(more)
        pageRef.current = 1
      } catch (error) {
        console.error('Error loading body log entries:', error)
      } finally {
        setIsInitialLoading(false)
        setIsRefreshing(false)
      }
    },
    [user, fetchThumbnailUrls],
  )

  // Load more entries (pagination)
  const loadMoreEntries = useCallback(async () => {
    if (!user || isLoadingMore || !hasMore) return

    setIsLoadingMore(true)
    try {
      const { entries: rawEntries, hasMore: more } =
        await database.bodyLog.getEntriesPage(
          user.id,
          pageRef.current,
          PAGE_SIZE,
        )

      if (rawEntries.length > 0) {
        const entriesWithUrls = await fetchThumbnailUrls(rawEntries)
        setEntries((prev) => [...prev, ...entriesWithUrls])
        pageRef.current += 1
      }
      setHasMore(more)
    } catch (error) {
      console.error('Error loading more entries:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [user, isLoadingMore, hasMore, fetchThumbnailUrls])

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadEntries(true)
    }, [loadEntries]),
  )

  const handleBackPress = useCallback(() => {
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const handleEntryOpen = useCallback(
    (entry: EntryWithSignedUrl) => {
      const params: {
        entryId: string
        createdAt: string
        [key: string]: string
      } = {
        entryId: entry.id,
        createdAt: entry.created_at,
      }

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

  const handleAddNewEntry = useCallback(async () => {
    if (!user) {
      alert('You must be logged in to add entries')
      return
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    router.push({
      pathname: '/body-log/[entryId]',
      params: {
        entryId: 'new',
      },
    })
  }, [user, router])

  const handleRefresh = useCallback(() => {
    loadEntries(true)
  }, [loadEntries])

  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadMoreEntries()
    }
  }, [isLoadingMore, hasMore, loadMoreEntries])

  const renderSection = useCallback(
    ({ item }: { item: Section }) => (
      <SectionItem section={item} onEntryPress={handleEntryOpen} />
    ),
    [handleEntryOpen],
  )

  const keyExtractor = useCallback((item: Section) => item.dateKey, [])

  const ListFooterComponent = useCallback(() => {
    if (!isLoadingMore) return null
    return (
      <View style={footerStyles.loader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }, [isLoadingMore, colors.primary])

  const dynamicStyles = useMemo(() => createStyles(colors), [colors])

  return (
    <SlideInView
      style={{ flex: 1, backgroundColor: colors.background }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[dynamicStyles.container, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="Body log"
          onLeftPress={handleBackPress}
          leftIcon="arrow-back"
          rightIcon="add"
          onRightPress={handleAddNewEntry}
        />

        {isInitialLoading ? (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : entries.length === 0 ? (
          <View style={dynamicStyles.emptyStateContainer}>
            <View style={dynamicStyles.emptyStateContent}>
              <Text style={dynamicStyles.emptyStateDescription}>
                Track your fitness journey with weight and progress photos.
              </Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={sections}
            renderItem={renderSection}
            keyExtractor={keyExtractor}
            contentContainerStyle={dynamicStyles.gridContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={5}
            windowSize={5}
            initialNumToRender={3}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={ListFooterComponent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          />
        )}
      </View>
    </SlideInView>
  )
}

const footerStyles = StyleSheet.create({
  loader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
})

const createImageItemStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    imageContainer: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: 2,
      overflow: 'hidden',
      backgroundColor: colors.backgroundLight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
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
    overlaysContainer: {
      ...StyleSheet.absoluteFillObject,
      padding: 8,
      justifyContent: 'space-between',
    },
    topBadgesRow: {
      flexDirection: 'row',
      width: '100%',
    },
    imageBadge: {
      flexDirection: 'row',
      height: 22,
      paddingHorizontal: 8,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageBadgeText: {
      color: colors.white,
      fontSize: 11,
      fontWeight: '600',
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    weightPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
    },
    weightPillValue: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    weightCard: {
      flex: 1,
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
      padding: 12,
    },
    weightCardLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.0,
      fontWeight: '600',
      marginTop: 4,
    },
    weightCardValue: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    scanBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
      height: 22,
    },
    scanBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    emptyEntryCard: {
      flex: 1,
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
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
  })
