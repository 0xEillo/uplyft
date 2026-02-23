import { BlurredHeader } from '@/components/blurred-header'
import { EmptyState } from '@/components/EmptyState'
import { ScreenHeader } from '@/components/screen-header'
import { SlideInView } from '@/components/slide-in-view'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useUnit } from '@/contexts/unit-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { formatBodyFat, type BodyLogEntryWithImages } from '@/lib/body-log/metadata'
import { database } from '@/lib/database'
import { haptic } from '@/lib/haptics'
import { getThumbnailUrlsWithPrefetch } from '@/lib/utils/body-log-storage'
import type { DailyLogEntry, DailyLogSummary } from '@/types/database.types'
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
const HEADER_ROW_HEIGHT = 52
const LIST_TOP_GAP = 12

function getLocalDateKey(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateKeyToMiddayIso(logDate: string): string {
  const [year, month, day] = logDate.split('-').map((value) => parseInt(value, 10))
  const date = new Date(year, Math.max(month - 1, 0), day, 12, 0, 0)
  return date.toISOString()
}

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
  logDate: string
  dailySummary: DailyLogSummary | null
  isNutritionOnly: boolean
}

type BodyEntryWithThumbnail = BodyLogEntryWithImages & {
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
    const nutritionTotals = entry.dailySummary?.totals
    const hasNutrition = (nutritionTotals?.meal_count ?? 0) > 0

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
                name={
                  hasWeight
                    ? 'scale-outline'
                    : hasNutrition
                    ? 'restaurant-outline'
                    : 'camera-outline'
                }
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
          <Text style={styles.primaryText}>
            {[
              hasWeight && formatWeight(entry.weight_kg),
              entry.body_fat_percentage !== null && formatBodyFat(entry.body_fat_percentage),
              hasNutrition && `${Math.round(nutritionTotals?.calories ?? 0)} cal`
            ].filter(Boolean).join('  •  ') || (entry.images.length > 0 ? 'Progress Photo' : 'Daily Log')}
          </Text>
          <Text style={styles.secondaryText}>{formatDate(entry.created_at)}</Text>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    )
  },
  (prev, next) =>
    prev.entry.id === next.entry.id &&
    prev.entry.thumbnailUrl === next.entry.thumbnailUrl &&
    prev.entry.weight_kg === next.entry.weight_kg &&
    prev.entry.body_fat_percentage === next.entry.body_fat_percentage &&
    prev.entry.dailySummary?.totals.calories ===
      next.entry.dailySummary?.totals.calories,
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
  const bodyPageRef = useRef(0)
  const dailyPageRef = useRef(0)

  const fetchThumbnailUrls = useCallback(
    async (
      rawEntries: BodyLogEntryWithImages[],
    ): Promise<BodyEntryWithThumbnail[]> => {
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

  const buildMergedEntries = useCallback(
    async (
      rawBodyEntries: BodyLogEntryWithImages[],
      rawDailyEntries: DailyLogEntry[],
    ): Promise<EntryWithSignedUrl[]> => {
      const bodyWithThumbnails = await fetchThumbnailUrls(rawBodyEntries)
      const bodyDateKeys = new Set(
        bodyWithThumbnails.map((entry) => getLocalDateKey(entry.created_at)),
      )

      const allDateKeys = Array.from(
        new Set([
          ...bodyWithThumbnails.map((entry) => getLocalDateKey(entry.created_at)),
          ...rawDailyEntries.map((entry) => entry.log_date),
        ]),
      )

      const summaryByDate =
        user && allDateKeys.length > 0
          ? await database.dailyLog.getSummariesForDates(user.id, allDateKeys)
          : {}

      const bodyRows: EntryWithSignedUrl[] = bodyWithThumbnails.map((entry) => {
        const logDate = getLocalDateKey(entry.created_at)
        return {
          ...entry,
          logDate,
          dailySummary: summaryByDate[logDate] ?? null,
          isNutritionOnly: false,
        }
      })

      const nutritionOnlyRows: EntryWithSignedUrl[] = rawDailyEntries
        .filter((dailyEntry) => !bodyDateKeys.has(dailyEntry.log_date))
        .map((dailyEntry) => ({
          id: `nutrition-${dailyEntry.log_date}`,
          user_id: dailyEntry.user_id,
          created_at: dateKeyToMiddayIso(dailyEntry.log_date),
          weight_kg: dailyEntry.weight_kg ?? null,
          body_fat_percentage: null,
          bmi: null,
          muscle_mass_kg: null,
          analysis_summary: null,
          images: [],
          thumbnailUrl: null,
          logDate: dailyEntry.log_date,
          dailySummary: summaryByDate[dailyEntry.log_date] ?? null,
          isNutritionOnly: true,
        }))

      return [...bodyRows, ...nutritionOnlyRows].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    },
    [fetchThumbnailUrls, user],
  )

  const loadEntries = useCallback(
    async (refresh = false) => {
      if (!user) {
        setEntries([])
        setIsInitialLoading(false)
        return
      }

      if (refresh) {
        setIsRefreshing(true)
      } else {
        setIsInitialLoading(true)
      }
      bodyPageRef.current = 0
      dailyPageRef.current = 0

      try {
        await AsyncStorage.setItem(HAS_VISITED_BODY_LOG_KEY, 'true')
        const [bodyPage, dailyPage] = await Promise.all([
          database.bodyLog.getEntriesPage(user.id, 0, PAGE_SIZE),
          database.dailyLog.getEntriesPage(user.id, 0, PAGE_SIZE),
        ])
        const mergedEntries = await buildMergedEntries(
          bodyPage.entries,
          dailyPage.entries,
        )

        if (!mergedEntries.length) {
          setEntries([])
          setHasMore(false)
          return
        }

        setEntries(mergedEntries)
        setHasMore(bodyPage.hasMore || dailyPage.hasMore)
        bodyPageRef.current = 1
        dailyPageRef.current = 1
      } catch (e) {
        console.error('Error loading entries:', e)
      } finally {
        setIsInitialLoading(false)
        setIsRefreshing(false)
      }
    },
    [user, buildMergedEntries],
  )

  const loadMore = useCallback(async () => {
    if (!user || isLoadingMore || !hasMore) return
    setIsLoadingMore(true)

    try {
      const [bodyPage, dailyPage] = await Promise.all([
        database.bodyLog.getEntriesPage(user.id, bodyPageRef.current, PAGE_SIZE),
        database.dailyLog.getEntriesPage(user.id, dailyPageRef.current, PAGE_SIZE),
      ])

      const newRows = await buildMergedEntries(bodyPage.entries, dailyPage.entries)

      setEntries((prev) => {
        const map = new Map(prev.map((entry) => [entry.id, entry]))
        newRows.forEach((entry) => {
          map.set(entry.id, entry)
        })

        return Array.from(map.values()).sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
      })

      bodyPageRef.current += 1
      dailyPageRef.current += 1
      setHasMore(bodyPage.hasMore || dailyPage.hasMore)
    } catch (e) {
      console.error('Error loading more:', e)
    } finally {
      setIsLoadingMore(false)
    }
  }, [user, isLoadingMore, hasMore, buildMergedEntries])

  useFocusEffect(useCallback(() => { loadEntries(true) }, [loadEntries]))

  const handleEntryOpen = useCallback(
    (entry: EntryWithSignedUrl) => {
      trackEvent(AnalyticsEvents.BODY_LOG_ENTRY_VIEWED, {
        entry_id: entry.id,
        has_images: entry.images.length > 0,
        has_weight: entry.weight_kg !== null,
      })

      const params: { entryId: string; [key: string]: string } = {
        entryId: entry.isNutritionOnly ? 'new' : entry.id,
        createdAt: entry.created_at,
        logDate: entry.logDate,
      }
      if (!entry.isNutritionOnly) {
        if (entry.weight_kg !== null) params.weightKg = entry.weight_kg.toString()
        if (entry.body_fat_percentage !== null) params.bodyFatPercentage = entry.body_fat_percentage.toString()
        if (entry.bmi !== null) params.bmi = entry.bmi.toString()
      }

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
      style={{ flex: 1, backgroundColor: colors.bg }}
      shouldExit={shouldExit}
      onExitComplete={() => router.back()}
    >
      <View style={styles.container}>
        <BlurredHeader>
          <ScreenHeader
            title="Daily Log"
            onLeftPress={() => setShouldExit(true)}
            leftIcon="arrow-back"
            rightIcon="add"
            onRightPress={handleAdd}
          />
        </BlurredHeader>

        {isInitialLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
          </View>
        ) : entries.length === 0 ? (
          <EmptyState
            icon="images-outline"
            title="Your daily log is empty"
            description="Track meals, body metrics, and progress photos in one place."
            buttonText="Add First Entry"
            onPress={handleAdd}
          />
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <EntryRow entry={item} onPress={handleEntryOpen} />}
            contentContainerStyle={[styles.list, { paddingTop: insets.top + HEADER_ROW_HEIGHT + LIST_TOP_GAP }]}
            scrollIndicatorInsets={{ top: insets.top + HEADER_ROW_HEIGHT + LIST_TOP_GAP }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={10}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.brandPrimary} />
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => loadEntries(true)}
                tintColor={colors.brandPrimary}
                progressViewOffset={insets.top + HEADER_ROW_HEIGHT + LIST_TOP_GAP}
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
      backgroundColor: colors.surfaceSubtle,
    },
    thumbPlaceholder: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 12,
      backgroundColor: colors.surfaceSubtle,
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
    primaryText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    secondaryText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
  })

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
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
