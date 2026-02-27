// deno-lint-ignore-file no-explicit-any
// @ts-ignore: Supabase Edge Functions run in Deno and resolve remote modules
// eslint-disable-next-line import/no-unresolved
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import { createUserClient } from '../_shared/supabase.ts'
import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'

type FatSecretTokenCache = {
  accessToken: string
  expiresAtMs: number
}

type QuickPicksCacheEntry = {
  foods: NormalizedFatSecretFoodSummary[]
  expiresAtMs: number
}

type NormalizedFatSecretServing = {
  servingId: string
  servingDescription: string
  measurementDescription: string | null
  numberOfUnits: number | null
  metricServingAmount: number | null
  metricServingUnit: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  isDefault: boolean
  isMetricStandard: boolean
}

type NormalizedFatSecretFoodSummary = {
  foodId: string
  name: string
  brandName: string | null
  foodType: string | null
  defaultServing: NormalizedFatSecretServing | null
  servingCount: number
}

const FATSECRET_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token'
const FATSECRET_REST_BASE_URL = 'https://platform.fatsecret.com/rest'
const FATSECRET_SEARCH_PATH = '/foods/search/v4'
const FATSECRET_FOOD_PATH = '/food/v5'
const TOKEN_REFRESH_BUFFER_MS = 30_000
const QUICK_PICKS_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const QUICK_PICKS_DEFAULT_LIMIT = 16
const QUICK_PICKS_MAX_LIMIT = 50
const QUICK_PICKS_SEARCH_MAX_RESULTS = 8
const QUICK_PICKS_CONCURRENCY = 4

const POPULAR_FOOD_QUICK_PICK_SEEDS = [
  'eggs',
  'egg whites',
  'chicken breast',
  'chicken thigh',
  'ground turkey 93% lean',
  'ground beef 90% lean',
  'salmon',
  'tuna canned in water',
  'shrimp',
  'tofu firm',
  'tempeh',
  'greek yogurt nonfat plain',
  'cottage cheese low-fat',
  'cheddar cheese',
  'whey protein powder',
  'milk 2%',
  'almond milk unsweetened',
  'white rice cooked',
  'brown rice cooked',
  'rolled oats',
  'quinoa cooked',
  'pasta cooked',
  'whole wheat bread',
  'sourdough bread',
  'flour tortilla',
  'corn tortilla',
  'bagel plain',
  'potato baked russet',
  'sweet potato',
  'black beans cooked',
  'chickpeas cooked',
  'lentils cooked',
  'banana',
  'apple',
  'blueberries',
  'strawberries',
  'orange',
  'grapes',
  'avocado',
  'broccoli cooked',
  'spinach cooked',
  'carrots raw',
  'bell pepper',
  'cucumber',
  'tomato',
  'mixed greens',
  'olive oil',
  'peanut butter',
  'almonds',
  'walnuts',
]

let tokenCache: FatSecretTokenCache | null = null
const quickPicksCache = new Map<string, QuickPicksCacheEntry>()

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function parseIntNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value !== 'string') return null
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function clean(value: unknown): string | null {
  const next = str(value).trim()
  return next.length ? next : null
}

function normalizeUnit(value: unknown): string | null {
  const unit = clean(value)
  return unit ? unit.toLowerCase() : null
}

function normalizeServing(raw: any): NormalizedFatSecretServing | null {
  if (!raw || typeof raw !== 'object') return null

  const servingDescription = clean(raw.serving_description)
  if (!servingDescription) return null

  const servingId = clean(raw.serving_id) ?? `${servingDescription.toLowerCase()}`
  const measurementDescription = clean(raw.measurement_description)
  const numberOfUnits = parseNumber(raw.number_of_units)
  const metricServingAmount = parseNumber(raw.metric_serving_amount)
  const metricServingUnit = normalizeUnit(raw.metric_serving_unit)
  const calories = parseNumber(raw.calories) ?? 0
  const protein = parseNumber(raw.protein) ?? 0
  const carbs = parseNumber(raw.carbohydrate) ?? 0
  const fat = parseNumber(raw.fat) ?? 0
  const isDefault = String(raw.is_default ?? '') === '1' || raw.is_default === 1

  const lowerServingDescription = servingDescription.toLowerCase()
  const lowerMeasurementDescription = (measurementDescription ?? '').toLowerCase()
  const isMetricUnit = metricServingUnit === 'g' || metricServingUnit === 'ml'
  const isMetricMeasurement =
    lowerMeasurementDescription === 'g' || lowerMeasurementDescription === 'ml'
  const looksStandardMetricDescription =
    lowerServingDescription === '100 g' ||
    lowerServingDescription === '100 ml' ||
    lowerServingDescription.endsWith(' g') ||
    lowerServingDescription.endsWith(' ml')
  const isMetricStandard =
    servingId === '0' || (isMetricUnit && (isMetricMeasurement || looksStandardMetricDescription))

  return {
    servingId,
    servingDescription,
    measurementDescription,
    numberOfUnits,
    metricServingAmount,
    metricServingUnit,
    calories: Math.max(0, calories),
    protein_g: Math.max(0, protein),
    carbs_g: Math.max(0, carbs),
    fat_g: Math.max(0, fat),
    isDefault,
    isMetricStandard,
  }
}

function sortServings(servings: NormalizedFatSecretServing[]): NormalizedFatSecretServing[] {
  const score = (serving: NormalizedFatSecretServing) => {
    const metricUnit = serving.metricServingUnit
    const metricAmount = serving.metricServingAmount ?? 0
    const is100Metric =
      (metricUnit === 'g' || metricUnit === 'ml') &&
      Math.abs(metricAmount - 100) < 0.01

    // Higher is better
    return (
      (serving.isDefault ? 1000 : 0) +
      (is100Metric ? 500 : 0) +
      (serving.isMetricStandard ? 300 : 0) +
      ((metricUnit === 'g' || metricUnit === 'ml') ? 100 : 0) -
      Math.min(serving.servingDescription.length, 80)
    )
  }

  return [...servings].sort((a, b) => score(b) - score(a))
}

function extractServings(rawFood: any): NormalizedFatSecretServing[] {
  const rawServings =
    rawFood?.servings?.serving ??
    rawFood?.serving ??
    []

  return sortServings(
    asArray<any>(rawServings)
      .map(normalizeServing)
      .filter((serving): serving is NormalizedFatSecretServing => Boolean(serving)),
  )
}

function normalizeFoodSummary(rawFood: any): NormalizedFatSecretFoodSummary | null {
  if (!rawFood || typeof rawFood !== 'object') return null

  const foodId = clean(rawFood.food_id)
  const name = clean(rawFood.food_name)
  if (!foodId || !name) return null

  const servings = extractServings(rawFood)
  const defaultServing =
    servings.find((serving) => serving.isDefault) ??
    servings.find((serving) => serving.isMetricStandard) ??
    servings[0] ??
    null

  return {
    foodId,
    name,
    brandName: clean(rawFood.brand_name),
    foodType: clean(rawFood.food_type),
    defaultServing,
    servingCount: servings.length,
  }
}

function normalizeFoodDetail(rawFood: any) {
  const foodId = clean(rawFood?.food_id)
  const name = clean(rawFood?.food_name)
  if (!foodId || !name) return null

  const servings = extractServings(rawFood)
  const defaultServingId =
    servings.find((serving) => serving.isDefault)?.servingId ??
    servings.find((serving) => serving.isMetricStandard)?.servingId ??
    servings[0]?.servingId ??
    null

  return {
    foodId,
    name,
    brandName: clean(rawFood.brand_name),
    foodType: clean(rawFood.food_type),
    foodUrl: clean(rawFood.food_url),
    servings,
    defaultServingId,
  }
}

function getLocalizationParams(payload: any): URLSearchParams {
  const params = new URLSearchParams()
  const region = clean(payload?.region)?.toUpperCase()
  const language = clean(payload?.language)?.toLowerCase()

  if (region) params.set('region', region)
  if (language) params.set('language', language)

  return params
}

function normalizeWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[%(),]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function scoreQuickPickCandidate(seed: string, food: NormalizedFatSecretFoodSummary): number {
  const seedText = seed.trim().toLowerCase()
  const nameText = food.name.trim().toLowerCase()
  const brandText = (food.brandName ?? '').trim().toLowerCase()
  const foodType = (food.foodType ?? '').trim().toLowerCase()

  const seedWords = new Set(normalizeWords(seedText))
  const nameWords = new Set(normalizeWords(nameText))
  let overlap = 0
  seedWords.forEach((word) => {
    if (nameWords.has(word)) overlap += 1
  })

  const seedLen = Math.max(seedWords.size, 1)
  const overlapRatio = overlap / seedLen
  const isGeneric = foodType.includes('generic')
  const exactName = nameText === seedText
  const startsWith = nameText.startsWith(seedText)
  const includes = nameText.includes(seedText)

  return (
    (exactName ? 500 : 0) +
    (startsWith ? 300 : 0) +
    (includes ? 160 : 0) +
    Math.round(overlapRatio * 200) +
    (isGeneric ? 120 : 0) +
    (brandText ? -40 : 0) -
    Math.min(nameText.length, 100)
  )
}

function pickQuickPickCandidate(
  seed: string,
  foods: NormalizedFatSecretFoodSummary[],
): NormalizedFatSecretFoodSummary | null {
  if (foods.length === 0) return null
  return [...foods].sort((a, b) => scoreQuickPickCandidate(seed, b) - scoreQuickPickCandidate(seed, a))[0] ?? null
}

async function searchFoodSummariesForQuery(
  payload: any,
  query: string,
  maxResults: number,
): Promise<NormalizedFatSecretFoodSummary[]> {
  const params = getLocalizationParams(payload)
  params.set('search_expression', query)
  params.set('page_number', '0')
  params.set('max_results', String(Math.min(50, Math.max(1, maxResults))))
  params.set('flag_default_serving', 'true')
  params.set('format', 'json')

  const raw = await fatSecretGet(FATSECRET_SEARCH_PATH, params)
  const rawFoodsSearch = raw?.foods_search ?? {}
  const rawResults = rawFoodsSearch?.results ?? rawFoodsSearch
  const rawFoods = asArray<any>(rawResults?.food)

  return rawFoods
    .map(normalizeFoodSummary)
    .filter((food): food is NormalizedFatSecretFoodSummary => Boolean(food))
}

async function getFatSecretAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAtMs - TOKEN_REFRESH_BUFFER_MS) {
    return tokenCache.accessToken
  }

  const clientId = Deno.env.get('FATSECRET_CLIENT_ID')
  const clientSecret = Deno.env.get('FATSECRET_CLIENT_SECRET')
  const explicitScope = clean(Deno.env.get('FATSECRET_OAUTH2_SCOPE'))

  if (!clientId || !clientSecret) {
    throw new Error('Missing FATSECRET_CLIENT_ID or FATSECRET_CLIENT_SECRET')
  }

  const credentials = btoa(`${clientId}:${clientSecret}`)
  const body = new URLSearchParams({ grant_type: 'client_credentials' })
  if (explicitScope) body.set('scope', explicitScope)

  const response = await fetch(FATSECRET_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`FatSecret OAuth2 token request failed (${response.status}): ${text}`)
  }

  const data = await response.json()
  const accessToken = clean(data?.access_token)
  const expiresIn = parseIntNumber(data?.expires_in) ?? 3600

  if (!accessToken) {
    throw new Error('FatSecret OAuth2 token response missing access_token')
  }

  tokenCache = {
    accessToken,
    expiresAtMs: Date.now() + Math.max(60, expiresIn) * 1000,
  }

  return accessToken
}

async function fatSecretGet(pathname: string, params: URLSearchParams) {
  const accessToken = await getFatSecretAccessToken()
  const url = new URL(`${FATSECRET_REST_BASE_URL}${pathname}`)
  url.search = params.toString()

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`FatSecret API request failed (${response.status}): ${text}`)
  }

  const payload = await response.json()

  // FatSecret can return API errors in a 200 JSON envelope.
  const apiError = payload?.error
  const apiCode = clean(apiError?.code)
  const apiMessage =
    clean(apiError?.message) ??
    clean(apiError?.error_message) ??
    clean(apiError?.description)

  if (apiError && (apiCode || apiMessage)) {
    throw new Error(
      `FatSecret API error${apiCode ? ` (${apiCode})` : ''}: ${apiMessage ?? 'Unknown error'}`
    )
  }

  return payload
}

async function handleSearch(payload: any): Promise<Response> {
  const query = clean(payload?.query)
  if (!query || query.length < 2) {
    return errorResponse(400, 'query must be at least 2 characters')
  }

  const pageNumber = Math.max(0, parseIntNumber(payload?.pageNumber) ?? 0)
  const maxResults = Math.min(50, Math.max(1, parseIntNumber(payload?.maxResults) ?? 20))

  const params = getLocalizationParams(payload)
  params.set('search_expression', query)
  params.set('page_number', String(pageNumber))
  params.set('max_results', String(maxResults))
  params.set('flag_default_serving', 'true')
  params.set('format', 'json')

  const raw = await fatSecretGet(FATSECRET_SEARCH_PATH, params)
  const rawFoodsSearch = raw?.foods_search ?? {}
  const rawResults = rawFoodsSearch?.results ?? rawFoodsSearch
  const rawFoods = asArray<any>(rawResults?.food)
  const foods = rawFoods
    .map(normalizeFoodSummary)
    .filter((food): food is NormalizedFatSecretFoodSummary => Boolean(food))

  return jsonResponse({
    action: 'search',
    query,
    pageNumber:
      parseIntNumber(rawResults?.page_number) ??
      parseIntNumber(rawFoodsSearch?.page_number) ??
      pageNumber,
    maxResults:
      parseIntNumber(rawResults?.max_results) ??
      parseIntNumber(rawFoodsSearch?.max_results) ??
      maxResults,
    totalResults:
      parseIntNumber(rawResults?.total_results) ??
      parseIntNumber(rawFoodsSearch?.total_results),
    foods,
  })
}

async function handleQuickPicks(payload: any): Promise<Response> {
  const limit = Math.min(
    QUICK_PICKS_MAX_LIMIT,
    Math.max(1, parseIntNumber(payload?.limit) ?? QUICK_PICKS_DEFAULT_LIMIT),
  )
  const region = clean(payload?.region)?.toUpperCase() ?? 'US'
  const language = clean(payload?.language)?.toLowerCase() ?? 'en'
  const cacheKey = `${region}:${language}:${limit}`
  const cached = quickPicksCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAtMs) {
    return jsonResponse({
      action: 'quick_picks',
      foods: cached.foods,
      totalSeeds: POPULAR_FOOD_QUICK_PICK_SEEDS.length,
      resolvedCount: cached.foods.length,
      source: 'cache',
    })
  }

  const seeds = POPULAR_FOOD_QUICK_PICK_SEEDS.slice(0, QUICK_PICKS_MAX_LIMIT)
  const results: NormalizedFatSecretFoodSummary[] = []
  const seenFoodIds = new Set<string>()
  let cursor = 0

  const worker = async () => {
    while (results.length < limit) {
      const currentIndex = cursor++
      if (currentIndex >= seeds.length) return

      const seed = seeds[currentIndex]
      try {
        const candidates = await searchFoodSummariesForQuery(
          payload,
          seed,
          QUICK_PICKS_SEARCH_MAX_RESULTS,
        )
        const best = pickQuickPickCandidate(seed, candidates)
        if (!best || seenFoodIds.has(best.foodId)) continue
        seenFoodIds.add(best.foodId)
        results.push(best)
      } catch (error) {
        console.warn('[fatsecret-foods] quick pick seed failed:', seed, error)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(QUICK_PICKS_CONCURRENCY, seeds.length) }, () => worker()),
  )

  const foods = results.slice(0, limit)
  quickPicksCache.set(cacheKey, {
    foods,
    expiresAtMs: Date.now() + QUICK_PICKS_CACHE_TTL_MS,
  })

  return jsonResponse({
    action: 'quick_picks',
    foods,
    totalSeeds: POPULAR_FOOD_QUICK_PICK_SEEDS.length,
    resolvedCount: foods.length,
    source: 'live',
  })
}

async function handleFood(payload: any): Promise<Response> {
  const foodId = clean(payload?.foodId)
  if (!foodId) {
    return errorResponse(400, 'foodId is required')
  }

  const params = getLocalizationParams(payload)
  params.set('food_id', foodId)
  params.set('flag_default_serving', 'true')
  params.set('format', 'json')

  const raw = await fatSecretGet(FATSECRET_FOOD_PATH, params)
  const food = normalizeFoodDetail(raw?.food)
  if (!food) {
    return errorResponse(404, 'Food not found')
  }

  return jsonResponse({
    action: 'food',
    food,
  })
}

serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  try {
    const bearer = req.headers.get('Authorization')
    const accessToken = bearer?.startsWith('Bearer ')
      ? bearer.slice('Bearer '.length).trim()
      : undefined

    if (!accessToken) {
      return errorResponse(401, 'Unauthorized')
    }

    const supabase = createUserClient(accessToken)
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData?.user) {
      return errorResponse(401, 'Unauthorized')
    }

    const payload = await req.json()
    const action = clean(payload?.action)

    if (action === 'search') {
      return await handleSearch(payload)
    }

    if (action === 'quick_picks') {
      return await handleQuickPicks(payload)
    }

    if (action === 'food') {
      return await handleFood(payload)
    }

    return errorResponse(400, 'Invalid action')
  } catch (error) {
    console.error('[fatsecret-foods] request failed:', error)
    return errorResponse(500, error instanceof Error ? error.message : String(error))
  }
})
