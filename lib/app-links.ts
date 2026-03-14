import AsyncStorage from '@react-native-async-storage/async-storage'

export const APP_STORE_URL =
  'https://apps.apple.com/app/rep-ai-workout-tracker/id6753986473'
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.viralstudio.repai'
export const APP_BASE_URL = 'https://www.repaifit.app'

const PENDING_INVITE_STORAGE_KEY = '@repai/pending-invite'
const PENDING_INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14

export type InvitePayload = {
  inviterId: string
  inviterTag?: string | null
  inviterName?: string | null
}

type PendingInvitePayload = {
  inviterId: string
  savedAt: number
}

type RawParam = string | string[] | undefined

const firstParam = (value: RawParam): string | undefined =>
  Array.isArray(value) ? value[0] : value

export const buildAppUrl = (path = ''): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return path ? `${APP_BASE_URL}${normalizedPath}` : APP_BASE_URL
}

export const buildInviteUrl = (inviterId: string): string => {
  return buildAppUrl(`/invite/${encodeURIComponent(inviterId)}`)
}

export const createInviteShareLink = async (
  payload: InvitePayload,
): Promise<string> => {
  return buildInviteUrl(payload.inviterId)
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
