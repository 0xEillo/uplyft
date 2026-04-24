import { BlurredHeader } from '@/components/blurred-header'
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
import { normalizeImageUris } from '@/lib/utils/image-normalization'
import {
    getBodyLogImageUrls,
    prefetchBodyLogImages,
    getThumbnailUrlsWithPrefetch,
    deleteBodyLogImage,
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
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BodyWeightChart } from '@/components/BodyLog/BodyWeightChart'
import { LogMeasuresModal } from '@/components/LogMeasuresModal'

const PAGE_SIZE = 40
const HAS_VISITED_BODY_LOG_KEY = 'hasVisitedBodyLog'
const HEADER_ROW_HEIGHT = 52
const { width: SCREEN_WIDTH } = Dimensions.get('window')
const PHOTO_SIZE = 120

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
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
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

function getViewerPrefetchPaths(
  photos: ProgressPhotoItem[],
  index: number,
): string[] {
  const clampedIndex = Math.max(0, Math.min(index, photos.length - 1))
  return [-1, 0, 1]
    .map((offset) => photos[clampedIndex + offset]?.filePath ?? null)
    .filter((path): path is string => Boolean(path))
}

const MeasureRow = memo(
  ({ entry, onPress }: { entry: EntryWithSignedUrl; onPress: (e: EntryWithSignedUrl) => void }) => {
    const colors = useThemedColors()
    const { formatWeight } = useUnit()
    const hasWeight = entry.weight_kg !== null
    const hasBF = entry.body_fat_percentage !== null
    const hasPhotos = entry.images.length > 0

    if (!hasWeight && !hasBF && !hasPhotos) return null

    return (
      <TouchableOpacity
        style={[rowStyles.row, { borderBottomColor: colors.border }]}
        onPress={() => onPress(entry)}
        activeOpacity={0.7}
      >
        <View style={rowStyles.left}>
          <Text style={[rowStyles.date, { color: colors.textPrimary }]}>
            {formatDate(entry.created_at)}
          </Text>
          {hasPhotos && <Ionicons name="camera" size={16} color={colors.textTertiary} />}
        </View>
        <View style={rowStyles.right}>
          {hasWeight && (
            <Text style={[rowStyles.weight, { color: colors.textPrimary }]}>
              {formatWeight(entry.weight_kg)}
            </Text>
          )}
          {hasBF && (
            <Text style={[rowStyles.bf, { color: colors.textSecondary }]}>
              {formatBodyFat(entry.body_fat_percentage)} body fat
            </Text>
          )}
        </View>
      </TouchableOpacity>
    )
  },
)
MeasureRow.displayName = 'MeasureRow'

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  date: {
    fontSize: 16,
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

export default function MeasuresScreen() {
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
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)
  const [photoThumbUrls, setPhotoThumbUrls] = useState<Record<string, string>>({})
  const [photoHeroUrls, setPhotoHeroUrls] = useState<Record<string, string>>({})
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false)
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0)
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false)
  const [logModalVisible, setLogModalVisible] = useState(false)
  
  const bodyPageRef = useRef(0)
  const dailyPageRef = useRef(0)
  const hasFocusedOnce = useRef(false)

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
      const dailyEntryByDate = new Map(
        rawDailyEntries.map((dailyEntry) => [dailyEntry.log_date, dailyEntry]),
      )

      const bodyRowsByDate = new Map<string, EntryWithSignedUrl>()

      bodyWithThumbnails.forEach((entry) => {
        const logDate = getLocalDateKey(entry.created_at)
        const dailyEntry = dailyEntryByDate.get(logDate)
        
        const existing = bodyRowsByDate.get(logDate)
        if (existing) {
          existing.images = [...existing.images, ...entry.images]
          existing.weight_kg = existing.weight_kg ?? entry.weight_kg
          existing.body_fat_percentage = existing.body_fat_percentage ?? entry.body_fat_percentage
          existing.thumbnailUrl = existing.thumbnailUrl ?? entry.thumbnailUrl
        } else {
          bodyRowsByDate.set(logDate, {
            ...entry,
            weight_kg: dailyEntry?.weight_kg ?? entry.weight_kg,
            logDate,
            dailySummary: summaryByDate[logDate] ?? null,
            isNutritionOnly: false,
          })
        }
      })

      const bodyRows: EntryWithSignedUrl[] = Array.from(bodyRowsByDate.values())

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
        loadEntries(true, true)
      } else {
        hasFocusedOnce.current = true
        trackEvent(AnalyticsEvents.BODY_LOG_VIEWED)
        loadEntries(false)
      }
    }, [loadEntries, trackEvent]),
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
        const resolvedUrls = urls.filter((url): url is string => Boolean(url))
        setPhotoHeroUrls((prev) => {
          const next = { ...prev }
          missingPaths.forEach((path, index) => {
            const url = urls[index]
            if (url) next[path] = url
          })
          return next
        })
        prefetchBodyLogImages(resolvedUrls)
      } catch (error) {
        console.error('Error loading progress photo full-size URLs:', error)
      }
    },
    [photoHeroUrls],
  )

  const handleOpenPhotoViewer = useCallback(
    (photoIndex: number) => {
      if (progressPhotos.length === 0) return
      const safeIndex = Math.max(0, Math.min(photoIndex, progressPhotos.length - 1))
      haptic('light')
      setPhotoViewerIndex(safeIndex)
      setPhotoViewerVisible(true)
      ensureHeroUrls(getViewerPrefetchPaths(progressPhotos, safeIndex))
    },
    [ensureHeroUrls, progressPhotos],
  )

  const handleDeletePhoto = useCallback(
    (photo: ProgressPhotoItem) => {
      const doDelete = async () => {
        if (!user || isDeletingPhoto) return
        setIsDeletingPhoto(true)
        try {
          const imageId = photo.id.split(':')[1]
          await Promise.all([
            database.bodyLog.deleteImage(imageId, user.id),
            deleteBodyLogImage(photo.filePath),
          ])
          haptic('medium')

          if (progressPhotos.length <= 1) {
            setPhotoViewerVisible(false)
          }
          await loadEntries(true, true)
        } catch (e) {
          console.error('Error deleting photo:', e)
          Alert.alert('Error', 'Failed to delete photo. Please try again.')
        } finally {
          setIsDeletingPhoto(false)
        }
      }

      Alert.alert('Delete Photo', 'Are you sure you want to delete this photo?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ])
    },
    [user, isDeletingPhoto, progressPhotos.length, loadEntries],
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

  const handleSaveModal = async ({ weightKg, bodyFat, photoUris }: { weightKg?: number; bodyFat?: number; photoUris?: string[] }) => {
    if (!user) return
    setIsUploadingPhotos(true)
    try {
      const entry = await database.bodyLog.createEntry(user.id)
      
      if (bodyFat !== undefined) {
        await database.bodyLog.updateEntryMetrics(entry.id, { body_fat_percentage: bodyFat })
      }
      
      if (weightKg !== undefined) {
        await database.dailyLog.updateDay(user.id, { weightKg })
      }
      
      if (photoUris && photoUris.length > 0) {
        const { uploadBodyLogImages } = await import('@/lib/utils/body-log-storage')
        const filePaths = await uploadBodyLogImages(photoUris, user.id, entry.id)
        for (let i = 0; i < filePaths.length; i++) {
          await database.bodyLog.addImage(entry.id, user.id, filePaths[i], i + 1)
        }
      }

      haptic('medium')
      await loadEntries(true)
    } catch (e) {
      console.error('Error saving measurements:', e)
      Alert.alert('Error', 'Failed to save measurements. Please try again.')
    } finally {
      setIsUploadingPhotos(false)
    }
  }

  const handlePickPhoto = async (): Promise<string[]> => {
    return new Promise((resolve) => {
      const launchCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync()
        if (status !== 'granted') {
          Alert.alert('Camera Permission', 'Camera access is needed to take photos.')
          return resolve([])
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          aspect: [3, 4],
          quality: 0.8,
        })
        if (!result.canceled && result.assets.length > 0) {
          const uris = await normalizeImageUris(result.assets.map(a => a.uri))
          resolve(uris)
        } else {
          resolve([])
        }
      }

      const launchLibrary = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
          Alert.alert('Library Permission', 'Photo library access is needed to select photos.')
          return resolve([])
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          aspect: [3, 4],
          quality: 0.8,
          allowsMultipleSelection: true,
        })
        if (!result.canceled && result.assets.length > 0) {
          const uris = await normalizeImageUris(result.assets.map(a => a.uri))
          resolve(uris)
        } else {
          resolve([])
        }
      }

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
          (idx) => {
            if (idx === 1) launchCamera()
            else if (idx === 2) launchLibrary()
            else resolve([])
          },
        )
      } else {
        Alert.alert('Add Photo', 'Choose an option', [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
          { text: 'Take Photo', onPress: launchCamera },
          { text: 'Choose from Library', onPress: launchLibrary },
        ])
      }
    })
  }

  const topPad = insets.top + HEADER_ROW_HEIGHT + 16

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

  return (
    <SlideInView
      style={{ flex: 1, backgroundColor: colors.bg }}
      shouldExit={shouldExit}
      onExitComplete={() => router.back()}
    >
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <BlurredHeader fadeExtension={12}>
          <ScreenHeader
            title="Measures"
            onLeftPress={() => setShouldExit(true)}
            leftIcon="arrow-back"
            rightIcon="add"
            onRightPress={() => {
              haptic('light')
              setLogModalVisible(true)
            }}
            rightLoading={isUploadingPhotos}
            rightDisabled={isUploadingPhotos}
          />
        </BlurredHeader>

        {isInitialLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
          </View>
        ) : (
          <FlatList
            data={entries.filter(e => e.weight_kg !== null || e.body_fat_percentage !== null || e.images.length > 0)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MeasureRow entry={item} onPress={handleEntryOpen} />}
            contentContainerStyle={{ paddingTop: topPad, paddingBottom: 100 }}
            scrollIndicatorInsets={{ top: topPad }}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={
              <View style={{ paddingBottom: 16 }}>
                {progressPhotos.length > 0 && (
                  <>
                    <View style={headerStyles.sectionHeader}>
                      <Text style={[headerStyles.sectionTitle, { color: colors.textSecondary }]}>Progress Pictures</Text>
                    </View>
                    <FlatList
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      data={progressPhotos}
                      keyExtractor={item => item.id}
                      contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 24 }}
                      renderItem={({ item, index }) => (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => handleOpenPhotoViewer(index)}
                          style={[headerStyles.photoCard, { backgroundColor: colors.surfaceSubtle }]}
                        >
                          <Image 
                            source={{ uri: photoThumbUrls[item.filePath] ?? undefined }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                            transition={200}
                          />
                          <View style={headerStyles.photoDateOverlay}>
                            <Text style={[headerStyles.photoDateText, { color: '#fff' }]}>
                              {formatDate(item.entryCreatedAt)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    />
                  </>
                )}

                {user && (
                  <View style={{ marginBottom: 12 }}>
                    <BodyWeightChart userId={user.id} />
                  </View>
                )}

                <View style={[headerStyles.sectionHeader, { paddingTop: 16 }]}>
                  <Text style={[headerStyles.sectionTitle, { color: colors.textSecondary }]}>Weight History</Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={{ alignItems: 'center', padding: 40, opacity: 0.6 }}>
                <Ionicons name="body-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
                  No measurements yet
                </Text>
                <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center' }}>
                  Tap the + button to log your first weight, body fat, or progress picture.
                </Text>
              </View>
            }
            ListFooterComponent={footer}
            refreshControl={refreshControl}
          />
        )}
      </View>

      <LogMeasuresModal
        visible={logModalVisible}
        onClose={() => setLogModalVisible(false)}
        onSave={handleSaveModal}
        onAddPhoto={handlePickPhoto}
        onScanPress={() => {
          setLogModalVisible(false)
          router.push('/body-log/scan' as any)
        }}
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

            <TouchableOpacity
              onPress={() => {
                const photo = progressPhotos[photoViewerIndex]
                if (photo) handleDeletePhoto(photo)
              }}
              disabled={isDeletingPhoto}
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
              {isDeletingPhoto ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="trash-outline" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {photoViewerVisible && progressPhotos.length > 0 && (
            <FlatList
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
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH)
                setPhotoViewerIndex(nextIndex)
                ensureHeroUrls(getViewerPrefetchPaths(progressPhotos, nextIndex))
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

const headerStyles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  photoCard: {
    width: PHOTO_SIZE,
    height: Math.round(PHOTO_SIZE * 1.33), // 3:4 aspect ratio
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoDateOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  photoDateText: {
    fontSize: 12,
    fontWeight: '600',
  }
})
