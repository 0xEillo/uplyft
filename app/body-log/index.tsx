import { BodyWeightChart } from '@/components/BodyLog/BodyWeightChart'
import { EmptyState } from '@/components/EmptyState'
import { ScreenHeader } from '@/components/screen-header'
import { SlideInView } from '@/components/slide-in-view'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useUnit } from '@/contexts/unit-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { type BodyLogEntryWithImages } from '@/lib/body-log/metadata'
import { database } from '@/lib/database'
import { haptic } from '@/lib/haptics'
import { getThumbnailUrlsWithPrefetch } from '@/lib/utils/body-log-storage'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Image } from 'expo-image'
import { useFocusEffect, useRouter } from 'expo-router'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const THUMB_SIZE = 72
const PAGE_SIZE = 40
const HAS_VISITED_BODY_LOG_KEY = 'hasVisitedBodyLog'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (entryDate.getTime() === today.getTime()) return 'Today'
  if (entryDate.getTime() === yesterday.getTime()) return 'Yesterday'
  
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

interface EntryWithSignedUrl extends BodyLogEntryWithImages {
  thumbnailUrl: string | null
}

interface RowProps {
  entry: EntryWithSignedUrl
  onPress: (entry: EntryWithSignedUrl) => void
}

const EntryRow = memo(
  ({ entry, onPress }: RowProps) => {
    const colors = useThemedColors()
    const { formatWeight } = useUnit()
    const styles = useMemo(() => createRowStyles(colors), [colors])

    const hasImage = entry.images.length > 0 && entry.thumbnailUrl
    const hasWeight = entry.weight_kg !== null
    const imageCount = entry.images.length

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => onPress(entry)}
        activeOpacity={0.7}
      >
        {/* Thumbnail */}
        <View style={styles.thumbContainer}>
          {hasImage ? (
            <Image
              source={{ uri: entry.thumbnailUrl! }}
              style={styles.thumb}
              contentFit="cover"
              cachePolicy="disk"
              transition={150}
              recyclingKey={entry.id}
            />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Ionicons
                name={hasWeight ? 'scale-outline' : 'camera-outline'}
                size={24}
                color={colors.textTertiary}
              />
            </View>
          )}
          {imageCount > 1 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{imageCount}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.date}>{formatDate(entry.created_at)}</Text>
          {hasWeight && (
            <Text style={styles.weight}>{formatWeight(entry.weight_kg)}</Text>
          )}
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    )
  },
  (prev, next) =>
    prev.entry.id === next.entry.id &&
    prev.entry.thumbnailUrl === next.entry.thumbnailUrl &&
    prev.entry.weight_kg === next.entry.weight_kg,
)

EntryRow.displayName = 'EntryRow'

export default function BodyLogScreen() {
  const colors = useThemedColors()
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [shouldExit, setShouldExit] = useState(false)
  const [entries, setEntries] = useState<EntryWithSignedUrl[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)

  const fetchThumbnailUrls = useCallback(
    async (rawEntries: BodyLogEntryWithImages[]): Promise<EntryWithSignedUrl[]> => {
      const pathMap = new Map<string, number>()
      const paths: string[] = []

      rawEntries.forEach((entry) => {
        if (entry.images.length > 0) {
          const path = entry.images[0].file_path
          if (!pathMap.has(path)) {
            pathMap.set(path, paths.length)
            paths.push(path)
          }
        }
      })

      const urls = paths.length > 0 ? await getThumbnailUrlsWithPrefetch(paths) : []

      return rawEntries.map((entry) => {
        if (entry.images.length > 0) {
          const idx = pathMap.get(entry.images[0].file_path)
          return { ...entry, thumbnailUrl: idx !== undefined ? urls[idx] : null }
        }
        return { ...entry, thumbnailUrl: null }
      })
    },
    [],
  )

  const loadEntries = useCallback(
    async (refresh = false) => {
      if (!user) {
        setEntries([])
        setIsInitialLoading(false)
        return
      }

      refresh ? setIsRefreshing(true) : setIsInitialLoading(true)
      pageRef.current = 0

      try {
        await AsyncStorage.setItem(HAS_VISITED_BODY_LOG_KEY, 'true')
        const { entries: raw, hasMore: more } = await database.bodyLog.getEntriesPage(user.id, 0, PAGE_SIZE)

        if (!raw?.length) {
          setEntries([])
          setHasMore(false)
          return
        }

        setEntries(await fetchThumbnailUrls(raw))
        setHasMore(more)
        pageRef.current = 1
      } catch (e) {
        console.error('Error loading entries:', e)
      } finally {
        setIsInitialLoading(false)
        setIsRefreshing(false)
      }
    },
    [user, fetchThumbnailUrls],
  )

  const loadMore = useCallback(async () => {
    if (!user || isLoadingMore || !hasMore) return
    setIsLoadingMore(true)

    try {
      const { entries: raw, hasMore: more } = await database.bodyLog.getEntriesPage(
        user.id,
        pageRef.current,
        PAGE_SIZE,
      )
      if (raw.length) {
        const enriched = await fetchThumbnailUrls(raw)
        setEntries((prev) => [...prev, ...enriched])
        pageRef.current += 1
      }
      setHasMore(more)
    } catch (e) {
      console.error('Error loading more:', e)
    } finally {
      setIsLoadingMore(false)
    }
  }, [user, isLoadingMore, hasMore, fetchThumbnailUrls])

  useFocusEffect(useCallback(() => { loadEntries(true) }, [loadEntries]))

  const handleEntryOpen = useCallback(
    (entry: EntryWithSignedUrl) => {
      trackEvent(AnalyticsEvents.BODY_LOG_ENTRY_VIEWED, {
        entry_id: entry.id,
        has_images: entry.images.length > 0,
        has_weight: entry.weight_kg !== null,
      })

      const params: { entryId: string; [key: string]: string } = {
        entryId: entry.id,
        createdAt: entry.created_at,
      }
      if (entry.weight_kg !== null) params.weightKg = entry.weight_kg.toString()
      if (entry.body_fat_percentage !== null) params.bodyFatPercentage = entry.body_fat_percentage.toString()
      if (entry.bmi !== null) params.bmi = entry.bmi.toString()

      router.push({ pathname: '/body-log/[entryId]', params })
    },
    [router, trackEvent],
  )

  const handleAdd = useCallback(() => {
    if (!user) return alert('You must be logged in')
    trackEvent(AnalyticsEvents.BODY_LOG_ENTRY_STARTED)
    haptic('medium')
    router.push({ pathname: '/body-log/[entryId]', params: { entryId: 'new' } })
  }, [user, router, trackEvent])

  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <SlideInView
      style={{ flex: 1, backgroundColor: colors.background }}
      shouldExit={shouldExit}
      onExitComplete={() => router.back()}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="Body Log"
          onLeftPress={() => setShouldExit(true)}
          leftIcon="arrow-back"
          rightIcon="add"
          onRightPress={handleAdd}
        />

        {isInitialLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : entries.length === 0 ? (
          <EmptyState
            icon="images-outline"
            title="Your body log is empty"
            description="Track your transformation with photos and measurements."
            buttonText="Add First Entry"
            onPress={handleAdd}
          />
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <EntryRow entry={item} onPress={handleEntryOpen} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={10}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={user ? <BodyWeightChart userId={user.id} /> : null}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => loadEntries(true)}
                tintColor={colors.primary}
              />
            }
          />
        )}
      </View>
    </SlideInView>
  )
}

const createRowStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      gap: 14,
    },
    thumbContainer: {
      position: 'relative',
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 12,
      backgroundColor: colors.backgroundLight,
    },
    thumbPlaceholder: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 12,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    countBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      minWidth: 20,
      alignItems: 'center',
    },
    countText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '600',
    },
    info: {
      flex: 1,
    },
    date: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    weight: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  })

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    list: {
      paddingBottom: 100,
    },
  })
