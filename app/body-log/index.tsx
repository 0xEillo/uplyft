import { BodyWeightChart } from '@/components/BodyLog/BodyWeightChart'
import { EmptyState } from '@/components/EmptyState'
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
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
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
const GRID_PADDING = 20
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
        style={styles.cardContainer}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Background Layer */}
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.backgroundImage}
            contentFit="cover"
            cachePolicy="disk"
            transition={200}
            recyclingKey={entry.id}
          />
        ) : (
          <View style={styles.placeholderBackground}>
            {isEmpty ? (
              <Ionicons name="add" size={32} color={colors.primary} />
            ) : (
              <Ionicons
                name="scale-outline"
                size={32}
                color={colors.textTertiary}
                style={{ opacity: 0.5 }}
              />
            )}
          </View>
        )}

        {/* Gradient Overlay for Images */}
        {thumbnailUrl && (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.gradientOverlay}
            locations={[0.6, 1]}
          />
        )}

        {/* Content Overlay */}
        <View style={styles.contentOverlay}>
          {/* Top Row: Badges */}
          <View style={styles.topRow}>
            {hasBodyScan && (
              <View style={thumbnailUrl ? styles.badge : styles.standardBadge}>
                <Ionicons
                  name="scan-outline"
                  size={10}
                  color={thumbnailUrl ? colors.white : colors.text}
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={
                    thumbnailUrl ? styles.badgeText : styles.standardBadgeText
                  }
                >
                  SCAN
                </Text>
              </View>
            )}

            {imageCount > 1 && (
              <View
                style={[
                  thumbnailUrl ? styles.badge : styles.standardBadge,
                  styles.imageCountBadge,
                ]}
              >
                <Ionicons
                  name="images"
                  size={10}
                  color={thumbnailUrl ? colors.white : colors.text}
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={
                    thumbnailUrl ? styles.badgeText : styles.standardBadgeText
                  }
                >
                  {imageCount}
                </Text>
              </View>
            )}
          </View>

          {/* Bottom Row: Weight */}
          <View style={styles.bottomRow}>
            {hasWeight && formattedWeight && (
              <Text
                style={[
                  styles.weightText,
                  !thumbnailUrl && { color: colors.text },
                ]}
              >
                {formattedWeight}
              </Text>
            )}
          </View>
        </View>

        {/* Loading State */}
        {hasImages && !thumbnailUrl && (
          <View style={styles.loadingOverlay}>
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
          title="Body Log"
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
          <EmptyState
            icon="images-outline"
            title="Your body log is empty"
            description="Track your physical transformation with photos and measurements."
            buttonText="Add Your First Entry"
            onPress={handleAddNewEntry}
          />
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
            ListHeaderComponent={
              user ? (
                <View>
                  <BodyWeightChart userId={user.id} />
                </View>
              ) : null
            }
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
    cardContainer: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.backgroundLight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backgroundImage: {
      width: '100%',
      height: '100%',
    },
    placeholderBackground: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
    },
    gradientOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1,
    },
    contentOverlay: {
      ...StyleSheet.absoluteFillObject,
      padding: 8,
      justifyContent: 'space-between',
      zIndex: 2,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    bottomRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
      backdropFilter: 'blur(4px)',
    },
    standardBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    imageCountBadge: {
      marginLeft: 'auto',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    standardBadgeText: {
      color: colors.text,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    weightText: {
      fontSize: 20,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.5,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
      zIndex: 3,
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
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 100,
    },
    emptyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    emptyButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    gridContent: {
      paddingHorizontal: GRID_PADDING,
      paddingVertical: 8,
      paddingBottom: 120,
    },
  })
