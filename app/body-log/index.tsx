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
import { setPendingChatAttachment } from '@/lib/chat-attachment-handoff'
import { haptic } from '@/lib/haptics'
import {
  getBodyLogImageUrls,
  getThumbnailUrlsWithPrefetch,
} from '@/lib/utils/body-log-storage'
import type { DailyLogEntry, DailyLogSummary } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BodyFatAddSheet } from '@/components/BodyFatAddSheet'
import { BodyFatInputModal } from '@/components/BodyFatInputModal'
import { WeightInputModal } from '@/components/WeightInputModal'

const PAGE_SIZE = 40
const HAS_VISITED_BODY_LOG_KEY = 'hasVisitedBodyLog'
const HEADER_ROW_HEIGHT = 52
const { width: SCREEN_WIDTH } = Dimensions.get('window')
const PHOTO_COLUMNS = 3
const PHOTO_GAP = 2
const PHOTO_SIZE = Math.floor(
  (SCREEN_WIDTH - PHOTO_GAP * (PHOTO_COLUMNS + 1)) / PHOTO_COLUMNS,
)

type ActiveTab = 'weight' | 'bodyfat' | 'meals' | 'photos'

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

type ProgressPhotoItem = {
  id: string
  entryId: string
  filePath: string
  sequence: number
  createdAt: string
  entryCreatedAt: string
}

type PhotoGridAddItem = {
  id: 'add-photo'
  type: 'add'
}

type PhotoGridPhotoItem = ProgressPhotoItem & {
  type: 'photo'
}

type PhotoGridItem = PhotoGridAddItem | PhotoGridPhotoItem

// ── Stats Row ─────────────────────────────────────────────────────────────────

const StatsRow = memo(
  ({ entry, onPress }: { entry: EntryWithSignedUrl; onPress: (e: EntryWithSignedUrl) => void }) => {
    const colors = useThemedColors()
    const { formatWeight } = useUnit()
    const hasWeight = entry.weight_kg !== null
    const hasBF = entry.body_fat_percentage !== null

    if (!hasWeight && !hasBF) return null

    return (
      <TouchableOpacity
        style={[statsRowStyles.row, { borderBottomColor: colors.border }]}
        onPress={() => onPress(entry)}
        activeOpacity={0.7}
      >
        <Text style={[statsRowStyles.date, { color: colors.textSecondary }]}>
          {formatDate(entry.created_at)}
        </Text>
        <View style={statsRowStyles.right}>
          {hasWeight && (
            <Text style={[statsRowStyles.weight, { color: colors.textPrimary }]}>
              {formatWeight(entry.weight_kg)}
            </Text>
          )}
          {hasBF && (
            <Text style={[statsRowStyles.bf, { color: colors.textSecondary }]}>
              {formatBodyFat(entry.body_fat_percentage)} body fat
            </Text>
          )}
        </View>
      </TouchableOpacity>
    )
  },
)
StatsRow.displayName = 'StatsRow'

const statsRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  date: {
    fontSize: 15,
    fontWeight: '500',
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  weight: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  bf: {
    fontSize: 13,
    fontWeight: '500',
  },
})

// ── Meals Row ─────────────────────────────────────────────────────────────────

const MealsRow = memo(
  ({ entry, onPress }: { entry: EntryWithSignedUrl; onPress: (e: EntryWithSignedUrl) => void }) => {
    const colors = useThemedColors()
    const totals = entry.dailySummary?.totals
    if (!totals || totals.meal_count === 0) return null

    const macros = [
      { label: 'P', value: Math.round(totals.protein_g), color: '#F87171' },
      { label: 'C', value: Math.round(totals.carbs_g), color: '#FBBF24' },
      { label: 'F', value: Math.round(totals.fat_g), color: '#60A5FA' },
    ]

    return (
      <TouchableOpacity
        style={[mealsRowStyles.row, { borderBottomColor: colors.border }]}
        onPress={() => onPress(entry)}
        activeOpacity={0.7}
      >
        <View style={mealsRowStyles.left}>
          <Text style={[mealsRowStyles.date, { color: colors.textSecondary }]}>
            {formatDate(entry.created_at)}
          </Text>
          <View style={mealsRowStyles.macroRow}>
            {macros.map((m) => (
              <View key={m.label} style={mealsRowStyles.macroChip}>
                <Text style={[mealsRowStyles.macroLabel, { color: m.color }]}>{m.label}</Text>
                <Text style={[mealsRowStyles.macroValue, { color: colors.textSecondary }]}>{m.value}g</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={mealsRowStyles.right}>
          <Text style={[mealsRowStyles.calories, { color: colors.textPrimary }]}>
            {Math.round(totals.calories)}
          </Text>
          <Text style={[mealsRowStyles.kcal, { color: colors.textSecondary }]}>kcal</Text>
        </View>
      </TouchableOpacity>
    )
  },
)
MealsRow.displayName = 'MealsRow'

const mealsRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flex: 1,
    gap: 6,
  },
  date: {
    fontSize: 15,
    fontWeight: '500',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  macroValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  right: {
    alignItems: 'flex-end',
  },
  calories: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  kcal: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: -2,
  },
})

// ── Progress Photo Tiles ──────────────────────────────────────────────────────

const ProgressPhotoTile = memo(
  ({
    item,
    imageUrl,
    onPress,
  }: {
    item: ProgressPhotoItem
    imageUrl: string | null
    onPress: () => void
  }) => {
    const colors = useThemedColors()

    return (
      <TouchableOpacity
        style={[photoGridStyles.card, { backgroundColor: colors.surfaceSubtle }]}
        onPress={onPress}
        activeOpacity={0.94}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={photoGridStyles.image}
            contentFit="cover"
            cachePolicy="disk"
            transition={120}
            recyclingKey={item.id}
          />
        ) : (
          <View
            style={[
              photoGridStyles.image,
              photoGridStyles.loadingTile,
              { backgroundColor: colors.surfaceSubtle },
            ]}
          >
            <ActivityIndicator size="small" color={colors.textTertiary} />
          </View>
        )}
      </TouchableOpacity>
    )
  },
)
ProgressPhotoTile.displayName = 'ProgressPhotoTile'

const AddPhotoTile = memo(
  ({ onPress, isLoading }: { onPress: () => void; isLoading: boolean }) => {
    const colors = useThemedColors()

    return (
      <TouchableOpacity
        style={[
          photoGridStyles.card,
          photoGridStyles.addCard,
          {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.border,
          },
        ]}
        onPress={onPress}
        disabled={isLoading}
        activeOpacity={0.9}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.brandPrimary} />
        ) : (
          <>
            <Ionicons name="add" size={22} color={colors.textPrimary} />
            <Text style={[photoGridStyles.addText, { color: colors.textSecondary }]}>
              Add
            </Text>
          </>
        )}
      </TouchableOpacity>
    )
  },
)
AddPhotoTile.displayName = 'AddPhotoTile'

const photoGridStyles = StyleSheet.create({
  card: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 2,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingTile: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCard: {
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
})

// ── Tabs bar ──────────────────────────────────────────────────────────────────

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'weight', label: 'Weight' },
  { id: 'meals', label: 'Nutrition' },
  { id: 'bodyfat', label: 'Body Scan' },
  { id: 'photos', label: 'Progress Pics' },
]
const TAB_AUTO_SCROLL_GUTTER = 20

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function BodyLogScreen() {
  const colors = useThemedColors()
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const { formatWeight } = useUnit()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [shouldExit, setShouldExit] = useState(false)
  const [entries, setEntries] = useState<EntryWithSignedUrl[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('weight')
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)
  const [photoThumbUrls, setPhotoThumbUrls] = useState<Record<string, string>>({})
  const [photoHeroUrls, setPhotoHeroUrls] = useState<Record<string, string>>({})
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false)
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0)
  const bodyPageRef = useRef(0)
  const dailyPageRef = useRef(0)
  const hasFocusedOnce = useRef(false)
  const tabsScrollRef = useRef<ScrollView | null>(null)
  const tabLayoutsRef = useRef<Partial<Record<ActiveTab, { x: number; width: number }>>>({})
  const tabsViewportWidthRef = useRef(0)
  const tabsContentWidthRef = useRef(0)
  const tabsScrollOffsetRef = useRef(0)

  const weightEntries = useMemo(
    () => entries.filter(e => e.weight_kg !== null),
    [entries],
  )
  const bodyfatEntries = useMemo(
    () => entries.filter(e => e.body_fat_percentage !== null),
    [entries],
  )
  const mealsEntries = useMemo(
    () => entries.filter(e => (e.dailySummary?.totals?.meal_count ?? 0) > 0),
    [entries],
  )
  const progressPhotos = useMemo<ProgressPhotoItem[]>(
    () =>
      entries
        .filter((entry) => entry.images.length > 0)
        .flatMap((entry) =>
          [...entry.images]
            .sort((a, b) => a.sequence - b.sequence)
            .map((img) => ({
              id: `${entry.id}:${img.id}`,
              entryId: entry.id,
              filePath: img.file_path,
              sequence: img.sequence,
              createdAt: img.created_at ?? entry.created_at,
              entryCreatedAt: entry.created_at,
            })),
        )
        .sort((a, b) => {
          const timeDiff =
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          if (timeDiff !== 0) return timeDiff
          return b.sequence - a.sequence
        }),
    [entries],
  )
  const photoGridData = useMemo<PhotoGridItem[]>(
    () => [
      { id: 'add-photo', type: 'add' },
      ...progressPhotos.map((photo) => ({ ...photo, type: 'photo' as const })),
    ],
    [progressPhotos],
  )

  const fetchThumbnailUrls = useCallback(
    async (rawEntries: BodyLogEntryWithImages[]): Promise<BodyEntryWithThumbnail[]> => {
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
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    },
    [fetchThumbnailUrls, user],
  )

  const loadEntries = useCallback(
    async (refresh = false, silent = false) => {
      if (!user) {
        setEntries([])
        setIsInitialLoading(false)
        return
      }

      if (!silent) {
        if (refresh) {
          setIsRefreshing(true)
        } else {
          setIsInitialLoading(true)
        }
      }
      bodyPageRef.current = 0
      dailyPageRef.current = 0

      try {
        await AsyncStorage.setItem(HAS_VISITED_BODY_LOG_KEY, 'true')
        const [bodyPage, dailyPage] = await Promise.all([
          database.bodyLog.getEntriesPage(user.id, 0, PAGE_SIZE),
          database.dailyLog.getEntriesPage(user.id, 0, PAGE_SIZE),
        ])
        const mergedEntries = await buildMergedEntries(bodyPage.entries, dailyPage.entries)

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
        if (!silent) {
          setIsInitialLoading(false)
          setIsRefreshing(false)
        }
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
        newRows.forEach((entry) => { map.set(entry.id, entry) })
        return Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
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

  useFocusEffect(
    useCallback(() => {
      if (hasFocusedOnce.current) {
        loadEntries(true, true) // silent refresh when returning from sub-page
      } else {
        hasFocusedOnce.current = true
        loadEntries(false) // initial load with spinner
      }
    }, [loadEntries]),
  )

  useEffect(() => {
    const allPaths = progressPhotos.map((photo) => photo.filePath)
    const missingPaths = Array.from(new Set(allPaths)).filter(
      (path) => !photoThumbUrls[path],
    )

    if (missingPaths.length === 0) return

    let cancelled = false

    const loadThumbs = async () => {
      try {
        const urls = await getThumbnailUrlsWithPrefetch(missingPaths)
        if (cancelled) return

        setPhotoThumbUrls((prev) => {
          const next = { ...prev }
          missingPaths.forEach((path, index) => {
            const url = urls[index]
            if (url) next[path] = url
          })
          return next
        })
      } catch (error) {
        console.error('Error loading progress photo thumbnails:', error)
      }
    }

    loadThumbs()

    return () => {
      cancelled = true
    }
  }, [progressPhotos, photoThumbUrls])

  const ensureHeroUrls = useCallback(
    async (paths: string[]) => {
      const uniquePaths = Array.from(new Set(paths))
      const missingPaths = uniquePaths.filter((path) => !photoHeroUrls[path])
      if (missingPaths.length === 0) return

      try {
        const urls = await getBodyLogImageUrls(missingPaths, 'hero')
        setPhotoHeroUrls((prev) => {
          const next = { ...prev }
          missingPaths.forEach((path, index) => {
            const url = urls[index]
            if (url) next[path] = url
          })
          return next
        })
      } catch (error) {
        console.error('Error loading progress photo full-size URLs:', error)
      }
    },
    [photoHeroUrls],
  )

  const handleOpenPhotoViewer = useCallback(
    (photoIndex: number) => {
      if (progressPhotos.length === 0) return
      haptic('light')
      setPhotoViewerIndex(photoIndex)
      setPhotoViewerVisible(true)
      ensureHeroUrls(progressPhotos.map((photo) => photo.filePath))
    },
    [ensureHeroUrls, progressPhotos],
  )

  useEffect(() => {
    if (photoViewerIndex < progressPhotos.length) return
    setPhotoViewerIndex(Math.max(0, progressPhotos.length - 1))
  }, [photoViewerIndex, progressPhotos.length])

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

  const handleFoodEntryOpen = useCallback(
    (entry: EntryWithSignedUrl) => {
      router.push({
        pathname: '/body-log/daily-food-log',
        params: {
          logDate: entry.logDate,
          entryId: entry.id,
          totalsJson: entry.dailySummary ? JSON.stringify(entry.dailySummary.totals) : undefined,
          goalsJson: entry.dailySummary ? JSON.stringify(entry.dailySummary.goals) : undefined,
        },
      })
    },
    [router],
  )

  // ── Context-aware add ─────────────────────────
  const [weightModalVisible, setWeightModalVisible] = useState(false)
  const [bodyFatSheetVisible, setBodyFatSheetVisible] = useState(false)
  const [bodyFatInputVisible, setBodyFatInputVisible] = useState(false)

  const handleSaveWeight = useCallback(async (weightKg: number) => {
    if (!user) return
    try {
      await database.bodyLog.createEntry(user.id, { weightKg })
      haptic('medium')
      loadEntries(true)
    } catch (e) {
      console.error('Error saving weight:', e)
      Alert.alert('Error', 'Failed to save weight. Please try again.')
    }
  }, [user, loadEntries])

  const handleSaveBodyFat = useCallback(async (bodyFatPercentage: number) => {
    if (!user) return
    const entry = await database.bodyLog.createEntry(user.id)
    await database.bodyLog.updateEntryMetrics(entry.id, { body_fat_percentage: bodyFatPercentage })
    loadEntries(true)
  }, [user, loadEntries])

  const handleImportProgressPhotos = useCallback(
    async (uris: string[]) => {
      if (!user || uris.length === 0 || isUploadingPhotos) return

      setIsUploadingPhotos(true)
      try {
        const { uploadBodyLogImages } = await import('@/lib/utils/body-log-storage')

        for (let start = 0; start < uris.length; start += 3) {
          const batch = uris.slice(start, start + 3)
          const entry = await database.bodyLog.createEntry(user.id)
          const filePaths = await uploadBodyLogImages(batch, user.id, entry.id)

          for (let i = 0; i < filePaths.length; i++) {
            await database.bodyLog.addImage(entry.id, user.id, filePaths[i], i + 1)
          }
        }

        haptic('medium')
        await loadEntries(true)
      } catch (error) {
        console.error('Error uploading progress photos:', error)
        Alert.alert('Upload Failed', 'Unable to add progress photos. Please try again.')
      } finally {
        setIsUploadingPhotos(false)
      }
    },
    [isUploadingPhotos, loadEntries, user],
  )

  const handleAddPhoto = useCallback(async () => {
    if (!user || isUploadingPhotos) return

    const launchCamera = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Camera Permission', 'Camera access is needed to take photos.')
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        aspect: [3, 4],
        quality: 0.8,
      })
      if (!result.canceled && result.assets.length > 0) {
        await handleImportProgressPhotos(result.assets.map((asset) => asset.uri))
      }
    }

    const launchLibrary = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Library Permission', 'Photo library access is needed to select photos.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        aspect: [3, 4],
        quality: 0.8,
        allowsMultipleSelection: true,
      })
      if (!result.canceled && result.assets.length > 0) {
        await handleImportProgressPhotos(result.assets.map((asset) => asset.uri))
      }
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) launchCamera()
          if (idx === 2) launchLibrary()
        },
      )
    } else {
      Alert.alert('Add Photo', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: launchCamera },
        { text: 'Choose from Library', onPress: launchLibrary },
      ])
    }
  }, [handleImportProgressPhotos, isUploadingPhotos, user])

  const handleContextAdd = useCallback(async () => {
    if (!user) return alert('You must be logged in')
    haptic('medium')

    if (activeTab === 'weight') {
      setWeightModalVisible(true)
    } else if (activeTab === 'bodyfat') {
      trackEvent(AnalyticsEvents.BODY_LOG_ENTRY_STARTED)
      setBodyFatSheetVisible(true)
    } else if (activeTab === 'meals') {
      try {
        await setPendingChatAttachment({ action: 'scan_food' })
      } catch (error) {
        console.error('[BodyLog] Failed to queue scan-food handoff:', error)
      }
      router.push('/(tabs)/chat' as any)
    } else if (activeTab === 'photos') {
      handleAddPhoto()
    }
  }, [user, activeTab, router, trackEvent, handleAddPhoto])

  const topPad = insets.top + HEADER_ROW_HEIGHT + 16

  const scrollTabIntoView = useCallback((tabId: ActiveTab) => {
    const scrollView = tabsScrollRef.current
    const tabLayout = tabLayoutsRef.current[tabId]
    const viewportWidth = tabsViewportWidthRef.current

    if (!scrollView || !tabLayout || viewportWidth <= 0) return

    const contentWidth = Math.max(tabsContentWidthRef.current, viewportWidth)
    const currentOffset = tabsScrollOffsetRef.current
    const visibleLeft = currentOffset
    const visibleRight = currentOffset + viewportWidth
    const targetLeft = Math.max(0, tabLayout.x - TAB_AUTO_SCROLL_GUTTER)
    const targetRight = Math.min(
      contentWidth,
      tabLayout.x + tabLayout.width + TAB_AUTO_SCROLL_GUTTER,
    )

    if (targetLeft >= visibleLeft && targetRight <= visibleRight) return

    const maxOffset = Math.max(0, contentWidth - viewportWidth)
    let nextOffset = currentOffset

    if (targetLeft < visibleLeft) {
      nextOffset = targetLeft
    } else if (targetRight > visibleRight) {
      nextOffset = targetRight - viewportWidth
    }

    nextOffset = Math.max(0, Math.min(nextOffset, maxOffset))
    if (Math.abs(nextOffset - currentOffset) < 1) return

    tabsScrollOffsetRef.current = nextOffset
    scrollView.scrollTo({ x: nextOffset, animated: true })
  }, [])

  const handleTabPress = useCallback(
    (tabId: ActiveTab) => {
      haptic('light')
      if (tabId === activeTab) {
        scrollTabIntoView(tabId)
        return
      }

      setActiveTab(tabId)
    },
    [activeTab, scrollTabIntoView],
  )

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollTabIntoView(activeTab)
    })

    return () => cancelAnimationFrame(frame)
  }, [activeTab, scrollTabIntoView])

  // Shared tabs header
  const TabsHeader = useMemo(() => (
    <ScrollView
      ref={(node) => {
        tabsScrollRef.current = node
      }}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentOffset={{ x: tabsScrollOffsetRef.current, y: 0 }}
      scrollEventThrottle={16}
      onScroll={(event) => {
        tabsScrollOffsetRef.current = event.nativeEvent.contentOffset.x
      }}
      onLayout={(event) => {
        tabsViewportWidthRef.current = event.nativeEvent.layout.width
        requestAnimationFrame(() => scrollTabIntoView(activeTab))
      }}
      onContentSizeChange={(width) => {
        tabsContentWidthRef.current = width
        requestAnimationFrame(() => scrollTabIntoView(activeTab))
      }}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 20 }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <TouchableOpacity
            key={tab.id}
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout
              tabLayoutsRef.current[tab.id] = { x, width }
              if (tab.id === activeTab) {
                requestAnimationFrame(() => scrollTabIntoView(tab.id))
              }
            }}
            style={[
              tabStyles.pill,
              isActive ? { backgroundColor: colors.textPrimary } : { backgroundColor: colors.surfaceSubtle },
            ]}
            onPress={() => handleTabPress(tab.id)}
            activeOpacity={0.8}
          >
            <Text style={[
              tabStyles.pillText,
              isActive ? { color: colors.bg, fontWeight: '700' } : { color: colors.textSecondary, fontWeight: '600' },
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  ), [activeTab, colors, handleTabPress, scrollTabIntoView])

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={() => loadEntries(true)}
      tintColor={colors.brandPrimary}
      progressViewOffset={topPad}
    />
  )

  const footer = isLoadingMore ? (
    <View style={{ padding: 16, alignItems: 'center' }}>
      <ActivityIndicator size="small" color={colors.brandPrimary} />
    </View>
  ) : null

  const emptySection = (label: string) => (
    <View style={{ padding: 32, alignItems: 'center' }}>
      <Text style={{ color: colors.textSecondary, fontSize: 15 }}>No {label} logged yet.</Text>
    </View>
  )

  return (
    <SlideInView
      style={{ flex: 1, backgroundColor: colors.bg }}
      shouldExit={shouldExit}
      onExitComplete={() => router.back()}
    >
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <BlurredHeader fadeExtension={12}>
          <ScreenHeader
            title="Gym Log"
            onLeftPress={() => setShouldExit(true)}
            leftIcon="arrow-back"
            rightIcon="add"
            onRightPress={handleContextAdd}
            rightLoading={activeTab === 'photos' && isUploadingPhotos}
            rightDisabled={activeTab === 'photos' && isUploadingPhotos}
          />
        </BlurredHeader>

        {isInitialLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
          </View>
        ) : entries.length === 0 ? (
          <EmptyState
            icon="images-outline"
            title="Your Gym Log is empty"
            description="Track meals, body metrics, and progress photos in one place."
            buttonText="Add First Entry"
            onPress={handleContextAdd}
          />
        ) : activeTab === 'weight' ? (
          // ── Weight: date → weight value
          <FlatList
            key="weight"
            data={weightEntries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              if (item.weight_kg === null) return null
              return (
                <TouchableOpacity
                  style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  onPress={() => handleEntryOpen(item)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textSecondary }}>
                    {formatDate(item.created_at)}
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', letterSpacing: -0.4, color: colors.textPrimary }}>
                    {formatWeight(item.weight_kg)}
                  </Text>
                </TouchableOpacity>
              )
            }}
            contentContainerStyle={{ paddingTop: topPad, paddingBottom: 100 }}
            scrollIndicatorInsets={{ top: topPad }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={15}
            windowSize={10}
            initialNumToRender={15}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={<View>{TabsHeader}</View>}
            ListEmptyComponent={emptySection('weight')}
            ListFooterComponent={footer}
            refreshControl={refreshControl}
          />
        ) : activeTab === 'bodyfat' ? (
          // ── Body Fat: date → body fat %
          <FlatList
            key="bodyfat"
            data={bodyfatEntries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              if (item.body_fat_percentage === null) return null
              return (
                <TouchableOpacity
                  style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  onPress={() => handleEntryOpen(item)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textSecondary }}>
                    {formatDate(item.created_at)}
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', letterSpacing: -0.4, color: colors.textPrimary }}>
                    {item.body_fat_percentage}%
                  </Text>
                </TouchableOpacity>
              )
            }}
            contentContainerStyle={{ paddingTop: topPad, paddingBottom: 100 }}
            scrollIndicatorInsets={{ top: topPad }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={15}
            windowSize={10}
            initialNumToRender={15}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={<View>{TabsHeader}</View>}
            ListEmptyComponent={emptySection('body fat')}
            ListFooterComponent={footer}
            refreshControl={refreshControl}
          />
        ) : activeTab === 'meals' ? (
          // ── Meals: calorie-first day rows
          <FlatList
            key="meals"
            data={mealsEntries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MealsRow entry={item} onPress={handleFoodEntryOpen} />}
            contentContainerStyle={{ paddingTop: topPad, paddingBottom: 100 }}
            scrollIndicatorInsets={{ top: topPad }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={15}
            windowSize={10}
            initialNumToRender={15}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={
              <View>
                {TabsHeader}
              
              </View>
            }
            ListEmptyComponent={emptySection('meals')}
            ListFooterComponent={footer}
            refreshControl={refreshControl}
          />
        ) : (
          // ── Photos: flat photo library grid
          <FlatList
            key="photos"
            data={photoGridData}
            keyExtractor={(item) => item.id}
            numColumns={PHOTO_COLUMNS}
            columnWrapperStyle={{ gap: PHOTO_GAP, paddingHorizontal: PHOTO_GAP }}
            renderItem={({ item, index }) => {
              if (item.type === 'add') {
                return (
                  <AddPhotoTile
                    onPress={handleAddPhoto}
                    isLoading={isUploadingPhotos}
                  />
                )
              }

              return (
                <ProgressPhotoTile
                  item={item}
                  imageUrl={photoThumbUrls[item.filePath] ?? null}
                  onPress={() => handleOpenPhotoViewer(index - 1)}
                />
              )
            }}
            contentContainerStyle={{ paddingTop: topPad, paddingBottom: 100, gap: PHOTO_GAP }}
            scrollIndicatorInsets={{ top: topPad }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={18}
            windowSize={10}
            initialNumToRender={24}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: PHOTO_GAP }}>
                {TabsHeader}
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingBottom: 10,
                    paddingTop: 2,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 14,
                      fontWeight: '700',
                      letterSpacing: -0.2,
                    }}
                  >
                    All Photos
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {progressPhotos.length} {progressPhotos.length === 1 ? 'photo' : 'photos'}
                  </Text>
                </View>
                {progressPhotos.length === 0 && (
                  <View
                    style={{
                      marginHorizontal: 6,
                      marginBottom: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderRadius: 14,
                      backgroundColor: colors.surfaceSubtle,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 13,
                        fontWeight: '600',
                        marginBottom: 2,
                      }}
                    >
                      Start your progress photo timeline
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16 }}>
                      Tap the + tile or the header add button to take a photo or import from your library.
                    </Text>
                  </View>
                )}
              </View>
            }
            ListFooterComponent={footer}
            refreshControl={refreshControl}
          />
        )}
      </View>

      <WeightInputModal
        visible={weightModalVisible}
        onClose={() => setWeightModalVisible(false)}
        onSave={handleSaveWeight}
      />

      <BodyFatAddSheet
        visible={bodyFatSheetVisible}
        onClose={() => setBodyFatSheetVisible(false)}
        onManual={() => setBodyFatInputVisible(true)}
        onBodyScan={() => {
          setBodyFatSheetVisible(false)
          router.push('/body-log/scan' as any)
        }}
      />

      <BodyFatInputModal
        visible={bodyFatInputVisible}
        onClose={() => setBodyFatInputVisible(false)}
        onSave={handleSaveBodyFat}
      />

      <Modal
        visible={photoViewerVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setPhotoViewerVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 2,
              paddingTop: insets.top + 8,
              paddingHorizontal: 14,
              paddingBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(0,0,0,0.24)',
            }}
          >
            <TouchableOpacity
              onPress={() => setPhotoViewerVisible(false)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.12)',
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 10 }}>
              <Text
                style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                numberOfLines={1}
              >
                {progressPhotos[photoViewerIndex]
                  ? formatDate(progressPhotos[photoViewerIndex].entryCreatedAt)
                  : 'Photo'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '500' }}>
                {progressPhotos.length > 0 ? `${photoViewerIndex + 1} of ${progressPhotos.length}` : ''}
              </Text>
            </View>

            <View style={{ width: 40, height: 40 }} />
          </View>

          {progressPhotos.length > 0 && (
            <FlatList
              key={`photo-viewer-${progressPhotos.length}-${photoViewerIndex}`}
              data={progressPhotos}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              initialScrollIndex={Math.max(0, Math.min(photoViewerIndex, progressPhotos.length - 1))}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH)
                setPhotoViewerIndex(nextIndex)
                const current = progressPhotos[nextIndex]
                if (current?.filePath) {
                  ensureHeroUrls([current.filePath])
                }
              }}
              renderItem={({ item }) => {
                const uri = photoHeroUrls[item.filePath] ?? photoThumbUrls[item.filePath] ?? null
                return (
                  <View
                    style={{
                      width: SCREEN_WIDTH,
                      flex: 1,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: '#000',
                    }}
                  >
                    {uri ? (
                      <Image
                        source={{ uri }}
                        style={{ width: SCREEN_WIDTH, height: '100%' }}
                        contentFit="contain"
                        transition={180}
                      />
                    ) : (
                      <ActivityIndicator size="large" color="#fff" />
                    )}
                  </View>
                )
              }}
            />
          )}
        </View>
      </Modal>
    </SlideInView>
  )
}

const tabStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillText: {
    fontSize: 15,
  },
})
