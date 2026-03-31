import { appFetch } from '@/lib/fetch'
import { getSupabaseFunctionBaseUrl } from '@/lib/supabase-functions-client'

import { ApiError, ApiErrorCode, isApiError, toApiErrorShape } from './errors'

type ChatErrorPayload = {
  error?: string
  code?: ApiErrorCode
  details?: unknown
  correlationId?: string
}

type ChatRequestOptions = {
  accessToken?: string
  retryCount?: number
  preferNoStream?: boolean
}

const RETRIABLE_CHAT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

function mapStatusToApiErrorCode(status: number): ApiErrorCode {
  if (status === 400) return 'ZOD_INVALID'
  if (status === 401 || status === 403) return 'UNAUTHORIZED'
  return 'UNKNOWN'
}

async function readChatErrorPayload(
  response: Response,
): Promise<ChatErrorPayload | null> {
  const responseText = await response.text()
  if (!responseText) return null

  try {
    return JSON.parse(responseText) as ChatErrorPayload
  } catch {
    return { error: responseText }
  }
}

export async function callChatFunction(
  body: unknown,
  options: ChatRequestOptions = {},
): Promise<Response> {
  const { accessToken, retryCount = 1, preferNoStream = false } = options
  const url = `${getSupabaseFunctionBaseUrl()}/chat`
  let lastError: ApiError | null = null

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await appFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(preferNoStream ? { 'x-no-stream': '1' } : {}),
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {}),
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        return response
      }

      const payload = await readChatErrorPayload(response)
      lastError = new ApiError(
        toApiErrorShape(payload ?? {}, {
          error:
            payload?.error ??
            `Failed to get response: ${response.status} ${response.statusText}`,
          code: mapStatusToApiErrorCode(response.status),
          details: payload?.details,
          correlationId: payload?.correlationId,
          httpStatus: response.status,
        }),
      )

      if (
        attempt < retryCount &&
        RETRIABLE_CHAT_STATUSES.has(response.status)
      ) {
        await wait(250 * (attempt + 1))
        continue
      }

      throw lastError
    } catch (error) {
      if (isApiError(error)) {
        throw error
      }

      lastError = new ApiError({
        error: 'Network error calling chat',
        code: 'NETWORK',
        details: error,
      })

      if (attempt < retryCount) {
        await wait(250 * (attempt + 1))
        continue
      }

      throw lastError
    }
  }

  throw (
    lastError ??
    new ApiError({
      error: 'Unexpected chat request failure',
      code: 'UNKNOWN',
    })
  )
}

export function mapChatApiErrorToMessage(error: unknown): string {
  if (!isApiError(error)) {
    return "Sorry, I couldn't process that request. Please try again."
  }

  if (error.httpStatus === 413) {
    return 'That conversation got too long. Please start a new chat or send a shorter follow-up.'
  }

  if (error.httpStatus === 429) {
    return 'The AI is busy right now. Please try again in a moment.'
  }

  if (error.httpStatus && error.httpStatus >= 500) {
    return 'The AI service had a temporary issue. Please try again.'
  }

  switch (error.code) {
    case 'NETWORK':
      return 'Network error. Check your connection and try again.'
    case 'UNAUTHORIZED':
      return 'Your session expired. Please sign in again.'
    case 'ZOD_INVALID':
      return 'That request was malformed. Please try again.'
    default:
      return "Sorry, I couldn't process that request. Please try again."
  }
}
