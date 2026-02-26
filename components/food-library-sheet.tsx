import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/contexts/theme-context'
import { FOOD_LIBRARY_COMMON_FOODS } from '@/data/food-library-common-foods'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import type { DailyLogMeal } from '@/types/database.types'

export type FoodLibraryMealDraft = {
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  source?: DailyLogMeal['source']
  confidence?: DailyLogMeal['confidence'] | null
  metadata?: Record<string, unknown> | null
}

type FoodLibraryTab = 'food_bank' | 'saved_meals' | 'recent_meals'

type SavedLibraryMeal = FoodLibraryMealDraft & {
  id: string
  saved_at: string
  origin: 'food_bank' | 'recent'
}

type FoodBankItem = {
  id: string
  code?: string
  name: string
  brand?: string | null
  servingSize?: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

type FoodLibrarySheetProps = {
  visible: boolean
  onClose: () => void
  userId?: string
  recentMeals: DailyLogMeal[]
  isRecentMealsLoading: boolean
  onLogMeal: (meal: FoodLibraryMealDraft) => Promise<void>
  onUseFoodText: (text: string) => void | Promise<void>
  presentation?: 'sheet' | 'page'
  showTopHeader?: boolean
  pageTopInsetOffset?: number
}

const TABS: { id: FoodLibraryTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'food_bank', label: 'Food Bank', icon: 'restaurant-outline' },
  { id: 'saved_meals', label: 'Saved Meals', icon: 'bookmark-outline' },
  { id: 'recent_meals', label: 'Recent Meals', icon: 'time-outline' },
]

const MAX_SAVED_MEALS = 100
const USDA_FDC_API_KEY = process.env.EXPO_PUBLIC_USDA_FDC_API_KEY?.trim() ?? ''
const USDA_SEARCH_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search'
const USDA_RESULT_LIMIT = 20

type UsdaFoodNutrient = {
  nutrientId?: number
  nutrientNumber?: string | number
  nutrientName?: string
  unitName?: string
  value?: number
}

type UsdaSearchFood = {
  fdcId?: number
  description?: string
  brandOwner?: string
  brandName?: string
  dataType?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients?: UsdaFoodNutrient[]
}

const getSavedMealsKey = (userId?: string) =>
  userId ? `food_library_saved_meals_v1:${userId}` : null

const round = (value: number) => Math.round(Number(value || 0))
const roundOne = (value: number) => Math.round(Number(value || 0) * 10) / 10

const buildMealFingerprint = (meal: {
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}) =>
  [
    meal.description.toLowerCase().replace(/\s+/g, ' ').trim(),
    round(meal.calories),
    round(meal.protein_g),
    round(meal.carbs_g),
    round(meal.fat_g),
  ].join('|')

const formatRecentBadge = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (target.getTime() === today.getTime()) return 'Today'
  if (target.getTime() === yesterday.getTime()) return 'Yesterday'

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatTime = (dateString: string) =>
  new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

const getSourceIcon = (
  source: DailyLogMeal['source'] | 'saved' | 'food_bank',
): keyof typeof Ionicons.glyphMap => {
  switch (source) {
    case 'photo':
      return 'camera-outline'
    case 'voice':
      return 'mic-outline'
    case 'manual':
      return 'create-outline'
    case 'correction':
      return 'sparkles-outline'
    case 'saved':
      return 'bookmark-outline'
    case 'food_bank':
      return 'cube-outline'
    case 'text':
    default:
      return 'chatbubble-ellipses-outline'
  }
}

const createFoodPrompt = (item: FoodBankItem): string => {
  const brand = item.brand ? ` (${item.brand})` : ''
  const serving = item.servingSize?.trim() || '1 serving'
  return `Log ${serving} of ${item.name}${brand} (${round(item.calories)} kcal, ${round(
    item.protein_g,
  )}p, ${round(item.carbs_g)}c, ${round(item.fat_g)}f)`
}

const getUsdaNutrientValue = (
  nutrients: UsdaFoodNutrient[] | undefined,
  options: {
    nutrientIds?: number[]
    nutrientNumbers?: string[]
    names?: string[]
    unitName?: string
  },
): number => {
  if (!Array.isArray(nutrients)) return 0

  const match = nutrients.find((nutrient) => {
    const nutrientId = Number(nutrient?.nutrientId ?? 0)
    const nutrientNumber = String(nutrient?.nutrientNumber ?? '').trim()
    const nutrientName = String(nutrient?.nutrientName ?? '').trim().toLowerCase()
    const unitName = String(nutrient?.unitName ?? '').trim().toUpperCase()

    const hasIdMatchers = Boolean(options.nutrientIds?.length)
    const hasNumberMatchers = Boolean(options.nutrientNumbers?.length)
    const hasNameMatchers = Boolean(options.names?.length)
    const hasAnyIdentifierMatchers = hasIdMatchers || hasNumberMatchers || hasNameMatchers

    const idOk = hasIdMatchers && options.nutrientIds!.includes(nutrientId)
    const numberOk =
      hasNumberMatchers && options.nutrientNumbers!.includes(nutrientNumber)
    const nameOk =
      hasNameMatchers &&
      options.names!.some((name) => nutrientName === name.toLowerCase())
    const unitOk =
      !options.unitName || unitName === options.unitName.toUpperCase()

    const identifierOk = !hasAnyIdentifierMatchers || idOk || numberOk || nameOk

    return identifierOk && unitOk
  })

  return Number(match?.value ?? 0) || 0
}

const formatUsdaServingSize = (food: UsdaSearchFood): string | null => {
  const household = String(food.householdServingFullText ?? '').trim()
  if (household) return household

  if (typeof food.servingSize === 'number' && Number.isFinite(food.servingSize)) {
    const unit = String(food.servingSizeUnit ?? '').trim()
    return `${roundOne(food.servingSize)}${unit ? ` ${unit}` : ''}`
  }

  // USDA search results often omit serving sizes for generic items. Use a clear fallback.
  return food.dataType?.toLowerCase().includes('branded') ? null : '100 g'
}

const mapUsdaFoodToFoodBankItem = (food: UsdaSearchFood): FoodBankItem | null => {
  const name = String(food.description ?? '').trim()
  const fdcId = Number(food.fdcId ?? 0)
  if (!name || !fdcId) return null

  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : []

  const calories =
    getUsdaNutrientValue(nutrients, {
      nutrientIds: [1008],
      nutrientNumbers: ['1008'],
      names: ['Energy'],
      unitName: 'KCAL',
    }) ||
    getUsdaNutrientValue(nutrients, {
      nutrientNumbers: ['1008'],
      names: ['Energy'],
    })
  const protein = getUsdaNutrientValue(nutrients, {
    nutrientIds: [1003],
    nutrientNumbers: ['1003'],
    names: ['Protein'],
  })
  const fat = getUsdaNutrientValue(nutrients, {
    nutrientIds: [1004],
    nutrientNumbers: ['1004'],
    names: ['Total lipid (fat)'],
  })
  const carbs = getUsdaNutrientValue(nutrients, {
    nutrientIds: [1005],
    nutrientNumbers: ['1005'],
    names: ['Carbohydrate, by difference'],
  })

  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null

  return {
    id: `usda-${fdcId}`,
    code: String(fdcId),
    name,
    brand: String(food.brandOwner || food.brandName || '').trim() || null,
    servingSize: formatUsdaServingSize(food),
    calories: Math.max(0, roundOne(calories)),
    protein_g: Math.max(0, roundOne(protein)),
    carbs_g: Math.max(0, roundOne(carbs)),
    fat_g: Math.max(0, roundOne(fat)),
  }
}

function normalizeRecentMealToDraft(meal: DailyLogMeal): FoodLibraryMealDraft {
  return {
    description: meal.description,
    calories: meal.calories,
    protein_g: meal.protein_g,
    carbs_g: meal.carbs_g,
    fat_g: meal.fat_g,
    source: 'manual',
    confidence: meal.confidence,
    metadata: {
      ...(meal.metadata ?? {}),
      from: 'food_library_recent_relog',
      reloggedFromMealId: meal.id,
    },
  }
}

function normalizeSavedMealToDraft(meal: SavedLibraryMeal): FoodLibraryMealDraft {
  return {
    description: meal.description,
    calories: meal.calories,
    protein_g: meal.protein_g,
    carbs_g: meal.carbs_g,
    fat_g: meal.fat_g,
    source: meal.source ?? 'manual',
    confidence: meal.confidence ?? null,
    metadata: {
      ...(meal.metadata ?? {}),
      from: 'food_library_saved_meal',
      savedMealId: meal.id,
    },
  }
}

export function FoodLibrarySheet({
  visible,
  onClose,
  userId,
  recentMeals,
  isRecentMealsLoading,
  onLogMeal,
  onUseFoodText,
  presentation = 'sheet',
  showTopHeader = true,
  pageTopInsetOffset = 0,
}: FoodLibrarySheetProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])
  const isPage = presentation === 'page'

  const [activeTab, setActiveTab] = useState<FoodLibraryTab>('food_bank')
  const [savedMeals, setSavedMeals] = useState<SavedLibraryMeal[]>([])
  const [isSavedMealsLoading, setIsSavedMealsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [foodBankResults, setFoodBankResults] = useState<FoodBankItem[]>([])
  const [isFoodBankLoading, setIsFoodBankLoading] = useState(false)
  const [foodBankError, setFoodBankError] = useState<string | null>(null)
  const [actionKey, setActionKey] = useState<string | null>(null)

  const recentMealsDeduped = useMemo(() => {
    const seen = new Set<string>()
    return recentMeals
      .filter((meal) => {
        const key = buildMealFingerprint(meal)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 20)
  }, [recentMeals])

  const savedFingerprints = useMemo(() => {
    const set = new Set<string>()
    savedMeals.forEach((meal) => set.add(buildMealFingerprint(meal)))
    return set
  }, [savedMeals])

  const persistSavedMeals = useCallback(
    async (nextMeals: SavedLibraryMeal[]) => {
      const key = getSavedMealsKey(userId)
      if (!key) return
      await AsyncStorage.setItem(key, JSON.stringify(nextMeals.slice(0, MAX_SAVED_MEALS)))
    },
    [userId],
  )

  useEffect(() => {
    if (!visible) return
    const key = getSavedMealsKey(userId)
    if (!key) {
      setSavedMeals([])
      return
    }

    let cancelled = false

    const load = async () => {
      setIsSavedMealsLoading(true)
      try {
        const raw = await AsyncStorage.getItem(key)
        if (cancelled) return
        if (!raw) {
          setSavedMeals([])
          return
        }

        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) {
          setSavedMeals([])
          return
        }

        setSavedMeals(
          parsed
            .filter(Boolean)
            .map((meal: any) => ({
              id: String(meal.id || `${Date.now()}-${Math.random()}`),
              description: String(meal.description || '').trim(),
              calories: Number(meal.calories || 0),
              protein_g: Number(meal.protein_g || 0),
              carbs_g: Number(meal.carbs_g || 0),
              fat_g: Number(meal.fat_g || 0),
              source:
                meal.source === 'photo' ||
                meal.source === 'voice' ||
                meal.source === 'manual' ||
                meal.source === 'correction'
                  ? meal.source
                  : 'manual',
              confidence:
                meal.confidence === 'low' ||
                meal.confidence === 'medium' ||
                meal.confidence === 'high'
                  ? meal.confidence
                  : null,
              metadata:
                meal.metadata && typeof meal.metadata === 'object'
                  ? (meal.metadata as Record<string, unknown>)
                  : null,
              saved_at:
                typeof meal.saved_at === 'string'
                  ? meal.saved_at
                  : new Date().toISOString(),
              origin: (meal.origin === 'food_bank' ? 'food_bank' : 'recent') as
                | 'food_bank'
                | 'recent',
            }))
            .filter((meal) => meal.description.length > 0),
        )
      } catch (error) {
        console.error('[FoodLibrarySheet] Failed to load saved meals:', error)
        if (!cancelled) setSavedMeals([])
      } finally {
        if (!cancelled) setIsSavedMealsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId, visible])

  useEffect(() => {
    if (!visible || activeTab !== 'food_bank') return

    const query = searchQuery.trim()
    if (query.length < 2) {
      setFoodBankResults([])
      setFoodBankError(null)
      setIsFoodBankLoading(false)
      return
    }

    let cancelled = false
    const timeout = setTimeout(async () => {
      setIsFoodBankLoading(true)
      setFoodBankError(null)

      try {
        if (!USDA_FDC_API_KEY) {
          throw new Error(
            'USDA FoodData Central API key is not configured (EXPO_PUBLIC_USDA_FDC_API_KEY).',
          )
        }

        const response = await fetch(`${USDA_SEARCH_ENDPOINT}?api_key=${encodeURIComponent(USDA_FDC_API_KEY)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            pageSize: USDA_RESULT_LIMIT,
          }),
        })
        if (!response.ok) {
          throw new Error(`USDA search failed (${response.status})`)
        }

        const json = await response.json()
        const foods = Array.isArray(json?.foods) ? (json.foods as UsdaSearchFood[]) : []

        const mapped: FoodBankItem[] = foods
          .map(mapUsdaFoodToFoodBankItem)
          .filter((item): item is FoodBankItem => Boolean(item))

        if (!cancelled) {
          setFoodBankResults(mapped)
        }
      } catch (error) {
        console.error('[FoodLibrarySheet] USDA food search error:', error)
        if (!cancelled) {
          setFoodBankResults([])
          setFoodBankError(
            error instanceof Error
              ? error.message
              : 'Could not load USDA food results. Try again.',
          )
        }
      } finally {
        if (!cancelled) {
          setIsFoodBankLoading(false)
        }
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [activeTab, searchQuery, visible])

  const addSavedMeal = useCallback(
    async (meal: SavedLibraryMeal) => {
      const fp = buildMealFingerprint(meal)
      if (savedFingerprints.has(fp)) return

      const next = [meal, ...savedMeals].slice(0, MAX_SAVED_MEALS)
      setSavedMeals(next)
      try {
        await persistSavedMeals(next)
      } catch (error) {
        console.error('[FoodLibrarySheet] Failed to save meal:', error)
      }
    },
    [persistSavedMeals, savedFingerprints, savedMeals],
  )

  const removeSavedMeal = useCallback(
    async (mealId: string) => {
      const next = savedMeals.filter((meal) => meal.id !== mealId)
      setSavedMeals(next)
      try {
        await persistSavedMeals(next)
      } catch (error) {
        console.error('[FoodLibrarySheet] Failed to remove saved meal:', error)
      }
    },
    [persistSavedMeals, savedMeals],
  )

  const handleSaveRecentMeal = async (meal: DailyLogMeal) => {
    haptic('light')
    await addSavedMeal({
      id: `saved-recent-${meal.id}`,
      description: meal.description,
      calories: meal.calories,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
      source: 'manual',
      confidence: meal.confidence,
      metadata: {
        ...(meal.metadata ?? {}),
        from: 'food_library_saved_recent',
        originalMealId: meal.id,
      },
      saved_at: new Date().toISOString(),
      origin: 'recent',
    })
  }

  const handleSaveFoodBankMeal = async (item: FoodBankItem) => {
    haptic('light')
    await addSavedMeal({
      id: `saved-food-bank-${item.id}-${Date.now()}`,
      description: item.brand ? `${item.name} (${item.brand})` : item.name,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      source: 'manual',
      confidence: null,
      metadata: {
        from: 'food_library_bank_item',
        code: item.code ?? null,
        servingSize: item.servingSize ?? null,
      },
      saved_at: new Date().toISOString(),
      origin: 'food_bank',
    })
  }

  const handleLogFromRecent = async (meal: DailyLogMeal) => {
    const key = `recent:${meal.id}`
    if (actionKey) return
    setActionKey(key)
    haptic('medium')
    try {
      await onLogMeal(normalizeRecentMealToDraft(meal))
      onClose()
    } finally {
      setActionKey(null)
    }
  }

  const handleLogFromSaved = async (meal: SavedLibraryMeal) => {
    const key = `saved:${meal.id}`
    if (actionKey) return
    setActionKey(key)
    haptic('medium')
    try {
      await onLogMeal(normalizeSavedMealToDraft(meal))
      onClose()
    } finally {
      setActionKey(null)
    }
  }

  const handleUseFoodBank = async (item: FoodBankItem) => {
    haptic('light')
    try {
      await onUseFoodText(createFoodPrompt(item))
      onClose()
    } catch (error) {
      console.error('[FoodLibrarySheet] Failed to hand off food prompt:', error)
    }
  }

  const renderFoodBankRow = (item: FoodBankItem) => {
    const saved = savedFingerprints.has(
      buildMealFingerprint({
        description: item.brand ? `${item.name} (${item.brand})` : item.name,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
      }),
    )

    return (
      <View key={item.id} style={styles.rowCard}>
        <View style={styles.rowCardTop}>
          <View style={styles.rowTitleBlock}>
            <Text numberOfLines={2} style={styles.rowTitle}>
              {item.name}
              {item.brand ? ` (${item.brand})` : ''}
            </Text>
            <Text style={styles.rowMeta}>{item.servingSize?.trim() || '1 serving'}</Text>
          </View>
        </View>

        {renderMacroChips(item)}

        <View style={styles.rowActions}>
          <TouchableOpacity
            style={styles.secondaryActionBtn}
            onPress={() => handleUseFoodBank(item)}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={14} color={colors.textPrimary} />
            <Text style={styles.secondaryActionText}>Use in Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, saved && styles.secondaryActionBtnActive]}
            onPress={() => handleSaveFoodBankMeal(item)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={14}
              color={saved ? colors.brandPrimary : colors.textPrimary}
            />
            <Text
              style={[
                styles.secondaryActionText,
                saved && { color: colors.brandPrimary },
              ]}
            >
              {saved ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const renderMacroChips = (meal: {
    calories?: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }) => (
    <View style={styles.chipRow}>
      {[
        { label: 'kcal', value: round(meal.calories ?? 0), tint: isDark ? '#C7CDD6' : '#5B6472', suffix: '' },
        { label: 'P', value: round(meal.protein_g), tint: '#F87171', suffix: 'g' },
        { label: 'C', value: round(meal.carbs_g), tint: '#FBBF24', suffix: 'g' },
        { label: 'F', value: round(meal.fat_g), tint: '#60A5FA', suffix: 'g' },
      ].map(({ label, value, tint, suffix }) => (
        <View
          key={`${label}-${value}`}
          style={[styles.macroChip, { backgroundColor: `${tint}14`, borderColor: `${tint}26` }]}
        >
          <Text style={[styles.macroChipLabel, { color: String(tint) }]}>{String(label)}</Text>
          <Text style={styles.macroChipValue}>
            {Number(value)}
            {suffix}
          </Text>
        </View>
      ))}
    </View>
  )

  if (!visible) return null

  const sheetBody = (
    <View style={isPage ? styles.pageRoot : styles.modalRoot}>
      {!isPage && (
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      )}

      <View
        style={[
          styles.sheet,
          isPage && styles.pageSheet,
          {
            paddingBottom: isPage ? 0 : Math.max(insets.bottom, 12) + 8,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.015)']
              : ['rgba(255,255,255,0.98)', 'rgba(248,248,251,0.96)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.sheetGradient,
            isPage &&
              (showTopHeader
                ? { paddingTop: Math.max(insets.top, 10) + 2 + pageTopInsetOffset }
                : { paddingTop: pageTopInsetOffset }),
          ]}
        >
          {!isPage && (
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>
          )}

          {showTopHeader && (
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Food Library</Text>
                <Text style={styles.subtitle}>
                  Find staples, reuse saved meals, and relog recent meals fast
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
                <Ionicons
                  name={isPage ? 'chevron-back' : 'close'}
                  size={20}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.tabsOuter}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsContent}
            >
              {TABS.map((tab) => {
                const active = tab.id === activeTab
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.tabBtn, active && styles.tabBtnActive]}
                    onPress={() => {
                      haptic('light')
                      setActiveTab(tab.id)
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={14}
                      color={active ? colors.bg : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.tabBtnText,
                        { color: active ? colors.bg : colors.textSecondary },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>

          {activeTab === 'food_bank' && (
            <View style={styles.searchWrap}>
              <Ionicons
                name="search-outline"
                size={16}
                color={colors.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search foods (e.g. chicken breast, greek yogurt)"
                placeholderTextColor={colors.textPlaceholder}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.searchClearBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={[
              styles.contentScrollInner,
              isPage && { paddingBottom: Math.max(insets.bottom, 12) + 16 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
              {activeTab === 'food_bank' && (
                <>
                  {searchQuery.trim().length < 2 ? (
                    <>
                      {FOOD_LIBRARY_COMMON_FOODS.map((item) => renderFoodBankRow(item))}
                    </>
                  ) : isFoodBankLoading ? (
                    <>
                      <View style={styles.loadingState}>
                        <ActivityIndicator color={colors.brandPrimary} />
                        <Text style={styles.loadingText}>Searching foods…</Text>
                      </View>
                    </>
                  ) : foodBankError ? (
                    <>
                      <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrap}>
                          <Ionicons name="alert-circle-outline" size={22} color={colors.textSecondary} />
                        </View>
                        <Text style={styles.emptyTitle}>Search unavailable</Text>
                        <Text style={styles.emptyBody}>{foodBankError}</Text>
                      </View>
                    </>
                  ) : foodBankResults.length === 0 ? (
                    <>
                      <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrap}>
                          <Ionicons name="search-outline" size={22} color={colors.textSecondary} />
                        </View>
                        <Text style={styles.emptyTitle}>No foods found</Text>
                        <Text style={styles.emptyBody}>
                          Try a simpler term, singular noun, or another food description.
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      {foodBankResults.map((item) => renderFoodBankRow(item))}
                    </>
                  )}
                </>
              )}

              {activeTab === 'saved_meals' && (
                <>
                  {isSavedMealsLoading ? (
                    <View style={styles.loadingState}>
                      <ActivityIndicator color={colors.brandPrimary} />
                      <Text style={styles.loadingText}>Loading saved meals…</Text>
                    </View>
                  ) : savedMeals.length === 0 ? (
                    <View style={styles.emptyState}>
                      <View style={styles.emptyIconWrap}>
                        <Ionicons name="bookmark-outline" size={22} color={colors.textSecondary} />
                      </View>
                      <Text style={styles.emptyTitle}>No saved meals yet</Text>
                      <Text style={styles.emptyBody}>
                        Save meals from Food Bank or Recent Meals for faster reuse.
                      </Text>
                    </View>
                  ) : (
                    savedMeals.map((meal) => {
                      const rowActionKey = `saved:${meal.id}`
                      const isActing = actionKey === rowActionKey
                      return (
                        <View key={meal.id} style={styles.rowCard}>
                          <View style={styles.rowCardTop}>
                            <View style={styles.rowTitleBlock}>
                              <View style={styles.rowSourcePill}>
                                <Ionicons
                                  name={getSourceIcon('saved')}
                                  size={12}
                                  color={colors.textSecondary}
                                />
                                <Text style={styles.rowSourcePillText}>Saved Meal</Text>
                              </View>
                              <Text numberOfLines={2} style={styles.rowTitle}>
                                {meal.description}
                              </Text>
                              <Text style={styles.rowMeta}>
                                {new Date(meal.saved_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </Text>
                            </View>
                          </View>

                          {renderMacroChips(meal)}

                          <View style={styles.rowActions}>
                            <TouchableOpacity
                              style={styles.primaryActionBtn}
                              onPress={() => handleLogFromSaved(meal)}
                              disabled={Boolean(actionKey)}
                              activeOpacity={0.85}
                            >
                              {isActing ? (
                                <ActivityIndicator size="small" color={colors.bg} />
                              ) : (
                                <Ionicons name="add-circle-outline" size={15} color={colors.bg} />
                              )}
                              <Text style={styles.primaryActionText}>
                                {isActing ? 'Logging…' : 'Log'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.secondaryActionBtn}
                              onPress={() => removeSavedMeal(meal.id)}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="trash-outline" size={14} color={colors.textPrimary} />
                              <Text style={styles.secondaryActionText}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )
                    })
                  )}
                </>
              )}

              {activeTab === 'recent_meals' && (
                <>
                  {isRecentMealsLoading ? (
                    <View style={styles.loadingState}>
                      <ActivityIndicator color={colors.brandPrimary} />
                      <Text style={styles.loadingText}>Loading recent meals…</Text>
                    </View>
                  ) : recentMealsDeduped.length === 0 ? (
                    <View style={styles.emptyState}>
                      <View style={styles.emptyIconWrap}>
                        <Ionicons name="time-outline" size={22} color={colors.textSecondary} />
                      </View>
                      <Text style={styles.emptyTitle}>No recent meals yet</Text>
                      <Text style={styles.emptyBody}>
                        Log a meal in chat and it will show up here for quick reuse.
                      </Text>
                    </View>
                  ) : (
                    recentMealsDeduped.map((meal) => {
                      const rowActionKey = `recent:${meal.id}`
                      const isActing = actionKey === rowActionKey
                      const isSaved = savedFingerprints.has(
                        buildMealFingerprint({
                          description: meal.description,
                          calories: meal.calories,
                          protein_g: meal.protein_g,
                          carbs_g: meal.carbs_g,
                          fat_g: meal.fat_g,
                        }),
                      )

                      return (
                        <View key={meal.id} style={styles.rowCard}>
                          <View style={styles.rowCardTop}>
                            <View style={styles.rowTitleBlock}>
                              <View style={styles.rowSourcePill}>
                                <Ionicons
                                  name={getSourceIcon(meal.source)}
                                  size={12}
                                  color={colors.textSecondary}
                                />
                                <Text style={styles.rowSourcePillText}>
                                  {formatRecentBadge(meal.created_at)} • {formatTime(meal.created_at)}
                                </Text>
                              </View>
                              <Text numberOfLines={2} style={styles.rowTitle}>
                                {meal.description}
                              </Text>
                              <Text style={styles.rowMeta}>Macros</Text>
                            </View>
                          </View>

                          {renderMacroChips(meal)}

                          <View style={styles.rowActions}>
                            <TouchableOpacity
                              style={styles.primaryActionBtn}
                              onPress={() => handleLogFromRecent(meal)}
                              disabled={Boolean(actionKey)}
                              activeOpacity={0.85}
                            >
                              {isActing ? (
                                <ActivityIndicator size="small" color={colors.bg} />
                              ) : (
                                <Ionicons name="add-circle-outline" size={15} color={colors.bg} />
                              )}
                              <Text style={styles.primaryActionText}>
                                {isActing ? 'Logging…' : 'Log Again'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.secondaryActionBtn, isSaved && styles.secondaryActionBtnActive]}
                              onPress={() => handleSaveRecentMeal(meal)}
                              activeOpacity={0.85}
                            >
                              <Ionicons
                                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                                size={14}
                                color={isSaved ? colors.brandPrimary : colors.textPrimary}
                              />
                              <Text
                                style={[
                                  styles.secondaryActionText,
                                  isSaved && { color: colors.brandPrimary },
                                ]}
                              >
                                {isSaved ? 'Saved' : 'Save'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )
                    })
                  )}
                </>
              )}
          </ScrollView>
        </LinearGradient>
      </View>
    </View>
  )

  if (isPage) {
    return sheetBody
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {sheetBody}
    </Modal>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    pageRoot: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.42)',
    },
    sheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: 'hidden',
      backgroundColor: colors.bg,
      maxHeight: '88%',
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)',
    },
    pageSheet: {
      flex: 1,
      maxHeight: '100%',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderTopWidth: 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
    },
    sheetGradient: {
      flex: 1,
      paddingHorizontal: 14,
      paddingBottom: 4,
    },
    handleWrap: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 8,
    },
    handle: {
      width: 38,
      height: 4,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(17,17,17,0.14)',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 4,
      paddingBottom: 10,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textSecondary,
      maxWidth: 280,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,17,17,0.04)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)',
    },
    tabsOuter: {
      marginBottom: 10,
    },
    tabsContent: {
      gap: 8,
      paddingHorizontal: 2,
    },
    tabBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,17,17,0.04)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.05)',
    },
    tabBtnActive: {
      backgroundColor: colors.textPrimary,
      borderColor: colors.textPrimary,
    },
    tabBtnText: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: -0.1,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
      marginBottom: 10,
      paddingHorizontal: 10,
      minHeight: 46,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    },
    searchClearBtn: {
      padding: 4,
      marginLeft: 4,
    },
    contentScroll: {
      flex: 1,
    },
    contentScrollInner: {
      gap: 10,
      paddingBottom: 10,
    },
    inlineSectionHeader: {
      paddingHorizontal: 4,
      paddingTop: 2,
      paddingBottom: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    inlineSectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    inlineSectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.15,
    },
    inlineSectionMeta: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0,
    },
    inlineHintCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.88)',
      padding: 12,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    inlineHintIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,17,17,0.03)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.05)',
    },
    inlineHintTextWrap: {
      flex: 1,
      gap: 3,
      paddingTop: 1,
    },
    inlineHintTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.1,
    },
    inlineHintBody: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    rowCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.88)',
      padding: 12,
      gap: 10,
    },
    rowCardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    rowTitleBlock: {
      flex: 1,
      gap: 4,
    },
    rowSourcePill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,17,17,0.03)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.05)',
    },
    rowSourcePillText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    rowTitle: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.15,
    },
    rowMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    macroChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    macroChipLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.25,
    },
    macroChipValue: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    rowActions: {
      flexDirection: 'row',
      gap: 8,
    },
    primaryActionBtn: {
      flex: 1,
      minHeight: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      backgroundColor: colors.textPrimary,
    },
    primaryActionText: {
      color: colors.bg,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: -0.1,
    },
    secondaryActionBtn: {
      minHeight: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,17,17,0.03)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.05)',
    },
    secondaryActionBtnActive: {
      borderColor: `${colors.brandPrimary}55`,
      backgroundColor: `${colors.brandPrimary}10`,
    },
    secondaryActionText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: -0.1,
    },
    loadingState: {
      paddingVertical: 28,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    loadingText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    emptyState: {
      paddingVertical: 30,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    emptyIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,17,17,0.03)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.05)',
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.15,
    },
    emptyBody: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 290,
    },
  })
