import { BlurredHeader } from '@/components/blurred-header'
import { ScreenHeader } from '@/components/screen-header'
import { SlideInView } from '@/components/slide-in-view'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { haptic, hapticSuccess } from '@/lib/haptics'
import { resolveCalorieGoal } from '@/lib/nutrition'
import { supabase } from '@/lib/supabase'
import { getDailyLogMealImagePath } from '@/lib/utils/daily-log-meals'
import { getMealImageUrls } from '@/lib/utils/meal-image-storage'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Circle, G, Svg } from 'react-native-svg'

import type { DailyLogMeal, DailyLogSummary } from '@/types/database.types'

const HEADER_ROW_HEIGHT = 68

type DailyTotals = DailyLogSummary['totals']
type DailyGoals = DailyLogSummary['goals']

const DEFAULT_TOTALS: DailyTotals = {
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  meal_count: 0,
}

const DEFAULT_GOALS: DailyGoals = {
  calorie_goal: null,
  protein_goal_g: null,
}

function getLocalDateKey(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeLogDateParam(logDate?: string): string | null {
  if (!logDate) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(logDate)) return logDate

  const parsed = new Date(logDate)
  if (Number.isNaN(parsed.getTime())) return null
  return getLocalDateKey(parsed.toISOString())
}

function formatHeaderDate(logDate: string): string {
  const date = new Date(`${logDate}T12:00:00`)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (target.getTime() === today.getTime()) return 'Today'
  if (target.getTime() === yesterday.getTime()) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function formatMealTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatRecentDateBadge(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (target.getTime() === today.getTime()) return 'Today'
  if (target.getTime() === yesterday.getTime()) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function buildRecentMealFingerprint(meal: DailyLogMeal): string {
  const normalizedDescription = meal.description
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  return [
    normalizedDescription,
    round(meal.calories),
    round(meal.protein_g),
    round(meal.carbs_g),
    round(meal.fat_g),
  ].join('|')
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function round(value: number): number {
  return Math.round(value)
}

function getMealSourceIcon(
  source: DailyLogMeal['source'],
): keyof typeof Ionicons.glyphMap {
  switch (source) {
    case 'photo':
      return 'camera-outline'
    case 'voice':
      return 'mic-outline'
    case 'manual':
      return 'create-outline'
    case 'correction':
      return 'sparkles-outline'
    case 'text':
    default:
      return 'chatbubble-ellipses-outline'
  }
}

export default function DailyFoodLogScreen() {
  const params = useLocalSearchParams<{
    logDate?: string
    entryId?: string
    totalsJson?: string
    goalsJson?: string
  }>()

  const router = useRouter()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { trackEvent } = useAnalytics()
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])

  const [shouldExit, setShouldExit] = useState(false)
  const [resolvedLogDate, setResolvedLogDate] = useState<string | null>(
    normalizeLogDateParam(params.logDate),
  )
  const [summary, setSummary] = useState<DailyLogSummary | null>(null)
  const [meals, setMeals] = useState<DailyLogMeal[]>([])
  const [mealImageUrls, setMealImageUrls] = useState<Record<string, string>>({})
  const [recentMealsRaw, setRecentMealsRaw] = useState<DailyLogMeal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRecentMealsLoading, setIsRecentMealsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [reloggingMealId, setReloggingMealId] = useState<string | null>(null)
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)

  const handleOpenFoodLibrary = useCallback(() => {
    haptic('light')
    router.push('/chat')
  }, [router])

  const prefillTotals = useMemo(
    () => parseJson<DailyTotals>(params.totalsJson, DEFAULT_TOTALS),
    [params.totalsJson],
  )
  const prefillGoals = useMemo(
    () => parseJson<DailyGoals>(params.goalsJson, DEFAULT_GOALS),
    [params.goalsJson],
  )

  const fetchFoodLogData = useCallback(
    async (userId: string, logDate: string) => {
      const recentMealsPromise = database.dailyLog
        .getRecentMeals(userId, 36)
        .catch((error) => {
          console.error('Error loading recent meals:', error)
          return [] as DailyLogMeal[]
        })

      const [daySummary, dayMeals, recentMeals] = await Promise.all([
        database.dailyLog.getDaySummary(userId, logDate),
        database.dailyLog.getMealsForDay(userId, logDate),
        recentMealsPromise,
      ])

      return { daySummary, dayMeals, recentMeals }
    },
    [],
  )

  useEffect(() => {
    if (resolvedLogDate) return
    if (!user?.id) return

    if (!params.entryId || params.entryId === 'new') {
      setResolvedLogDate(getLocalDateKey(new Date().toISOString()))
      return
    }

    let cancelled = false

    const resolveFromEntry = async () => {
      try {
        const { data, error } = await supabase
          .from('body_log_entries')
          .select('created_at')
          .eq('id', params.entryId)
          .eq('user_id', user.id)
          .single()

        if (cancelled) return
        if (error || !data?.created_at) {
          setResolveError('Unable to resolve log date.')
          setResolvedLogDate(getLocalDateKey(new Date().toISOString()))
          return
        }

        setResolvedLogDate(getLocalDateKey(data.created_at))
      } catch (error) {
        console.error('Error resolving food log date:', error)
        if (!cancelled) {
          setResolveError('Unable to resolve log date.')
          setResolvedLogDate(getLocalDateKey(new Date().toISOString()))
        }
      }
    }

    resolveFromEntry()

    return () => {
      cancelled = true
    }
  }, [params.entryId, resolvedLogDate, user?.id])

  useEffect(() => {
    if (!user?.id || !resolvedLogDate) return

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setIsRecentMealsLoading(true)
      setResolveError(null)

      try {
        const { daySummary, dayMeals, recentMeals } = await fetchFoodLogData(
          user.id,
          resolvedLogDate,
        )

        if (cancelled) return
        setSummary(daySummary)
        setMeals(dayMeals)
        setRecentMealsRaw(recentMeals)
      } catch (error) {
        console.error('Error loading daily food log:', error)
        if (!cancelled) {
          setSummary(null)
          setMeals([])
          setRecentMealsRaw([])
          setResolveError('Failed to load food log for this day.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          setIsRecentMealsLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [fetchFoodLogData, resolvedLogDate, user?.id])

  useEffect(() => {
    if (resolvedLogDate && user?.id) {
      trackEvent(AnalyticsEvents.FOOD_LOG_VIEWED, {
        log_date: resolvedLogDate,
      })
    }
  }, [resolvedLogDate, user?.id, trackEvent])

  useEffect(() => {
    const mealImagePaths = Array.from(
      new Set(
        meals
          .map((meal) => getDailyLogMealImagePath(meal))
          .filter((value): value is string => Boolean(value)),
      ),
    )

    if (mealImagePaths.length === 0) {
      setMealImageUrls({})
      return
    }

    let cancelled = false

    const loadMealImageUrls = async () => {
      try {
        const urls = await getMealImageUrls(mealImagePaths)
        if (!cancelled) {
          setMealImageUrls(urls)
        }
      } catch (error) {
        console.error('Error loading meal image URLs:', error)
        if (!cancelled) {
          setMealImageUrls({})
        }
      }
    }

    loadMealImageUrls()

    return () => {
      cancelled = true
    }
  }, [meals])

  const handleRefresh = useCallback(async () => {
    if (!user?.id || !resolvedLogDate) return

    setIsRefreshing(true)
    try {
      const { daySummary, dayMeals, recentMeals } = await fetchFoodLogData(
        user.id,
        resolvedLogDate,
      )
      setSummary(daySummary)
      setMeals(dayMeals)
      setRecentMealsRaw(recentMeals)
    } catch (error) {
      console.error('Error refreshing daily food log:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchFoodLogData, resolvedLogDate, user?.id])

  const handleBack = () => {
    haptic('light')
    setShouldExit(true)
  }

  const totals = summary?.totals ?? prefillTotals
  const goals = summary?.goals ?? prefillGoals

  const calories = totals.calories ?? 0
  const protein = totals.protein_g ?? 0
  const carbs = totals.carbs_g ?? 0
  const fat = totals.fat_g ?? 0
  const calorieGoal = resolveCalorieGoal(goals.calorie_goal, profile)
  const proteinGoal = goals.protein_goal_g || 150
  const carbGoal = 250
  const fatGoal = 70

  const calProgress = Math.min(
    Math.max(calories / Math.max(calorieGoal, 1), 0),
    1,
  )
  const proteinProgress = Math.min(
    Math.max(protein / Math.max(proteinGoal, 1), 0),
    1,
  )
  const carbProgress = Math.min(Math.max(carbs / Math.max(carbGoal, 1), 0), 1)
  const fatProgress = Math.min(Math.max(fat / Math.max(fatGoal, 1), 0), 1)

  const heroSize = 112
  const heroStroke = 10
  const heroRadius = (heroSize - heroStroke) / 2
  const heroCircumference = heroRadius * 2 * Math.PI

  const macroRingSize = 48
  const macroRingStroke = 4.5
  const macroRingRadius = (macroRingSize - macroRingStroke) / 2
  const macroRingCircumference = macroRingRadius * 2 * Math.PI

  const activeDate =
    resolvedLogDate ?? getLocalDateKey(new Date().toISOString())
  const recentMeals = useMemo(() => {
    const seen = new Set<string>()

    return recentMealsRaw
      .filter((meal) => getLocalDateKey(meal.created_at) !== activeDate)
      .filter((meal) => {
        const key = buildRecentMealFingerprint(meal)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 8)
  }, [activeDate, recentMealsRaw])

  const handleRelogRecentMeal = async (meal: DailyLogMeal) => {
    if (!user?.id || !resolvedLogDate || reloggingMealId) return

    haptic('medium')
    setReloggingMealId(meal.id)

    try {
      await database.dailyLog.logMeal(user.id, {
        description: meal.description,
        calories: meal.calories,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
        source: 'manual',
        confidence: meal.confidence,
        metadata: {
          ...(meal.metadata ?? {}),
          from: 'recent_meals_relog',
          reloggedFromMealId: meal.id,
        },
        logDate: resolvedLogDate,
      })

      trackEvent(AnalyticsEvents.FOOD_LOGGED, {
        source: 'recent_meals_relog',
        calories: meal.calories,
        has_macros: Boolean(meal.protein_g || meal.carbs_g || meal.fat_g),
      })

      await hapticSuccess()
      await handleRefresh()
    } catch (error) {
      console.error('Error relogging recent meal:', error)
      Alert.alert('Could not add meal', 'Please try again.')
    } finally {
      setReloggingMealId(null)
    }
  }

  const handleDeleteMeal = useCallback(
    async (meal: DailyLogMeal) => {
      if (!user?.id || deletingMealId) return

      setDeletingMealId(meal.id)

      try {
        await database.dailyLog.deleteMeal(user.id, meal.id)
        await hapticSuccess()
        await handleRefresh()
      } catch (error) {
        console.error('Error deleting meal from daily food log:', error)
        Alert.alert('Could not remove meal', 'Please try again.')
      } finally {
        setDeletingMealId(null)
      }
    },
    [deletingMealId, handleRefresh, user?.id],
  )

  const handleConfirmDeleteMeal = useCallback(
    (meal: DailyLogMeal) => {
      if (deletingMealId) return

      haptic('medium')

      const mealLabel =
        meal.description.length > 64
          ? `${meal.description.slice(0, 61).trimEnd()}...`
          : meal.description

      Alert.alert(
        'Remove meal?',
        `"${mealLabel}" will be removed from this food log.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              void handleDeleteMeal(meal)
            },
          },
        ],
      )
    },
    [deletingMealId, handleDeleteMeal],
  )

  const contentTopPadding = insets.top + HEADER_ROW_HEIGHT + 16

  return (
    <SlideInView
      style={{ flex: 1, backgroundColor: colors.bg }}
      shouldExit={shouldExit}
      onExitComplete={() => router.back()}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />

        <BlurredHeader>
          <ScreenHeader
            title="Food Log"
            onLeftPress={handleBack}
            leftIcon="arrow-back"
            onRightPress={handleOpenFoodLibrary}
            rightIcon="add"
          />
        </BlurredHeader>

        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ top: insets.top + HEADER_ROW_HEIGHT }}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: contentTopPadding,
              paddingBottom: insets.bottom + 28,
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brandPrimary}
              progressViewOffset={contentTopPadding}
            />
          }
        >
          <View style={styles.dateTabs}>
            <View style={styles.dateTabActive}>
              <Text
                style={[
                  styles.dateTabTextActive,
                  { color: colors.textPrimary },
                ]}
              >
                {formatHeaderDate(activeDate)}
              </Text>
            </View>
          </View>

          <View style={styles.heroSection}>
            <View
              style={[
                styles.caloriesCard,
                { backgroundColor: colors.surfaceCard },
              ]}
            >
              <View style={styles.caloriesTextCol}>
                <View style={styles.caloriesValueRow}>
                  <Text
                    style={[
                      styles.caloriesValue,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {round(calories)}
                  </Text>
                  <Text
                    style={[
                      styles.caloriesGoal,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {' '}
                    / {round(calorieGoal)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.caloriesLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Calories
                </Text>
              </View>

              <View style={styles.caloriesRingWrap}>
                <Svg width={heroSize} height={heroSize}>
                  <G rotation="-90" origin={`${heroSize / 2}, ${heroSize / 2}`}>
                    <Circle
                      cx={heroSize / 2}
                      cy={heroSize / 2}
                      r={heroRadius}
                      stroke={isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF'}
                      strokeWidth={heroStroke}
                      fill="transparent"
                    />
                    <Circle
                      cx={heroSize / 2}
                      cy={heroSize / 2}
                      r={heroRadius}
                      stroke={colors.textPrimary}
                      strokeWidth={heroStroke}
                      fill="transparent"
                      strokeDasharray={`${heroCircumference}`}
                      strokeDashoffset={`${
                        heroCircumference * (1 - calProgress)
                      }`}
                      strokeLinecap="round"
                    />
                  </G>
                </Svg>
                <View style={styles.caloriesRingCenter}>
                  <MaterialCommunityIcons
                    name="fire"
                    size={32}
                    color={colors.textPrimary}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.macroRow}>
            {[
              {
                key: 'protein',
                label: 'Protein',
                value: protein,
                goal: proteinGoal,
                color: '#F87171',
                progress: proteinProgress,
                icon: (
                  <MaterialCommunityIcons
                    name="food-drumstick"
                    size={20}
                    color="#F87171"
                  />
                ),
                over: protein > proteinGoal,
              },
              {
                key: 'carbs',
                label: 'Carbs',
                value: carbs,
                goal: carbGoal,
                color: '#FBBF24',
                progress: carbProgress,
                icon: <Ionicons name="nutrition" size={20} color="#FBBF24" />,
                over: carbs > carbGoal,
              },
              {
                key: 'fat',
                label: 'Fats',
                value: fat,
                goal: fatGoal,
                color: '#60A5FA',
                progress: fatProgress,
                icon: (
                  <MaterialCommunityIcons
                    name="water"
                    size={20}
                    color="#60A5FA"
                  />
                ),
                over: fat > fatGoal,
              },
            ].map((macro) => (
              <View
                key={macro.key}
                style={[
                  styles.macroCard,
                  { backgroundColor: colors.surfaceCard },
                ]}
              >
                <View style={styles.macroCardHeader}>
                  <Text
                    style={[
                      styles.macroCardValue,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {round(macro.value)}g
                  </Text>
                  <Text
                    style={[
                      styles.macroCardLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {macro.label}
                  </Text>
                </View>
                <View style={styles.macroCardRingWrap}>
                  <Svg width={macroRingSize} height={macroRingSize}>
                    <G
                      rotation="-90"
                      origin={`${macroRingSize / 2}, ${macroRingSize / 2}`}
                    >
                      <Circle
                        cx={macroRingSize / 2}
                        cy={macroRingSize / 2}
                        r={macroRingRadius}
                        stroke={`${macro.color}20`}
                        strokeWidth={macroRingStroke}
                        fill="transparent"
                      />
                      <Circle
                        cx={macroRingSize / 2}
                        cy={macroRingSize / 2}
                        r={macroRingRadius}
                        stroke={macro.color}
                        strokeWidth={macroRingStroke}
                        fill="transparent"
                        strokeDasharray={`${macroRingCircumference}`}
                        strokeDashoffset={`${
                          macroRingCircumference * (1 - macro.progress)
                        }`}
                        strokeLinecap="round"
                      />
                    </G>
                  </Svg>
                  <View style={styles.macroCardRingIcon}>{macro.icon}</View>
                </View>
              </View>
            ))}
          </View>

          {false && (isRecentMealsLoading || recentMeals.length > 0) && (
            <>
              <View style={styles.sectionHeader}>
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  Recent Meals
                </Text>
                <Text
                  style={[styles.sectionMeta, { color: colors.textSecondary }]}
                >
                  Tap to relog fast
                </Text>
              </View>

              <View
                style={[
                  styles.recentMealsShell,
                  {
                    backgroundColor: colors.surfaceCard,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.recentMealsShellHeader}>
                  <View
                    style={[
                      styles.recentMealsHeaderBadge,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(17,17,17,0.04)',
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="flash-outline"
                      size={13}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.recentMealsHeaderBadgeText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Reuse your go-to meals
                    </Text>
                  </View>
                </View>

                {isRecentMealsLoading ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.recentMealsRailContent}
                  >
                    {[0, 1].map((placeholder) => (
                      <View
                        key={`recent-placeholder-${placeholder}`}
                        style={[
                          styles.recentMealSkeletonCard,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.03)'
                              : '#FBFBFD',
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.recentMealSkeletonAccent,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(17,17,17,0.08)',
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.recentMealSkeletonLine,
                            styles.recentMealSkeletonLineWide,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.06)'
                                : 'rgba(17,17,17,0.06)',
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.recentMealSkeletonLine,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.05)'
                                : 'rgba(17,17,17,0.05)',
                            },
                          ]}
                        />
                        <View style={styles.recentMealSkeletonChipRow}>
                          {[0, 1, 2].map((chip) => (
                            <View
                              key={`chip-${chip}`}
                              style={[
                                styles.recentMealSkeletonChip,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.05)'
                                    : 'rgba(17,17,17,0.05)',
                                },
                              ]}
                            />
                          ))}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.recentMealsRailContent}
                    decelerationRate="fast"
                  >
                    {recentMeals.map((meal, index) => {
                      const isRelogging = reloggingMealId === meal.id
                      const accentColor =
                        index % 4 === 0
                          ? '#FF8C42'
                          : index % 4 === 1
                          ? '#2FBF9F'
                          : index % 4 === 2
                          ? '#4F6DFF'
                          : '#E85D75'

                      return (
                        <TouchableOpacity
                          key={meal.id}
                          style={[
                            styles.recentMealCard,
                            Boolean(reloggingMealId) &&
                              !isRelogging &&
                              styles.recentMealCardMuted,
                          ]}
                          activeOpacity={0.9}
                          disabled={Boolean(reloggingMealId)}
                          onPress={() => handleRelogRecentMeal(meal)}
                        >
                          <LinearGradient
                            colors={
                              isDark
                                ? [
                                    'rgba(255,255,255,0.04)',
                                    'rgba(255,255,255,0.015)',
                                  ]
                                : ['#FFFFFF', '#F7F7FA']
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[
                              styles.recentMealCardGradient,
                              { borderColor: colors.border },
                            ]}
                          >
                            <View
                              style={[
                                styles.recentMealAccentBar,
                                { backgroundColor: accentColor },
                              ]}
                            />

                            <View style={styles.recentMealCardTop}>
                              <View
                                style={[
                                  styles.recentMealSourcePill,
                                  {
                                    backgroundColor: isDark
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(17,17,17,0.04)',
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                <Ionicons
                                  name={getMealSourceIcon(meal.source)}
                                  size={12}
                                  color={colors.textSecondary}
                                />
                                <Text
                                  style={[
                                    styles.recentMealSourcePillText,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  {formatRecentDateBadge(meal.created_at)}
                                </Text>
                              </View>

                              <View
                                style={[
                                  styles.recentMealConfidenceDot,
                                  {
                                    backgroundColor:
                                      meal.confidence === 'high'
                                        ? '#34C759'
                                        : meal.confidence === 'low'
                                        ? '#FF9F0A'
                                        : isDark
                                        ? 'rgba(255,255,255,0.18)'
                                        : 'rgba(17,17,17,0.16)',
                                  },
                                ]}
                              />
                            </View>

                            <Text
                              numberOfLines={2}
                              style={[
                                styles.recentMealTitle,
                                { color: colors.textPrimary },
                              ]}
                            >
                              {meal.description}
                            </Text>

                            <Text
                              style={[
                                styles.recentMealSubtitle,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {formatMealTime(meal.created_at)} •{' '}
                              {round(meal.calories)} kcal
                            </Text>

                            <View style={styles.recentMealMacroRow}>
                              {[
                                {
                                  label: 'P',
                                  value: round(meal.protein_g),
                                  color: '#F87171',
                                },
                                {
                                  label: 'C',
                                  value: round(meal.carbs_g),
                                  color: '#FBBF24',
                                },
                                {
                                  label: 'F',
                                  value: round(meal.fat_g),
                                  color: '#60A5FA',
                                },
                              ].map((macro) => (
                                <View
                                  key={`${meal.id}-${macro.label}`}
                                  style={[
                                    styles.recentMealMacroChip,
                                    {
                                      backgroundColor: `${macro.color}14`,
                                      borderColor: `${macro.color}2B`,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.recentMealMacroLabel,
                                      { color: macro.color },
                                    ]}
                                  >
                                    {macro.label}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.recentMealMacroValue,
                                      { color: colors.textPrimary },
                                    ]}
                                  >
                                    {macro.value}g
                                  </Text>
                                </View>
                              ))}
                            </View>

                            <View style={styles.recentMealFooter}>
                              <View style={styles.recentMealRelogCta}>
                                {isRelogging ? (
                                  <ActivityIndicator
                                    size="small"
                                    color={colors.textPrimary}
                                  />
                                ) : (
                                  <Ionicons
                                    name="add-circle-outline"
                                    size={18}
                                    color={colors.textPrimary}
                                  />
                                )}
                                <Text
                                  style={[
                                    styles.recentMealRelogText,
                                    { color: colors.textPrimary },
                                  ]}
                                >
                                  {isRelogging ? 'Adding...' : 'Log Again'}
                                </Text>
                              </View>
                            </View>
                          </LinearGradient>
                        </TouchableOpacity>
                      )
                    })}
                  </ScrollView>
                )}
              </View>
            </>
          )}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Meals
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.brandPrimary} />
            </View>
          ) : meals.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="restaurant-outline"
                size={28}
                color={colors.textTertiary}
              />
              <Text
                style={[styles.emptyTitle, { color: colors.textSecondary }]}
              >
                No meals logged
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: colors.textTertiary }]}
              >
                Log food in chat to see your meals and macros for this day.
              </Text>
            </View>
          ) : (
            <View style={styles.mealsList}>
              {meals.map((meal, index) => {
                const isDeletingMeal = deletingMealId === meal.id
                const disableMealActions = Boolean(deletingMealId)
                const mealImagePath = getDailyLogMealImagePath(meal)
                const mealImageUrl = mealImagePath
                  ? mealImageUrls[mealImagePath]
                  : null

                return (
                  <View
                    key={meal.id}
                    style={[
                      styles.mealCard,
                      { backgroundColor: colors.surfaceCard },
                    ]}
                  >
                    <View
                      style={[
                        styles.mealImagePlaceholder,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.05)'
                            : '#F0F0F3',
                        },
                      ]}
                    >
                      {mealImageUrl ? (
                        <Image
                          source={{ uri: mealImageUrl }}
                          style={styles.mealImage}
                          contentFit="cover"
                          transition={180}
                        />
                      ) : (
                        <Ionicons
                          name="restaurant-outline"
                          size={24}
                          color={colors.textTertiary}
                        />
                      )}
                    </View>

                    <View style={styles.mealCardContent}>
                      <View style={styles.mealCardTop}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.mealCardTitle,
                            { color: colors.textPrimary },
                          ]}
                        >
                          {meal.description}
                        </Text>
                        <Text
                          style={[
                            styles.mealCardTime,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {formatMealTime(meal.created_at)}
                        </Text>
                      </View>

                      <View style={styles.mealCardMiddle}>
                        <MaterialCommunityIcons
                          name="fire"
                          size={14}
                          color={colors.textPrimary}
                        />
                        <Text
                          style={[
                            styles.mealCardCalories,
                            { color: colors.textPrimary },
                          ]}
                        >
                          {round(meal.calories)} kcal
                        </Text>
                      </View>

                      <View style={styles.mealCardBottom}>
                        <View style={styles.mealCardMacro}>
                          <MaterialCommunityIcons
                            name="food-drumstick"
                            size={14}
                            color="#F87171"
                          />
                          <Text
                            style={[
                              styles.mealCardMacroText,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {round(meal.protein_g)}g
                          </Text>
                        </View>
                        <View style={styles.mealCardMacro}>
                          <Ionicons
                            name="nutrition"
                            size={14}
                            color="#FBBF24"
                          />
                          <Text
                            style={[
                              styles.mealCardMacroText,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {round(meal.carbs_g)}g
                          </Text>
                        </View>
                        <View style={styles.mealCardMacro}>
                          <Ionicons name="water" size={14} color="#60A5FA" />
                          <Text
                            style={[
                              styles.mealCardMacroText,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {round(meal.fat_g)}g
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.removeMealButton,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255,82,82,0.12)'
                                : 'rgba(255,59,48,0.08)',
                              borderColor: isDark
                                ? 'rgba(255,82,82,0.24)'
                                : 'rgba(255,59,48,0.16)',
                            },
                            disableMealActions &&
                              !isDeletingMeal &&
                              styles.removeMealButtonDisabled,
                          ]}
                          onPress={() => handleConfirmDeleteMeal(meal)}
                          disabled={disableMealActions}
                          activeOpacity={0.85}
                        >
                          {isDeletingMeal ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.statusError}
                            />
                          ) : (
                            <Ionicons
                              name="trash-outline"
                              size={14}
                              color={colors.statusError}
                            />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          {resolveError && (
            <Text style={[styles.errorText, { color: '#FF6B6B' }]}>
              {resolveError}
            </Text>
          )}
        </ScrollView>
      </View>
    </SlideInView>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
    },
    heroSection: {
      gap: 16,
      marginBottom: 28,
    },
    dateTabs: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 20,
    },
    dateTabActive: {
      alignItems: 'center',
      gap: 4,
    },
    dateTabTextActive: {
      fontSize: 16,
      fontWeight: '700',
    },
    caloriesCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 24,
      padding: 24,
    },
    caloriesTextCol: {
      gap: 4,
    },
    caloriesValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    caloriesValue: {
      fontSize: 40,
      fontWeight: '800',
      letterSpacing: -1,
    },
    caloriesGoal: {
      fontSize: 18,
      fontWeight: '600',
    },
    caloriesLabel: {
      fontSize: 14,
      fontWeight: '500',
    },
    caloriesRingWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    caloriesRingCenter: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    macroRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    macroCard: {
      flex: 1,
      borderRadius: 20,
      padding: 16,
      gap: 16,
    },
    macroCardHeader: {
      gap: 2,
    },
    macroCardValue: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.5,
    },
    macroCardLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    macroCardRingWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    macroCardRingIcon: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    mealCard: {
      flexDirection: 'row',
      borderRadius: 20,
      padding: 12,
      marginBottom: 12,
      gap: 16,
    },
    mealImagePlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    mealImage: {
      width: '100%',
      height: '100%',
    },
    mealCardContent: {
      flex: 1,
      justifyContent: 'center',
      gap: 6,
    },
    mealCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    mealCardTitle: {
      fontSize: 16,
      fontWeight: '700',
      flex: 1,
      marginRight: 8,
    },
    mealCardTime: {
      fontSize: 12,
      fontWeight: '500',
    },
    mealCardMiddle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    mealCardCalories: {
      fontSize: 14,
      fontWeight: '600',
    },
    mealCardBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    mealCardMacro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    mealCardMacroText: {
      fontSize: 13,
      fontWeight: '500',
    },
    removeMealButton: {
      marginLeft: 'auto',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      width: 28,
      height: 28,
    },
    removeMealButtonDisabled: {
      opacity: 0.45,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: 20,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.4,
    },
    sectionMeta: {
      fontSize: 13,
      fontWeight: '500',
    },
    recentMealsShell: {
      borderRadius: 22,
      borderWidth: 1,
      overflow: 'hidden',
      paddingTop: 10,
      paddingBottom: 12,
    },
    recentMealsShellHeader: {
      paddingHorizontal: 12,
      paddingBottom: 6,
    },
    recentMealsHeaderBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    recentMealsHeaderBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.1,
    },
    recentMealsRailContent: {
      paddingHorizontal: 12,
      gap: 10,
    },
    recentMealCard: {
      width: 250,
    },
    recentMealCardMuted: {
      opacity: 0.55,
    },
    recentMealCardGradient: {
      borderRadius: 18,
      borderWidth: 1,
      overflow: 'hidden',
      padding: 12,
      minHeight: 162,
    },
    recentMealAccentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      opacity: 0.95,
    },
    recentMealCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
      paddingLeft: 4,
    },
    recentMealSourcePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      maxWidth: '90%',
    },
    recentMealSourcePillText: {
      fontSize: 11,
      fontWeight: '600',
    },
    recentMealConfidenceDot: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
      marginRight: 2,
    },
    recentMealTitle: {
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.25,
      lineHeight: 19,
      minHeight: 38,
      paddingLeft: 4,
    },
    recentMealSubtitle: {
      marginTop: 6,
      fontSize: 12,
      fontWeight: '500',
      paddingLeft: 4,
    },
    recentMealMacroRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 10,
      paddingLeft: 4,
      flexWrap: 'wrap',
    },
    recentMealMacroChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    recentMealMacroLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    recentMealMacroValue: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: -0.1,
    },
    recentMealFooter: {
      marginTop: 12,
      paddingTop: 12,
      paddingLeft: 4,
    },
    recentMealRelogCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    recentMealRelogText: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: -0.1,
    },
    recentMealSkeletonCard: {
      width: 250,
      borderRadius: 18,
      borderWidth: 1,
      padding: 12,
      minHeight: 162,
    },
    recentMealSkeletonAccent: {
      width: 48,
      height: 20,
      borderRadius: 999,
      marginBottom: 12,
      marginLeft: 4,
    },
    recentMealSkeletonLine: {
      height: 11,
      borderRadius: 999,
      width: '58%',
      marginBottom: 8,
      marginLeft: 4,
    },
    recentMealSkeletonLineWide: {
      width: '78%',
      height: 14,
      marginBottom: 10,
    },
    recentMealSkeletonChipRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 8,
      marginLeft: 4,
    },
    recentMealSkeletonChip: {
      width: 50,
      height: 20,
      borderRadius: 999,
    },
    loadingState: {
      paddingVertical: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '600',
      marginTop: 4,
    },
    emptySubtitle: {
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: 18,
      maxWidth: 260,
    },
    mealsList: {
      gap: 0,
    },
    errorText: {
      paddingHorizontal: 4,
      fontSize: 12,
      fontWeight: '600',
    },
  })
