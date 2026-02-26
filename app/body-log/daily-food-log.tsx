import { BlurredHeader } from '@/components/blurred-header'
import { ScreenHeader } from '@/components/screen-header'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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

function getMealSourceIcon(source: DailyLogMeal['source']): keyof typeof Ionicons.glyphMap {
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
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  const prefillTotals = useMemo(
    () => parseJson<DailyTotals>(params.totalsJson, DEFAULT_TOTALS),
    [params.totalsJson],
  )
  const prefillGoals = useMemo(
    () => parseJson<DailyGoals>(params.goalsJson, DEFAULT_GOALS),
    [params.goalsJson],
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
      setResolveError(null)

      try {
        const [daySummary, dayMeals] = await Promise.all([
          database.dailyLog.getDaySummary(user.id, resolvedLogDate),
          database.dailyLog.getMealsForDay(user.id, resolvedLogDate),
        ])

        if (cancelled) return
        setSummary(daySummary)
        setMeals(dayMeals)
      } catch (error) {
        console.error('Error loading daily food log:', error)
        if (!cancelled) {
          setSummary(null)
          setMeals([])
          setResolveError('Failed to load food log for this day.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [resolvedLogDate, user?.id])

  const handleRefresh = async () => {
    if (!user?.id || !resolvedLogDate) return

    setIsRefreshing(true)
    try {
      const [daySummary, dayMeals] = await Promise.all([
        database.dailyLog.getDaySummary(user.id, resolvedLogDate),
        database.dailyLog.getMealsForDay(user.id, resolvedLogDate),
      ])
      setSummary(daySummary)
      setMeals(dayMeals)
    } catch (error) {
      console.error('Error refreshing daily food log:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

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
  const mealCount = totals.meal_count ?? meals.length

  const calorieGoal = goals.calorie_goal || 2500
  const proteinGoal = goals.protein_goal_g || 150
  const carbGoal = 250
  const fatGoal = 70

  const calProgress = Math.min(Math.max(calories / Math.max(calorieGoal, 1), 0), 1)
  const proteinProgress = Math.min(Math.max(protein / Math.max(proteinGoal, 1), 0), 1)
  const carbProgress = Math.min(Math.max(carbs / Math.max(carbGoal, 1), 0), 1)
  const fatProgress = Math.min(Math.max(fat / Math.max(fatGoal, 1), 0), 1)

  const calOver = calories > calorieGoal
  const calDelta = Math.round(calOver ? calories - calorieGoal : calorieGoal - calories)

  const heroSize = 112
  const heroStroke = 10
  const heroRadius = (heroSize - heroStroke) / 2
  const heroCircumference = heroRadius * 2 * Math.PI

  const macroRingSize = 54
  const macroRingStroke = 5
  const macroRingRadius = (macroRingSize - macroRingStroke) / 2
  const macroRingCircumference = macroRingRadius * 2 * Math.PI

  const activeDate = resolvedLogDate ?? getLocalDateKey(new Date().toISOString())
  const calorieBase = Math.max(calories, 1)
  const proteinPct = round(((protein * 4) / calorieBase) * 100)
  const carbsPct = round(((carbs * 4) / calorieBase) * 100)
  const fatPct = round(((fat * 9) / calorieBase) * 100)

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
          />
        </BlurredHeader>

        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ top: insets.top + HEADER_ROW_HEIGHT }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: contentTopPadding, paddingBottom: insets.bottom + 28 },
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
          <View style={styles.heroCard}>
            <View style={styles.heroCardAccent} />
            <View style={styles.heroTopRow}>
              <View>
                <Text style={[styles.heroEyebrow, { color: colors.textSecondary }]}>
                  Daily Food Log
                </Text>
                <Text style={[styles.heroDate, { color: colors.textPrimary }]}>
                  {formatHeaderDate(activeDate)}
                </Text>
              </View>
              <View
                style={[
                  styles.mealBadge,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(17,17,17,0.04)',
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="restaurant-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.mealBadgeText, { color: colors.textSecondary }]}>
                  {mealCount} {mealCount === 1 ? 'meal' : 'meals'}
                </Text>
              </View>
            </View>

            <View style={styles.heroBody}>
              <View style={styles.heroTextCol}>
                <Text style={[styles.heroValue, calOver && { color: '#FF6B6B' }]}>
                  {calDelta}
                </Text>
                <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                  {calOver ? 'Calories over target' : 'Calories remaining'}
                </Text>
                <Text style={[styles.heroSubValue, { color: colors.textPrimary }]}>
                  {round(calories)} / {round(calorieGoal)} kcal
                </Text>
              </View>

              <View style={styles.heroRingWrap}>
                <Svg width={heroSize} height={heroSize}>
                  <G rotation="-90" origin={`${heroSize / 2}, ${heroSize / 2}`}>
                    <Circle
                      cx={heroSize / 2}
                      cy={heroSize / 2}
                      r={heroRadius}
                      stroke={isDark ? 'rgba(255,255,255,0.10)' : '#E8E8ED'}
                      strokeWidth={heroStroke}
                      fill="transparent"
                    />
                    <Circle
                      cx={heroSize / 2}
                      cy={heroSize / 2}
                      r={heroRadius}
                      stroke={calOver ? '#FF6B6B' : colors.textPrimary}
                      strokeWidth={heroStroke}
                      fill="transparent"
                      strokeDasharray={`${heroCircumference}`}
                      strokeDashoffset={`${heroCircumference * (1 - calProgress)}`}
                      strokeLinecap="round"
                    />
                  </G>
                </Svg>
                <View style={styles.heroRingCenter}>
                  <Ionicons
                    name={calOver ? 'warning-outline' : 'flame-outline'}
                    size={24}
                    color={calOver ? '#FF6B6B' : colors.textPrimary}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Macros</Text>
            <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>
              Targets + actuals
            </Text>
          </View>

          <View style={styles.macroGrid}>
            {[
              {
                key: 'protein',
                label: 'Protein',
                value: protein,
                goal: proteinGoal,
                color: '#F87171',
                icon: (
                  <MaterialCommunityIcons name="food-drumstick" size={16} color="#F87171" />
                ),
                progress: proteinProgress,
              },
              {
                key: 'carbs',
                label: 'Carbs',
                value: carbs,
                goal: carbGoal,
                color: '#FBBF24',
                icon: <Ionicons name="nutrition-outline" size={16} color="#FBBF24" />,
                progress: carbProgress,
              },
              {
                key: 'fat',
                label: 'Fat',
                value: fat,
                goal: fatGoal,
                color: '#60A5FA',
                icon: <Ionicons name="water-outline" size={16} color="#60A5FA" />,
                progress: fatProgress,
              },
            ].map((macro) => (
              <View key={macro.key} style={styles.macroCard}>
                <View style={styles.macroCardTop}>
                  <Text style={[styles.macroValue, { color: colors.textPrimary }]}>
                    {round(macro.value)}g
                  </Text>
                  <View style={styles.macroRingWrap}>
                    <Svg width={macroRingSize} height={macroRingSize}>
                      <G
                        rotation="-90"
                        origin={`${macroRingSize / 2}, ${macroRingSize / 2}`}
                      >
                        <Circle
                          cx={macroRingSize / 2}
                          cy={macroRingSize / 2}
                          r={macroRingRadius}
                          stroke={`${macro.color}24`}
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
                    <View style={styles.macroRingIcon}>{macro.icon}</View>
                  </View>
                </View>
                <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>
                  {macro.label}
                </Text>
                <Text style={[styles.macroGoalText, { color: colors.textSecondary }]}>
                  Goal {round(macro.goal)}g
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.breakdownCard}>
            <View style={styles.breakdownHeader}>
              <Text style={[styles.breakdownTitle, { color: colors.textPrimary }]}>
                Energy split
              </Text>
              <Text style={[styles.breakdownCaption, { color: colors.textSecondary }]}>
                Calories by macro
              </Text>
            </View>

            <View
              style={[
                styles.breakdownBar,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#ECECF1' },
              ]}
            >
              <View
                style={[
                  styles.breakdownSegment,
                  { flex: protein * 4 || 0.01, backgroundColor: '#F87171' },
                ]}
              />
              <View
                style={[
                  styles.breakdownSegment,
                  { flex: carbs * 4 || 0.01, backgroundColor: '#FBBF24' },
                ]}
              />
              <View
                style={[
                  styles.breakdownSegment,
                  { flex: fat * 9 || 0.01, backgroundColor: '#60A5FA' },
                ]}
              />
            </View>

            <View style={styles.breakdownLegend}>
              {[
                ['Protein', proteinPct, '#F87171'],
                ['Carbs', carbsPct, '#FBBF24'],
                ['Fat', fatPct, '#60A5FA'],
              ].map(([label, pct, color]) => (
                <View key={String(label)} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: String(color) }]} />
                  <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
                    {String(label)}
                  </Text>
                  <Text style={[styles.legendValue, { color: colors.textPrimary }]}>
                    {Number(pct)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Meals</Text>
            <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>
              {mealCount === 0 ? 'No meals yet' : `${mealCount} logged`}
            </Text>
          </View>

          <View style={styles.mealsCard}>
            {isLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.brandPrimary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading meals...
                </Text>
              </View>
            ) : meals.length === 0 ? (
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyIconWrap,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F7' },
                  ]}
                >
                  <Ionicons name="restaurant-outline" size={22} color={colors.textSecondary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  No meals logged
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Log food in chat to see your meals and macros for this day.
                </Text>
              </View>
            ) : (
              meals.map((meal, index) => (
                <View
                  key={meal.id}
                  style={[
                    styles.mealRow,
                    index < meals.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.mealRowTop}>
                    <View style={styles.mealRowTitleWrap}>
                      <View
                        style={[
                          styles.mealSourceChip,
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
                          size={13}
                          color={colors.textSecondary}
                        />
                      </View>
                      <Text
                        numberOfLines={2}
                        style={[styles.mealDescription, { color: colors.textPrimary }]}
                      >
                        {meal.description}
                      </Text>
                    </View>
                    <Text style={[styles.mealTime, { color: colors.textSecondary }]}>
                      {formatMealTime(meal.created_at)}
                    </Text>
                  </View>

                  <View style={styles.mealStatsRow}>
                    <Text style={[styles.mealCalories, { color: colors.textPrimary }]}>
                      {round(meal.calories)} kcal
                    </Text>
                    <Text style={[styles.mealMacros, { color: colors.textSecondary }]}>
                      P {round(meal.protein_g)}g  •  C {round(meal.carbs_g)}g  •  F {round(meal.fat_g)}g
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {resolveError && (
            <Text style={[styles.errorText, { color: '#FF6B6B' }]}>{resolveError}</Text>
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
      paddingHorizontal: 16,
      gap: 12,
    },
    heroCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 26,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      gap: 16,
    },
    heroCardAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: '#111111',
      opacity: isDark ? 0.35 : 0.12,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    heroEyebrow: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    heroDate: {
      marginTop: 4,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.6,
    },
    mealBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderWidth: 1,
    },
    mealBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    heroBody: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    heroTextCol: {
      flex: 1,
      gap: 4,
    },
    heroValue: {
      fontSize: 42,
      fontWeight: '800',
      letterSpacing: -1.6,
      lineHeight: 46,
    },
    heroLabel: {
      fontSize: 14,
      fontWeight: '500',
    },
    heroSubValue: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.2,
    },
    heroRingWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroRingCenter: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionHeader: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
      gap: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.4,
    },
    sectionMeta: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    macroGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    macroCard: {
      flex: 1,
      backgroundColor: colors.surfaceCard,
      borderRadius: 20,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 2,
    },
    macroCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      marginBottom: 4,
    },
    macroValue: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.4,
    },
    macroLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
    macroGoalText: {
      fontSize: 11,
      fontWeight: '500',
    },
    macroRingWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    macroRingIcon: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    breakdownCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    breakdownHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    breakdownTitle: {
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    breakdownCaption: {
      fontSize: 12,
      fontWeight: '500',
    },
    breakdownBar: {
      flexDirection: 'row',
      height: 8,
      borderRadius: 999,
      overflow: 'hidden',
    },
    breakdownSegment: {
      height: '100%',
    },
    breakdownLegend: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    legendItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    legendDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    legendLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    legendValue: {
      fontSize: 12,
      fontWeight: '700',
    },
    mealsCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    loadingState: {
      paddingVertical: 30,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    loadingText: {
      fontSize: 13,
      fontWeight: '500',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 30,
      gap: 10,
    },
    emptyIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    emptySubtitle: {
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: 18,
    },
    mealRow: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
    },
    mealRowTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    mealRowTitleWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    mealSourceChip: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginTop: 1,
    },
    mealDescription: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 18,
      letterSpacing: -0.15,
    },
    mealTime: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: 2,
    },
    mealStatsRow: {
      paddingLeft: 32,
      gap: 2,
    },
    mealCalories: {
      fontSize: 13,
      fontWeight: '700',
    },
    mealMacros: {
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    errorText: {
      marginTop: 2,
      paddingHorizontal: 4,
      fontSize: 12,
      fontWeight: '600',
    },
  })
