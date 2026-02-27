import { callSupabaseFunction } from '@/lib/supabase-functions-client'
import { supabase } from '@/lib/supabase'

export type FatSecretServing = {
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

export type FatSecretFoodSummary = {
  foodId: string
  name: string
  brandName: string | null
  foodType: string | null
  defaultServing: FatSecretServing | null
  servingCount: number
}

export type FatSecretFoodDetail = {
  foodId: string
  name: string
  brandName: string | null
  foodType: string | null
  foodUrl: string | null
  servings: FatSecretServing[]
  defaultServingId: string | null
}

type FatSecretSearchResponse = {
  action: 'search'
  query: string
  pageNumber: number
  maxResults: number
  totalResults: number | null
  foods: FatSecretFoodSummary[]
}

type FatSecretFoodResponse = {
  action: 'food'
  food: FatSecretFoodDetail
}

type FatSecretQuickPicksResponse = {
  action: 'quick_picks'
  foods: FatSecretFoodSummary[]
  totalSeeds: number
  resolvedCount: number
  source: 'live' | 'cache'
}

async function getAccessToken(): Promise<string | undefined> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.access_token
}

async function callFatSecretProxy<T>(body: Record<string, unknown>): Promise<T> {
  const accessToken = await getAccessToken()
  const response = await callSupabaseFunction(
    'fatsecret-foods',
    'POST',
    body,
    undefined,
    accessToken,
  )

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : `FatSecret proxy error (${response.status})`
    throw new Error(message)
  }

  return payload as T
}

export async function searchFatSecretFoods(input: {
  query: string
  pageNumber?: number
  maxResults?: number
  region?: string
  language?: string
}): Promise<FatSecretSearchResponse> {
  return callFatSecretProxy<FatSecretSearchResponse>({
    action: 'search',
    query: input.query,
    pageNumber: input.pageNumber ?? 0,
    maxResults: input.maxResults ?? 20,
    region: input.region ?? 'US',
    language: input.language ?? 'en',
  })
}

export async function getFatSecretFood(input: {
  foodId: string
  region?: string
  language?: string
}): Promise<FatSecretFoodResponse> {
  return callFatSecretProxy<FatSecretFoodResponse>({
    action: 'food',
    foodId: input.foodId,
    region: input.region ?? 'US',
    language: input.language ?? 'en',
  })
}

export async function getFatSecretQuickPicks(input?: {
  limit?: number
  region?: string
  language?: string
}): Promise<FatSecretQuickPicksResponse> {
  return callFatSecretProxy<FatSecretQuickPicksResponse>({
    action: 'quick_picks',
    limit: input?.limit ?? 16,
    region: input?.region ?? 'US',
    language: input?.language ?? 'en',
  })
}
