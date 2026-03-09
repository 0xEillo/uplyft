import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { callSupabaseFunction } from './supabase-functions-client'

export const APP_STORE_URL =
  'https://apps.apple.com/app/rep-ai-workout-tracker/id6753986473'
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.viralstudio.repai'
export const WEB_FALLBACK_URL = 'https://www.repaifit.app'

const PENDING_INVITE_STORAGE_KEY = '@repai/pending-invite'
const PENDING_INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14

export type InvitePayload = {
  inviterId: string
  inviterTag?: string | null
  inviterName?: string | null
}

export type InviteLinkOptions = {
  accessToken?: string
  platform?: string
}

type PendingInvitePayload = {
  inviterId: string
  savedAt: number
}

type RawParam = string | string[] | undefined

const firstParam = (value: RawParam): string | undefined =>
  Array.isArray(value) ? value[0] : value

export const getStoreFallbackUrl = (): string => {
  if (Platform.OS === 'ios') return APP_STORE_URL
  if (Platform.OS === 'android') return PLAY_STORE_URL
  return WEB_FALLBACK_URL
}

export const buildInviteWebUrl = (inviterId: string): string => {
  return `${WEB_FALLBACK_URL}/invite/${encodeURIComponent(inviterId)}`
}

export const buildInviteDeepLinkUrl = (payload: InvitePayload): string => {
  return `repai://invite/${encodeURIComponent(payload.inviterId)}`
}

const extractCreatedLinkUrl = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null

  const response = data as {
    url?: string
    shortUrl?: string
    short_url?: string
    linkUrl?: string
    link_url?: string
    data?: {
      url?: string
      shortUrl?: string
      short_url?: string
      linkUrl?: string
      link_url?: string
    }
  }

  return (
    response.shortUrl ||
    response.short_url ||
    response.linkUrl ||
    response.link_url ||
    response.url ||
    response.data?.shortUrl ||
    response.data?.short_url ||
    response.data?.linkUrl ||
    response.data?.link_url ||
    response.data?.url ||
    null
  )
}

export const createInviteShareLink = async (
  payload: InvitePayload,
  options: InviteLinkOptions = {},
): Promise<string> => {
  const normalizedPlatform =
    options.platform === 'android' || options.platform === 'ios'
      ? options.platform
      : 'web'
  const fallbackUrl = buildInviteWebUrl(payload.inviterId)

  if (options.accessToken) {
    try {
      const response = await callSupabaseFunction(
        'create-invite-link',
        'POST',
        {
          platform: normalizedPlatform,
        },
        {},
        options.accessToken,
      )

      if (response.ok) {
        const data = (await response.json()) as unknown
        const createdLink = extractCreatedLinkUrl(data)
        if (createdLink) return createdLink
      }
    } catch (error) {
      console.warn('[DeeplinkNow] Failed to create invite link:', error)
    }
  }

  return fallbackUrl
}

export const parseInvitePayload = (
  params: Record<string, RawParam>,
): InvitePayload | null => {
  const inviterId =
    firstParam(params.inviterId) ||
    firstParam(params.inviter_id) ||
    firstParam(params.referrerId) ||
    firstParam(params.referrer_id) ||
    firstParam(params.ref)

  if (!inviterId) return null

  return {
    inviterId,
    inviterTag: firstParam(params.inviterTag) || firstParam(params.inviter_tag),
    inviterName:
      firstParam(params.inviterName) || firstParam(params.inviter_name),
  }
}

export const savePendingInvite = async (
  inviterId: string,
): Promise<void> => {
  const record: PendingInvitePayload = {
    inviterId,
    savedAt: Date.now(),
  }
  await AsyncStorage.setItem(PENDING_INVITE_STORAGE_KEY, JSON.stringify(record))
}

export const consumePendingInvite = async (): Promise<string | null> => {
  const raw = await AsyncStorage.getItem(PENDING_INVITE_STORAGE_KEY)
  if (!raw) return null

  await AsyncStorage.removeItem(PENDING_INVITE_STORAGE_KEY)

  try {
    const parsed = JSON.parse(raw) as PendingInvitePayload
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.inviterId !== 'string' ||
      parsed.inviterId.length === 0 ||
      typeof parsed.savedAt !== 'number'
    ) {
      return null
    }

    if (Date.now() - parsed.savedAt > PENDING_INVITE_TTL_MS) {
      return null
    }

    return parsed.inviterId
  } catch {
    return null
  }
}
