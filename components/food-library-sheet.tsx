import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
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
import {
  getFatSecretFood,
  getFatSecretQuickPicks,
  searchFatSecretFoods,
  type FatSecretFoodDetail,
  type FatSecretFoodSummary,
  type FatSecretServing,
} from '@/lib/api/fatsecret-foods'
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
  provider?: 'local' | 'fatsecret'
  providerFoodId?: string | null
  providerFoodType?: string | null
  defaultServing?: FatSecretServing | null
  servingCount?: number
}

type FoodBankScaleMode = 'grams' | 'servings'

type FoodBankScaleBasis = {
  mode: FoodBankScaleMode
  basisLabel: string
  basisAmount: number
  basisGrams: number | null
}

type FoodBankServingOption = {
  key: string
  chipLabel: string
  referenceLabel: string
  inputMode: 'metric' | 'count'
  inputUnitLabel: string
  baseInputAmount: number
  metricAmount: number | null
  metricUnit: 'g' | 'ml' | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fatSecretServingId?: string | null
  isDefault?: boolean
  isMetricStandard?: boolean
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
  onFoodBankItemDetailChange?: (detail: {
    isOpen: boolean
    itemName: string | null
    isSaved: boolean
    isLogging: boolean
    isChatting: boolean
    isSaving: boolean
    onLog: () => void
    onUseInChat: () => void
    onSave: () => void
    closeToFoodLibrary: (() => void) | null
  }) => void
}

const TABS: { id: FoodLibraryTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'food_bank', label: 'Food Bank', icon: 'restaurant-outline' },
  { id: 'saved_meals', label: 'Saved Meals', icon: 'bookmark-outline' },
  { id: 'recent_meals', label: 'Recent Meals', icon: 'time-outline' },
]

const MAX_SAVED_MEALS = 100
const FATSECRET_RESULT_LIMIT = 20
const FATSECRET_QUICK_PICKS_LIMIT = 16
const FOOD_LIBRARY_HOME_RECENT_PREVIEW_LIMIT = 3
const FOOD_LIBRARY_HOME_SAVED_PREVIEW_LIMIT = 3

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

const getFoodBankDisplayName = (item: FoodBankItem) =>
  item.brand ? `${item.name} (${item.brand})` : item.name

const extractGramsFromServingSize = (servingSize?: string | null): number | null => {
  const value = String(servingSize ?? '')
  if (!value) return null

  const matches = [...value.toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*g\b/g)]
  if (matches.length === 0) return null

  const grams = Number(matches[matches.length - 1]?.[1] ?? 0)
  return Number.isFinite(grams) && grams > 0 ? grams : null
}

const formatAmountValue = (value: number) => {
  const rounded = roundOne(value)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

const getFoodBankScaleBasis = (item: FoodBankItem): FoodBankScaleBasis => {
  const basisLabel = item.servingSize?.trim() || '1 serving'
  const grams = extractGramsFromServingSize(item.servingSize)

  if (grams) {
    return {
      mode: 'grams',
      basisLabel,
      basisAmount: grams,
      basisGrams: grams,
    }
  }

  return {
    mode: 'servings',
    basisLabel,
    basisAmount: 1,
    basisGrams: null,
  }
}

const getFoodBankReferenceMacros = (item: FoodBankItem) => {
  const basis = getFoodBankScaleBasis(item)
  const factor = basis.mode === 'grams' && basis.basisGrams ? 100 / basis.basisGrams : 1

  return {
    label: basis.mode === 'grams' ? 'Per 100g' : 'Reference',
    calories: Math.max(0, roundOne(item.calories * factor)),
    protein_g: Math.max(0, roundOne(item.protein_g * factor)),
    carbs_g: Math.max(0, roundOne(item.carbs_g * factor)),
    fat_g: Math.max(0, roundOne(item.fat_g * factor)),
  }
}

const normalizeFoodBankItemToGramReference = (item: FoodBankItem): FoodBankItem => {
  const basis = getFoodBankScaleBasis(item)
  if (basis.mode !== 'grams' || !basis.basisGrams) return item
  if (Math.abs(basis.basisGrams - 100) < 0.01) {
    return {
      ...item,
      servingSize: '100 g',
    }
  }

  const factor = 100 / basis.basisGrams
  return {
    ...item,
    servingSize: '100 g',
    calories: Math.max(0, roundOne(item.calories * factor)),
    protein_g: Math.max(0, roundOne(item.protein_g * factor)),
    carbs_g: Math.max(0, roundOne(item.carbs_g * factor)),
    fat_g: Math.max(0, roundOne(item.fat_g * factor)),
  }
}

const getMetricServingInputMode = (serving: FatSecretServing): 'metric' | 'count' => {
  const measurement = String(serving.measurementDescription ?? '').trim().toLowerCase()
  const description = String(serving.servingDescription ?? '').trim().toLowerCase()
  const metricUnit = String(serving.metricServingUnit ?? '').trim().toLowerCase()
  const numberOfUnits = Number(serving.numberOfUnits ?? 0)

  const metricMeasurement = measurement === 'g' || measurement === 'ml'
  const metricDescription =
    /^\d+(\.\d+)?\s*(g|ml)$/.test(description) || description === '100 g' || description === '100 ml'
  const metricUnitSupported = metricUnit === 'g' || metricUnit === 'ml'

  if (metricMeasurement || metricDescription) return 'metric'
  if (serving.isMetricStandard && metricUnitSupported) return 'metric'
  if (metricUnitSupported && numberOfUnits > 0 && (measurement === metricUnit || !measurement)) {
    return 'metric'
  }

  return 'count'
}

const formatServingChipLabel = (serving: FatSecretServing): string => {
  const description = String(serving.servingDescription ?? '').trim()
  if (description) return description
  return 'Serving'
}

const fatSecretServingToFoodBankServingOption = (
  serving: FatSecretServing,
): FoodBankServingOption | null => {
  if (!serving) return null

  const inputMode = getMetricServingInputMode(serving)
  const metricUnit = serving.metricServingUnit === 'g' || serving.metricServingUnit === 'ml'
    ? serving.metricServingUnit
    : null

  const metricAmount =
    typeof serving.metricServingAmount === 'number' && Number.isFinite(serving.metricServingAmount)
      ? Math.max(0, serving.metricServingAmount)
      : null
  const numberOfUnits =
    typeof serving.numberOfUnits === 'number' && Number.isFinite(serving.numberOfUnits)
      ? Math.max(0, serving.numberOfUnits)
      : null

  const baseInputAmount =
    inputMode === 'metric'
      ? (numberOfUnits && numberOfUnits > 0 ? numberOfUnits : metricAmount || 100)
      : 1

  return {
    key: `fatsecret:${serving.servingId}`,
    chipLabel: formatServingChipLabel(serving),
    referenceLabel: formatServingChipLabel(serving),
    inputMode,
    inputUnitLabel: inputMode === 'metric' ? metricUnit ?? 'g' : 'x',
    baseInputAmount: Math.max(0.1, baseInputAmount),
    metricAmount,
    metricUnit,
    calories: Math.max(0, roundOne(serving.calories)),
    protein_g: Math.max(0, roundOne(serving.protein_g)),
    carbs_g: Math.max(0, roundOne(serving.carbs_g)),
    fat_g: Math.max(0, roundOne(serving.fat_g)),
    fatSecretServingId: serving.servingId,
    isDefault: Boolean(serving.isDefault),
    isMetricStandard: Boolean(serving.isMetricStandard),
  }
}

const localFoodBankItemToServingOption = (item: FoodBankItem): FoodBankServingOption => {
  const basis = getFoodBankScaleBasis(item)
  return {
    key: `local:${item.id}`,
    chipLabel: basis.basisLabel,
    referenceLabel: basis.basisLabel,
    inputMode: basis.mode === 'grams' ? 'metric' : 'count',
    inputUnitLabel: basis.mode === 'grams' ? 'g' : 'x',
    baseInputAmount: basis.basisAmount,
    metricAmount: basis.basisGrams,
    metricUnit: basis.mode === 'grams' ? 'g' : null,
    calories: Math.max(0, roundOne(item.calories)),
    protein_g: Math.max(0, roundOne(item.protein_g)),
    carbs_g: Math.max(0, roundOne(item.carbs_g)),
    fat_g: Math.max(0, roundOne(item.fat_g)),
    fatSecretServingId: null,
    isDefault: true,
    isMetricStandard: basis.mode === 'grams' && basis.basisGrams === 100,
  }
}

const chooseBestServingOption = (options: FoodBankServingOption[]): FoodBankServingOption | null =>
  [...options].sort((a, b) => {
    const score = (option: FoodBankServingOption) => {
      const is100Metric =
        option.inputMode === 'metric' &&
        (option.metricUnit === 'g' || option.metricUnit === 'ml') &&
        Math.abs(option.baseInputAmount - 100) < 0.01

      return (
        (option.isDefault ? 1000 : 0) +
        (is100Metric ? 600 : 0) +
        (option.isMetricStandard ? 400 : 0) +
        (option.inputMode === 'metric' ? 100 : 0) -
        Math.min(option.chipLabel.length, 80)
      )
    }
    return score(b) - score(a)
  })[0] ?? null

const buildFoodBankServingOptions = (
  item: FoodBankItem,
  fatSecretDetail: FatSecretFoodDetail | null,
): FoodBankServingOption[] => {
  if ((item.provider ?? 'local') !== 'fatsecret') {
    return [localFoodBankItemToServingOption(item)]
  }

  const servingsFromDetail = fatSecretDetail?.servings ?? []
  const detailOptions = servingsFromDetail
    .map(fatSecretServingToFoodBankServingOption)
    .filter((option): option is FoodBankServingOption => Boolean(option))

  if (detailOptions.length > 0) return detailOptions

  if (item.defaultServing) {
    const fallback = fatSecretServingToFoodBankServingOption(item.defaultServing)
    if (fallback) return [fallback]
  }

  return [localFoodBankItemToServingOption(item)]
}

const scaleFoodBankItemWithServingOption = (
  item: FoodBankItem,
  amount: number,
  option: FoodBankServingOption,
): FoodLibraryMealDraft => {
  const safeAmount = Math.max(0.1, Number.isFinite(amount) ? amount : option.baseInputAmount)
  const referenceAmount =
    option.inputMode === 'metric' ? Math.max(option.baseInputAmount, 0.1) : 1
  const scaleFactor =
    option.inputMode === 'metric' ? safeAmount / referenceAmount : safeAmount

  const amountLabel =
    option.inputMode === 'metric'
      ? `${formatAmountValue(safeAmount)} ${option.inputUnitLabel}`
      : `${formatAmountValue(safeAmount)} x ${option.chipLabel}`

  const provider = item.provider ?? 'local'

  return {
    description: `${getFoodBankDisplayName(item)} • ${amountLabel}`,
    calories: Math.max(0, roundOne(option.calories * scaleFactor)),
    protein_g: Math.max(0, roundOne(option.protein_g * scaleFactor)),
    carbs_g: Math.max(0, roundOne(option.carbs_g * scaleFactor)),
    fat_g: Math.max(0, roundOne(option.fat_g * scaleFactor)),
    source: 'manual',
    confidence: null,
    metadata: {
      from: provider === 'fatsecret' ? 'food_library_fatsecret_item' : 'food_library_bank_item_custom',
      provider,
      code: item.code ?? null,
      brand: item.brand ?? null,
      amount: roundOne(safeAmount),
      amountUnit: option.inputMode === 'metric' ? option.inputUnitLabel : 'servings',
      referenceServingLabel: option.referenceLabel,
      servingSize: item.servingSize ?? null,
      fatsecretFoodId: item.providerFoodId ?? null,
      fatsecretServingId: option.fatSecretServingId ?? null,
      fatsecretFoodType: item.providerFoodType ?? null,
      metricServingAmount: option.metricAmount ?? null,
      metricServingUnit: option.metricUnit ?? null,
    },
  }
}

const createScaledFoodPromptWithServingOption = (
  item: FoodBankItem,
  amount: number,
  option: FoodBankServingOption,
): string => {
  const meal = scaleFoodBankItemWithServingOption(item, amount, option)
  const amountLabel =
    option.inputMode === 'metric'
      ? `${formatAmountValue(amount)} ${option.inputUnitLabel}`
      : `${formatAmountValue(amount)} x ${option.chipLabel}`

  return `Log ${amountLabel} of ${getFoodBankDisplayName(item)} (${round(meal.calories)} kcal, ${round(
    meal.protein_g,
  )}p, ${round(meal.carbs_g)}c, ${round(meal.fat_g)}f)`
}

const getServingOptionReferenceMacros = (option: FoodBankServingOption) => ({
  label:
    option.inputMode === 'metric'
      ? `Per ${formatAmountValue(option.baseInputAmount)} ${option.inputUnitLabel}`
      : option.referenceLabel,
  calories: option.calories,
  protein_g: option.protein_g,
  carbs_g: option.carbs_g,
  fat_g: option.fat_g,
})

const getFatSecretRowReferenceMacros = (item: FoodBankItem) => {
  const serving = item.defaultServing
  if (!serving) return getFoodBankReferenceMacros(item)

  const option = fatSecretServingToFoodBankServingOption(serving)
  if (!option) return getFoodBankReferenceMacros(item)

  return getServingOptionReferenceMacros(option)
}

const mapFatSecretFoodToFoodBankItem = (food: FatSecretFoodSummary): FoodBankItem | null => {
  const defaultServing = food.defaultServing ?? null
  if (!defaultServing) return null

  const option = fatSecretServingToFoodBankServingOption(defaultServing)
  if (!option) return null

  return {
    id: `fatsecret-${food.foodId}`,
    code: food.foodId,
    name: food.name,
    brand: food.brandName,
    servingSize: defaultServing.servingDescription,
    calories: option.calories,
    protein_g: option.protein_g,
    carbs_g: option.carbs_g,
    fat_g: option.fat_g,
    provider: 'fatsecret',
    providerFoodId: food.foodId,
    providerFoodType: food.foodType,
    defaultServing,
    servingCount: food.servingCount,
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
  onFoodBankItemDetailChange,
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
  const [popularFoodBankItems, setPopularFoodBankItems] = useState<FoodBankItem[]>([])
  const [isPopularFoodBankLoading, setIsPopularFoodBankLoading] = useState(false)
  const [popularFoodBankError, setPopularFoodBankError] = useState<string | null>(null)
  const [hasLoadedPopularFoodBankItems, setHasLoadedPopularFoodBankItems] = useState(false)
  const [selectedFoodBankItem, setSelectedFoodBankItem] = useState<FoodBankItem | null>(null)
  const [selectedFoodBankDetail, setSelectedFoodBankDetail] = useState<FatSecretFoodDetail | null>(
    null,
  )
  const [selectedFoodBankServingKey, setSelectedFoodBankServingKey] = useState<string | null>(null)
  const [isSelectedFoodBankDetailLoading, setIsSelectedFoodBankDetailLoading] = useState(false)
  const [selectedFoodBankDetailError, setSelectedFoodBankDetailError] = useState<string | null>(
    null,
  )
  const [foodBankAmountInput, setFoodBankAmountInput] = useState('')
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

  const commonFoodBankItems = useMemo(
    () =>
      FOOD_LIBRARY_COMMON_FOODS.map((item) =>
        normalizeFoodBankItemToGramReference({ ...item, provider: 'local' }),
      ),
    [],
  )

  const recentMealsPreview = useMemo(
    () => recentMealsDeduped.slice(0, FOOD_LIBRARY_HOME_RECENT_PREVIEW_LIMIT),
    [recentMealsDeduped],
  )

  const savedMealsPreview = useMemo(
    () => savedMeals.slice(0, FOOD_LIBRARY_HOME_SAVED_PREVIEW_LIMIT),
    [savedMeals],
  )

  const selectedFoodBankServingOptions = useMemo(() => {
    if (!selectedFoodBankItem) return []
    return buildFoodBankServingOptions(selectedFoodBankItem, selectedFoodBankDetail)
  }, [selectedFoodBankDetail, selectedFoodBankItem])

  const selectedFoodBankServingOption = useMemo(() => {
    if (selectedFoodBankServingOptions.length === 0) return null
    if (selectedFoodBankServingKey) {
      const explicit = selectedFoodBankServingOptions.find(
        (option) => option.key === selectedFoodBankServingKey,
      )
      if (explicit) return explicit
    }
    return chooseBestServingOption(selectedFoodBankServingOptions)
  }, [selectedFoodBankServingKey, selectedFoodBankServingOptions])

  const selectedFoodBankAmount = useMemo(() => {
    const fallback = selectedFoodBankServingOption?.baseInputAmount ?? 100
    const parsed = Number.parseFloat(foodBankAmountInput.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback
    return parsed
  }, [foodBankAmountInput, selectedFoodBankServingOption])

  const selectedFoodBankDraft = useMemo(() => {
    if (!selectedFoodBankItem || !selectedFoodBankServingOption) return null
    return scaleFoodBankItemWithServingOption(
      selectedFoodBankItem,
      selectedFoodBankAmount,
      selectedFoodBankServingOption,
    )
  }, [selectedFoodBankAmount, selectedFoodBankItem, selectedFoodBankServingOption])

  const selectedFoodBankPrompt = useMemo(() => {
    if (!selectedFoodBankItem || !selectedFoodBankServingOption) return null
    return createScaledFoodPromptWithServingOption(
      selectedFoodBankItem,
      selectedFoodBankAmount,
      selectedFoodBankServingOption,
    )
  }, [selectedFoodBankAmount, selectedFoodBankItem, selectedFoodBankServingOption])

  const selectedFoodBankIsSaved = useMemo(() => {
    if (!selectedFoodBankDraft) return false
    return savedFingerprints.has(buildMealFingerprint(selectedFoodBankDraft))
  }, [savedFingerprints, selectedFoodBankDraft])

  const foodBankDetailQuickAmounts = useMemo(() => {
    if (!selectedFoodBankServingOption) return []

    if (selectedFoodBankServingOption.inputMode === 'metric') {
      const basis = round(selectedFoodBankServingOption.baseInputAmount)
      const isMl = selectedFoodBankServingOption.inputUnitLabel === 'ml'
      const values = isMl
        ? [100, 200, 250, 330, 500, basis]
        : [50, 100, 150, 200, 250, basis]
      return [...new Set(values.filter((value) => value > 0))].slice(0, 6)
    }

    const values = [0.5, 1, 2, 3]
    return values
  }, [selectedFoodBankServingOption])

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
    if (!visible || activeTab !== 'food_bank' || selectedFoodBankItem) return
    if (hasLoadedPopularFoodBankItems) return

    let cancelled = false

    const loadPopularFoods = async () => {
      setIsPopularFoodBankLoading(true)
      setPopularFoodBankError(null)

      try {
        const result = await getFatSecretQuickPicks({
          limit: FATSECRET_QUICK_PICKS_LIMIT,
          region: 'US',
          language: 'en',
        })

        const mapped: FoodBankItem[] = result.foods
          .map(mapFatSecretFoodToFoodBankItem)
          .filter((item): item is FoodBankItem => Boolean(item))

        if (!cancelled) {
          setPopularFoodBankItems(mapped)
          setHasLoadedPopularFoodBankItems(true)
        }
      } catch (error) {
        console.error('[FoodLibrarySheet] FatSecret quick picks error:', error)
        if (!cancelled) {
          setPopularFoodBankItems([])
          setPopularFoodBankError(
            error instanceof Error
              ? error.message
              : 'Could not load popular foods right now.',
          )
          setHasLoadedPopularFoodBankItems(true)
        }
      } finally {
        if (!cancelled) {
          setIsPopularFoodBankLoading(false)
        }
      }
    }

    loadPopularFoods()

    return () => {
      cancelled = true
    }
  }, [activeTab, hasLoadedPopularFoodBankItems, selectedFoodBankItem, visible])

  useEffect(() => {
    if (!visible || activeTab !== 'food_bank' || selectedFoodBankItem) return

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
        const result = await searchFatSecretFoods({
          query,
          maxResults: FATSECRET_RESULT_LIMIT,
          region: 'US',
          language: 'en',
        })

        const mapped: FoodBankItem[] = result.foods
          .map(mapFatSecretFoodToFoodBankItem)
          .filter((item): item is FoodBankItem => Boolean(item))

        if (!cancelled) {
          setFoodBankResults(mapped)
        }
      } catch (error) {
        console.error('[FoodLibrarySheet] FatSecret food search error:', error)
        if (!cancelled) {
          setFoodBankResults([])
          setFoodBankError(
            error instanceof Error
              ? error.message
              : 'Could not load FatSecret food results. Try again.',
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
  }, [activeTab, searchQuery, selectedFoodBankItem, visible])

  useEffect(() => {
    if (!selectedFoodBankItem) {
      setSelectedFoodBankDetail(null)
      setSelectedFoodBankDetailError(null)
      setIsSelectedFoodBankDetailLoading(false)
      return
    }

    if ((selectedFoodBankItem.provider ?? 'local') !== 'fatsecret' || !selectedFoodBankItem.providerFoodId) {
      setSelectedFoodBankDetail(null)
      setSelectedFoodBankDetailError(null)
      setIsSelectedFoodBankDetailLoading(false)
      return
    }

    let cancelled = false

    const loadFoodDetail = async () => {
      setIsSelectedFoodBankDetailLoading(true)
      setSelectedFoodBankDetailError(null)

      try {
        const result = await getFatSecretFood({
          foodId: selectedFoodBankItem.providerFoodId!,
          region: 'US',
          language: 'en',
        })

        if (cancelled) return
        setSelectedFoodBankDetail(result.food)
      } catch (error) {
        console.error('[FoodLibrarySheet] FatSecret food detail error:', error)
        if (!cancelled) {
          setSelectedFoodBankDetail(null)
          setSelectedFoodBankDetailError(
            error instanceof Error ? error.message : 'Could not load serving options.',
          )
        }
      } finally {
        if (!cancelled) setIsSelectedFoodBankDetailLoading(false)
      }
    }

    loadFoodDetail()

    return () => {
      cancelled = true
    }
  }, [selectedFoodBankItem])

  useEffect(() => {
    if (!selectedFoodBankItem) return
    if (selectedFoodBankServingOptions.length === 0) return

    const activeOption = selectedFoodBankServingOptions.find(
      (option) => option.key === selectedFoodBankServingKey,
    )
    if (activeOption) return

    const nextOption = chooseBestServingOption(selectedFoodBankServingOptions)
    if (!nextOption) return

    setSelectedFoodBankServingKey(nextOption.key)
    setFoodBankAmountInput(formatAmountValue(nextOption.baseInputAmount))
  }, [selectedFoodBankItem, selectedFoodBankServingKey, selectedFoodBankServingOptions])

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

  useEffect(() => {
    if (activeTab === 'food_bank') return
    setSelectedFoodBankItem(null)
    setSelectedFoodBankDetail(null)
    setSelectedFoodBankDetailError(null)
    setSelectedFoodBankServingKey(null)
    setFoodBankAmountInput('')
  }, [activeTab])

  const openFoodBankItemDetail = useCallback((item: FoodBankItem) => {
    const bootstrapOptions = buildFoodBankServingOptions(item, null)
    const initialOption = chooseBestServingOption(bootstrapOptions)
    haptic('light')
    setSelectedFoodBankDetail(null)
    setSelectedFoodBankDetailError(null)
    setSelectedFoodBankServingKey(initialOption?.key ?? null)
    setSelectedFoodBankItem(item)
    setFoodBankAmountInput(formatAmountValue(initialOption?.baseInputAmount ?? 100))
  }, [])

  const closeFoodBankItemDetail = useCallback(() => {
    haptic('light')
    setSelectedFoodBankItem(null)
    setSelectedFoodBankDetail(null)
    setSelectedFoodBankDetailError(null)
    setSelectedFoodBankServingKey(null)
    setFoodBankAmountInput('')
  }, [])

  const setFoodBankAmount = useCallback((value: number) => {
    const safe = Math.max(0.1, roundOne(value))
    setFoodBankAmountInput(formatAmountValue(safe))
  }, [])

  const handleSelectFoodBankServingOption = useCallback(
    (option: FoodBankServingOption) => {
      haptic('light')
      setSelectedFoodBankServingKey(option.key)
      setFoodBankAmountInput(formatAmountValue(option.baseInputAmount))
    },
    [],
  )

  const nudgeFoodBankAmount = useCallback(
    (delta: number) => {
      const next = Math.max(0.1, selectedFoodBankAmount + delta)
      setFoodBankAmount(next)
    },
    [selectedFoodBankAmount, setFoodBankAmount],
  )

  const handleSaveFoodBankDetailMeal = useCallback(async () => {
    if (!selectedFoodBankItem || !selectedFoodBankDraft || !selectedFoodBankServingOption) return
    if (selectedFoodBankIsSaved) return

    const key = 'food-bank-detail:save'
    if (actionKey) return
    setActionKey(key)
    haptic('light')
    try {
      await addSavedMeal({
        id: `saved-food-bank-${selectedFoodBankItem.id}-${Date.now()}`,
        description: selectedFoodBankDraft.description,
        calories: selectedFoodBankDraft.calories,
        protein_g: selectedFoodBankDraft.protein_g,
        carbs_g: selectedFoodBankDraft.carbs_g,
        fat_g: selectedFoodBankDraft.fat_g,
        source: 'manual',
        confidence: null,
        metadata: {
          ...(selectedFoodBankDraft.metadata ?? {}),
          from:
            (selectedFoodBankItem.provider ?? 'local') === 'fatsecret'
              ? 'food_library_fatsecret_item_saved'
              : 'food_library_bank_item_custom_saved',
          code: selectedFoodBankItem.code ?? null,
          servingSize: selectedFoodBankItem.servingSize ?? null,
          amount: roundOne(selectedFoodBankAmount),
          amountUnit:
            selectedFoodBankServingOption.inputMode === 'metric'
              ? selectedFoodBankServingOption.inputUnitLabel
              : 'servings',
          referenceServingLabel: selectedFoodBankServingOption.referenceLabel,
          fatsecretServingId: selectedFoodBankServingOption.fatSecretServingId ?? null,
        },
        saved_at: new Date().toISOString(),
        origin: 'food_bank',
      })
    } finally {
      setActionKey(null)
    }
  }, [
    selectedFoodBankItem,
    selectedFoodBankDraft,
    selectedFoodBankServingOption,
    selectedFoodBankIsSaved,
    selectedFoodBankAmount,
    actionKey,
    addSavedMeal,
  ])

  const handleLogFoodBankDetailMeal = useCallback(async () => {
    if (!selectedFoodBankDraft) return

    const key = 'food-bank-detail:log'
    if (actionKey) return
    setActionKey(key)
    haptic('medium')
    try {
      await onLogMeal(selectedFoodBankDraft)
      onClose()
    } finally {
      setActionKey(null)
    }
  }, [selectedFoodBankDraft, actionKey, onLogMeal, onClose])

  const handleUseFoodBankDetail = useCallback(async () => {
    if (!selectedFoodBankPrompt) return

    const key = 'food-bank-detail:chat'
    if (actionKey) return
    setActionKey(key)
    haptic('light')
    try {
      await onUseFoodText(selectedFoodBankPrompt)
      onClose()
    } catch (error) {
      console.error('[FoodLibrarySheet] Failed to hand off food prompt:', error)
    } finally {
      setActionKey(null)
    }
  }, [selectedFoodBankPrompt, actionKey, onUseFoodText, onClose])

  useEffect(() => {
    onFoodBankItemDetailChange?.({
      isOpen: Boolean(selectedFoodBankItem),
      itemName: selectedFoodBankItem?.name ?? null,
      isSaved: selectedFoodBankIsSaved,
      isLogging: actionKey === 'food-bank-detail:log',
      isChatting: actionKey === 'food-bank-detail:chat',
      isSaving: actionKey === 'food-bank-detail:save',
      onLog: handleLogFoodBankDetailMeal,
      onUseInChat: handleUseFoodBankDetail,
      onSave: handleSaveFoodBankDetailMeal,
      closeToFoodLibrary: selectedFoodBankItem ? closeFoodBankItemDetail : null,
    })
  }, [
    closeFoodBankItemDetail,
    onFoodBankItemDetailChange,
    selectedFoodBankItem,
    selectedFoodBankIsSaved,
    actionKey,
    handleLogFoodBankDetailMeal,
    handleUseFoodBankDetail,
    handleSaveFoodBankDetailMeal,
  ])

  const renderFoodBankDetailPage = () => {
    if (!selectedFoodBankItem || !selectedFoodBankServingOption || !selectedFoodBankDraft) return null

    const selectedServing = selectedFoodBankServingOption
    const amountValue = selectedFoodBankAmount
    const isMetricMode = selectedServing.inputMode === 'metric'
    const amountUnitLabel = selectedServing.inputUnitLabel
    const metricStep = amountUnitLabel === 'ml' ? 50 : 25
    const countStep = /^1(\.0+)?\b/.test(selectedServing.chipLabel.trim()) ? 1 : 0.5
    const minusStep = isMetricMode ? metricStep : countStep
    const plusStep = isMetricMode ? metricStep : countStep
    const amountSummaryLabel = isMetricMode
      ? `${formatAmountValue(amountValue)} ${amountUnitLabel}`
      : `${formatAmountValue(amountValue)} x ${selectedServing.chipLabel}`

    const saveBusy = actionKey === 'food-bank-detail:save'
    const chatBusy = actionKey === 'food-bank-detail:chat'
    const isBusy = saveBusy || chatBusy

    return (
      <View style={styles.foodDetailPage}>
        <View style={styles.foodDetailStack}>
          <View style={styles.foodDetailTitleRow}>
            <View style={styles.foodDetailTitleBlock}>
              <Text style={styles.foodDetailTitle}>{selectedFoodBankItem.name}</Text>
              {selectedFoodBankItem.brand ? (
                <Text style={styles.foodDetailBrand}>{selectedFoodBankItem.brand}</Text>
              ) : null}
            </View>
            <View style={styles.foodDetailTitleActions}>
              <TouchableOpacity
                style={styles.foodDetailTitleAction}
                onPress={handleUseFoodBankDetail}
                disabled={isBusy}
              >
                {chatBusy ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Ionicons name="chatbubble-outline" size={18} color={colors.textPrimary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.foodDetailTitleAction, selectedFoodBankIsSaved && { opacity: 0.7 }]}
                onPress={handleSaveFoodBankDetailMeal}
                disabled={isBusy || selectedFoodBankIsSaved}
              >
                {saveBusy ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Ionicons
                    name={selectedFoodBankIsSaved ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={selectedFoodBankIsSaved ? colors.brandPrimary : colors.textPrimary}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.foodDetailMacroGrid}>
            <View style={styles.foodDetailCaloriesCard}>
              <Text style={styles.foodDetailCardEyebrow}>Calories</Text>
              <Text style={styles.foodDetailCaloriesValue}>
                {round(selectedFoodBankDraft.calories)}
              </Text>
              <Text style={styles.foodDetailCaloriesCaption}>
                for {amountSummaryLabel}
              </Text>
            </View>

            <View style={styles.foodDetailMacrosCard}>
              <Text style={styles.foodDetailCardEyebrow}>Macros</Text>
              {[
                { label: 'Protein', value: selectedFoodBankDraft.protein_g, tint: '#F87171' },
                { label: 'Carbs', value: selectedFoodBankDraft.carbs_g, tint: '#FBBF24' },
                { label: 'Fat', value: selectedFoodBankDraft.fat_g, tint: '#60A5FA' },
              ].map((macro) => (
                <View key={macro.label} style={styles.foodDetailMacroRow}>
                  <View style={styles.foodDetailMacroLabelWrap}>
                    <View
                      style={[
                        styles.foodDetailMacroDot,
                        { backgroundColor: macro.tint },
                      ]}
                    />
                    <Text style={styles.foodDetailMacroLabel}>{macro.label}</Text>
                  </View>
                  <Text style={styles.foodDetailMacroValue}>
                    {roundOne(macro.value)}g
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.foodDetailAmountCard}>
            {selectedFoodBankServingOptions.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.foodDetailServingChipsRow}
              >
                {selectedFoodBankServingOptions.map((option) => {
                  const active = option.key === selectedServing.key
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.foodDetailServingChip,
                        active && styles.foodDetailServingChipActive,
                      ]}
                      onPress={() => handleSelectFoodBankServingOption(option)}
                      activeOpacity={0.85}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.foodDetailServingChipText,
                          active && { color: colors.bg },
                        ]}
                      >
                        {option.chipLabel}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            ) : null}

            {(isSelectedFoodBankDetailLoading || selectedFoodBankDetailError) && (
              <View style={styles.foodDetailStatusRow}>
                {isSelectedFoodBankDetailLoading ? (
                  <>
                    <ActivityIndicator size="small" color={colors.brandPrimary} />
                    <Text style={styles.foodDetailStatusText}>Loading serving options…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="alert-circle-outline"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.foodDetailStatusText}>
                      {selectedFoodBankDetailError}
                    </Text>
                  </>
                )}
              </View>
            )}

            <Text style={[styles.foodDetailSectionTitle, { marginBottom: 8 }]}>Amount</Text>

            <View style={styles.foodDetailAmountRow}>
              <TouchableOpacity
                style={styles.foodDetailAmountNudgeBtn}
                onPress={() => nudgeFoodBankAmount(-minusStep)}
                activeOpacity={0.85}
              >
                <Ionicons name="remove" size={16} color={colors.textPrimary} />
              </TouchableOpacity>

              <View style={styles.foodDetailAmountInputWrap}>
                <TextInput
                  value={foodBankAmountInput}
                  onChangeText={setFoodBankAmountInput}
                  onBlur={() => setFoodBankAmount(amountValue)}
                  keyboardType="decimal-pad"
                  style={styles.foodDetailAmountInput}
                  placeholder={isMetricMode ? '100' : '1'}
                  placeholderTextColor={colors.textPlaceholder}
                />
                <View style={styles.foodDetailAmountUnitPill}>
                  <Text style={styles.foodDetailAmountUnitText}>{amountUnitLabel}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.foodDetailAmountNudgeBtn}
                onPress={() => nudgeFoodBankAmount(plusStep)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={16} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.foodDetailQuickAmountsRow}
            >
              {foodBankDetailQuickAmounts.map((value) => {
                const active = Math.abs(value - amountValue) < 0.05
                return (
                  <TouchableOpacity
                    key={`quick-${value}`}
                    style={[
                      styles.foodDetailQuickAmountChip,
                      active && styles.foodDetailQuickAmountChipActive,
                    ]}
                    onPress={() => setFoodBankAmount(value)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.foodDetailQuickAmountChipText,
                        active && { color: colors.bg },
                      ]}
                    >
                      {formatAmountValue(value)}
                      {isMetricMode ? amountUnitLabel : 'x'}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            {!isMetricMode && selectedServing.metricAmount && selectedServing.metricUnit ? (
              <Text style={styles.foodDetailSupportText}>
                ≈ {roundOne(selectedServing.metricAmount)} {selectedServing.metricUnit} per{' '}
                {selectedServing.chipLabel}
              </Text>
            ) : null}
          </View>

        </View>
      </View>
    )
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

  const renderInlineSectionHeader = ({
    title,
    meta,
    actionLabel,
    onPressAction,
  }: {
    title: string
    meta?: string | null
    actionLabel?: string | null
    onPressAction?: (() => void) | null
  }) => (
    <View style={styles.inlineSectionHeader}>
      <View style={styles.inlineSectionTitleRow}>
        <Text style={styles.inlineSectionTitle}>{title}</Text>
        {meta ? <Text style={styles.inlineSectionMeta}>{meta}</Text> : null}
      </View>
      {actionLabel && onPressAction ? (
        <TouchableOpacity
          style={styles.inlineSectionActionBtn}
          onPress={() => {
            haptic('light')
            onPressAction()
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.inlineSectionActionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  )

  const renderInlineHint = ({
    icon,
    title,
    body,
  }: {
    icon: keyof typeof Ionicons.glyphMap
    title: string
    body: string
  }) => (
    <View style={styles.inlineHintCard}>
      <View style={styles.inlineHintIconWrap}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
      </View>
      <View style={styles.inlineHintTextWrap}>
        <Text style={styles.inlineHintTitle}>{title}</Text>
        <Text style={styles.inlineHintBody}>{body}</Text>
      </View>
    </View>
  )

  const renderSavedMealRow = (meal: SavedLibraryMeal) => {
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
            <Text style={styles.primaryActionText}>{isActing ? 'Logging…' : 'Log'}</Text>
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
  }

  const renderRecentMealRow = (meal: DailyLogMeal) => {
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
  }

  const renderFoodBankHome = () => {
    const hasPopularQuickPicks = popularFoodBankItems.length > 0
    const popularRows = hasPopularQuickPicks
      ? popularFoodBankItems
      : commonFoodBankItems.slice(0, FATSECRET_QUICK_PICKS_LIMIT)

    const popularMeta = hasPopularQuickPicks
      ? 'FatSecret quick picks'
      : isPopularFoodBankLoading
        ? 'Loading…'
        : popularFoodBankError
          ? 'Fallback quick picks'
          : 'Quick picks'

    return (
      <>
        {renderInlineSectionHeader({
          title: 'Popular Foods',
          meta: popularMeta,
        })}

        {isPopularFoodBankLoading && popularRows.length === 0 ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={styles.loadingText}>Loading popular foods…</Text>
          </View>
        ) : (
          <>
            {popularFoodBankError
              ? renderInlineHint({
                  icon: 'flash-outline',
                  title: 'Showing fallback quick picks',
                  body:
                    'FatSecret popular foods are temporarily unavailable, so we are showing local starter foods for now.',
                })
              : null}
            {popularRows.map((item) => renderFoodBankRow(item))}
          </>
        )}

        {renderInlineSectionHeader({
          title: 'Recent Meals',
          meta:
            isRecentMealsLoading
              ? 'Loading…'
              : `${recentMealsDeduped.length} item${recentMealsDeduped.length === 1 ? '' : 's'}`,
          actionLabel: recentMealsDeduped.length > recentMealsPreview.length ? 'View all' : null,
          onPressAction:
            recentMealsDeduped.length > recentMealsPreview.length
              ? () => setActiveTab('recent_meals')
              : null,
        })}

        {isRecentMealsLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={styles.loadingText}>Loading recent meals…</Text>
          </View>
        ) : recentMealsPreview.length === 0 ? (
          renderInlineHint({
            icon: 'time-outline',
            title: 'No recent meals yet',
            body: 'Meals you log in chat will show up here for quick re-use.',
          })
        ) : (
          recentMealsPreview.map((meal) => renderRecentMealRow(meal))
        )}

        {renderInlineSectionHeader({
          title: 'Saved Meals',
          meta:
            isSavedMealsLoading
              ? 'Loading…'
              : `${savedMeals.length} item${savedMeals.length === 1 ? '' : 's'}`,
          actionLabel: savedMeals.length > savedMealsPreview.length ? 'View all' : null,
          onPressAction:
            savedMeals.length > savedMealsPreview.length ? () => setActiveTab('saved_meals') : null,
        })}

        {isSavedMealsLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={styles.loadingText}>Loading saved meals…</Text>
          </View>
        ) : savedMealsPreview.length === 0 ? (
          renderInlineHint({
            icon: 'bookmark-outline',
            title: 'No saved meals yet',
            body: 'Save meals from Food Item or Recent Meals to build your shortcuts.',
          })
        ) : (
          savedMealsPreview.map((meal) => renderSavedMealRow(meal))
        )}
      </>
    )
  }

  const renderFoodBankRow = (item: FoodBankItem) => {
    const reference =
      (item.provider ?? 'local') === 'fatsecret'
        ? getFatSecretRowReferenceMacros(item)
        : getFoodBankReferenceMacros(item)
    const calories = round(reference.calories ?? 0)

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.foodBankRow}
        onPress={() => openFoodBankItemDetail(item)}
        activeOpacity={0.85}
      >
        <Text numberOfLines={1} style={styles.foodBankRowTitle}>
          {getFoodBankDisplayName(item)}
        </Text>
        <View style={styles.foodBankRowRight}>
          <Text style={styles.foodBankRowCalories}>{calories} kcal</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>
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

          {!(activeTab === 'food_bank' && selectedFoodBankItem) && (
            <>
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
            </>
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
                  {selectedFoodBankItem ? (
                    renderFoodBankDetailPage()
                  ) : searchQuery.trim().length < 2 ? (
                    renderFoodBankHome()
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
                    savedMeals.map((meal) => renderSavedMealRow(meal))
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
                    recentMealsDeduped.map((meal) => renderRecentMealRow(meal))
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
    inlineSectionActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,17,17,0.03)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(17,17,17,0.05)',
    },
    inlineSectionActionText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: -0.05,
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
    foodBankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.92)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,17,17,0.04)',
    },
    foodBankRowTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    foodBankRowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    foodBankRowCalories: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
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
    rowChevronWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,17,17,0.03)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(17,17,17,0.05)',
      marginTop: 2,
    },
    rowInlineHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingTop: 2,
    },
    rowInlineHintText: {
      flex: 1,
      fontSize: 11,
      lineHeight: 14,
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
    foodDetailPage: {
      gap: 10,
    },
    foodDetailNavShell: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.86)',
      overflow: 'hidden',
    },
    foodDetailNavBar: {
      minHeight: 56,
      paddingHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    foodDetailNavBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,17,17,0.03)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(17,17,17,0.05)',
    },
    foodDetailNavCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      gap: 1,
    },
    foodDetailNavTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    foodDetailNavSubtitle: {
      maxWidth: '100%',
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: -0.05,
    },
    foodDetailDivider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,17,17,0.05)',
    },
    foodDetailStack: {
      gap: 10,
    },
    foodDetailHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 2,
    },
    foodDetailTopHint: {
      marginTop: 3,
      fontSize: 11,
      lineHeight: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    foodDetailBackBtn: {
      minHeight: 34,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,17,17,0.03)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.05)',
    },
    foodDetailBackText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.1,
    },
    foodDetailTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 4,
    },
    foodDetailTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    foodDetailTitleActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    foodDetailTitleAction: {
      padding: 6,
    },
    foodDetailTitle: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.35,
    },
    foodDetailBrand: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    foodDetailAmountCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.82)',
      padding: 12,
      gap: 10,
    },
    foodDetailSectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    foodDetailSectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.1,
    },
    foodDetailSectionMeta: {
      flex: 1,
      textAlign: 'right',
      fontSize: 11,
      lineHeight: 14,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    foodDetailServingChipsRow: {
      gap: 8,
      paddingRight: 2,
    },
    foodDetailServingChip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.05)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(17,17,17,0.02)',
      maxWidth: 180,
    },
    foodDetailServingChipActive: {
      backgroundColor: colors.textPrimary,
      borderColor: colors.textPrimary,
    },
    foodDetailServingChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.05,
    },
    foodDetailStatusRow: {
      minHeight: 28,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(17,17,17,0.02)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,17,17,0.04)',
    },
    foodDetailStatusText: {
      flex: 1,
      fontSize: 11,
      lineHeight: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    foodDetailAmountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    foodDetailAmountNudgeBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,17,17,0.03)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.05)',
    },
    foodDetailAmountInputWrap: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,17,17,0.08)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    foodDetailAmountInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.35,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    },
    foodDetailAmountUnitPill: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,17,17,0.04)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(17,17,17,0.05)',
    },
    foodDetailAmountUnitText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.15,
    },
    foodDetailQuickAmountsRow: {
      gap: 8,
      paddingRight: 2,
    },
    foodDetailQuickAmountChip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.05)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(17,17,17,0.02)',
    },
    foodDetailQuickAmountChipActive: {
      backgroundColor: colors.textPrimary,
      borderColor: colors.textPrimary,
    },
    foodDetailQuickAmountChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.05,
    },
    foodDetailSupportText: {
      fontSize: 11,
      lineHeight: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    foodDetailMacroGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    foodDetailCaloriesCard: {
      flex: 0.95,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.88)',
      padding: 12,
      gap: 6,
    },
    foodDetailMacrosCard: {
      flex: 1.25,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.88)',
      padding: 12,
      gap: 8,
    },
    foodDetailCardEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    foodDetailCaloriesValue: {
      fontSize: 32,
      lineHeight: 36,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.9,
    },
    foodDetailCaloriesCaption: {
      fontSize: 11,
      lineHeight: 14,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    foodDetailMacroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    foodDetailMacroLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    foodDetailMacroDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    foodDetailMacroLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    foodDetailMacroValue: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.1,
    },
    foodDetailReferenceCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.82)',
      padding: 12,
      gap: 10,
    },
    foodDetailActionsStack: {
      gap: 8,
      paddingTop: 2,
    },
  })
