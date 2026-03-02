import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'

import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabase.ts'

const APP_STORE_URL =
  'https://apps.apple.com/app/rep-ai-workout-tracker/id6753986473'
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.viralstudio.repai'
const WEB_FALLBACK_URL = 'https://www.repaifit.app'

type PlatformName = 'ios' | 'android' | 'web'

type RequestBody = {
  platform?: string
}

function normalizeDomain(value?: string | null): string | null {
  if (!value) return null
  const withoutProtocol = value.replace(/^https?:\/\//i, '')
  const withoutTrailingSlash = withoutProtocol.replace(/\/+$/g, '')
  return withoutTrailingSlash || null
}

function normalizePlatform(value?: string): PlatformName {
  if (value === 'ios' || value === 'android') return value
  return 'web'
}

function getFallbackUrl(platform: PlatformName): string {
  if (platform === 'ios') return APP_STORE_URL
  if (platform === 'android') return PLAY_STORE_URL
  return WEB_FALLBACK_URL
}

function buildQueryString(
  params: Record<string, string | null | undefined>,
): string {
  const entries = Object.entries(params).filter(
    ([, value]) => typeof value === 'string' && value.length > 0,
  ) as [string, string][]

  return entries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&')
}

function buildInviteDeepLink(
  inviterId: string,
  inviterTag?: string | null,
  inviterName?: string | null,
): string {
  const query = buildQueryString({
    inviterId,
    inviterTag: inviterTag ?? undefined,
    inviterName: inviterName ?? undefined,
  })

  return query.length > 0 ? `repai://invite?${query}` : 'repai://invite'
}

function buildDomainInviteUrl(
  domain: string | null,
  inviterId: string,
  inviterTag?: string | null,
  inviterName?: string | null,
): string | null {
  if (!domain) return null
  const query = buildQueryString({
    inviterId,
    inviterTag: inviterTag ?? undefined,
    inviterName: inviterName ?? undefined,
  })
  return query.length > 0
    ? `https://${domain}/invite?${query}`
    : `https://${domain}/invite`
}

function extractCreatedLinkUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null

  const result = payload as {
    shortUrl?: string
    short_url?: string
    url?: string
    data?: {
      shortUrl?: string
      short_url?: string
      url?: string
    }
  }

  return (
    result.shortUrl ||
    result.short_url ||
    result.url ||
    result.data?.shortUrl ||
    result.data?.short_url ||
    result.data?.url ||
    null
  )
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const accessToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!accessToken) {
      return errorResponse(401, 'Missing access token')
    }

    let body: RequestBody = {}
    try {
      body = (await req.json()) as RequestBody
    } catch {
      body = {}
    }

    const platform = normalizePlatform(body.platform)

    const userClient = createUserClient(accessToken)
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return errorResponse(401, 'Invalid access token')
    }

    const service = createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('user_tag, display_name')
      .eq('id', user.id)
      .maybeSingle()

    const inviterTag = (profile?.user_tag as string | null | undefined) ?? null
    const inviterName =
      (profile?.display_name as string | null | undefined) ?? null

    const deepLinkUrl = buildInviteDeepLink(user.id, inviterTag, inviterName)
    const fallbackUrl = getFallbackUrl(platform)
    const deeplinkDomain = normalizeDomain(Deno.env.get('DEEPLINKNOW_DOMAIN'))
    const domainInviteUrl = buildDomainInviteUrl(
      deeplinkDomain,
      user.id,
      inviterTag,
      inviterName,
    )

    const privateApiKey = Deno.env.get('DEEPLINKNOW_PRIVATE_API_KEY')
    if (!privateApiKey) {
      return jsonResponse({
        url: domainInviteUrl || deepLinkUrl,
        deepLinkUrl,
        fallbackUrl,
        provider: 'fallback',
      })
    }

    const createResponse = await fetch(
      'https://api.deeplinknow.com/api/v1/deeplinks',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': privateApiKey,
        },
        body: JSON.stringify({
          title: 'Join me on Rep AI',
          description:
            'Track workouts, share progress, and train with friends on Rep AI.',
          deepLinkUrl,
          fallbackUrl,
          metadata: {
            inviterId: user.id,
            inviterTag,
          },
        }),
      },
    )

    if (!createResponse.ok) {
      const details = await createResponse.text()
      return errorResponse(502, 'Failed to create DeeplinkNow link', details)
    }

    const deeplinkPayload = (await createResponse.json()) as unknown
    const createdUrl = extractCreatedLinkUrl(deeplinkPayload)

    return jsonResponse({
      url: createdUrl || domainInviteUrl || deepLinkUrl,
      deepLinkUrl,
      fallbackUrl,
      provider: createdUrl ? 'deeplinknow' : 'fallback',
    })
  } catch (error) {
    return errorResponse(500, 'Unexpected error creating invite link', {
      message: error instanceof Error ? error.message : String(error),
    })
  }
})
