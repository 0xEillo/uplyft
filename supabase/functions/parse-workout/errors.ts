import { jsonResponse } from '../_shared/cors.ts'

export type ApiErrorCode =
  | 'ZOD_INVALID'
  | 'UNAUTHORIZED'
  | 'CONTENT_REFUSED'
  | 'PARSE_FAILED'
  | 'DB_FAILED'
  | 'UNKNOWN'

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details?: unknown

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function toErrorResponse(
  error: ApiError,
  correlationId?: string,
): Response {
  const body: Record<string, unknown> = {
    error: error.message,
    code: error.code,
  }

  if (error.details !== undefined) {
    body.details = error.details
  }

  if (correlationId) {
    body.correlationId = correlationId
  }

  return jsonResponse(body, { status: error.status })
}

export function normalizeError(error: unknown, fallback?: ApiError): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (fallback) {
    return fallback
  }

  return new ApiError(500, 'UNKNOWN', 'Unexpected error occurred', {
    error: error instanceof Error ? error.message : String(error),
  })
}
