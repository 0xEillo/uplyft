export type ApiErrorCode =
  | 'ZOD_INVALID'
  | 'UNAUTHORIZED'
  | 'CONTENT_REFUSED'
  | 'PARSE_FAILED'
  | 'DB_FAILED'
  | 'NETWORK'
  | 'RATE_LIMITED'
  | 'FREE_LIMIT_REACHED'
  | 'UNKNOWN'

export interface ApiErrorShape {
  error: string
  code: ApiErrorCode
  details?: unknown
  correlationId?: string
  httpStatus?: number
}

export class ApiError extends Error {
  public readonly code: ApiErrorCode
  public readonly details?: unknown
  public readonly correlationId?: string
  public readonly httpStatus?: number

  constructor(payload: ApiErrorShape) {
    super(payload.error)
    this.name = 'ApiError'
    this.code = payload.code
    this.details = payload.details
    this.correlationId = payload.correlationId
    this.httpStatus = payload.httpStatus
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function toApiErrorShape(
  input: Partial<ApiErrorShape> & { error?: string },
  fallback: ApiErrorShape,
): ApiErrorShape {
  return {
    error: input.error ?? fallback.error,
    code: (input.code as ApiErrorCode) ?? fallback.code,
    details: input.details ?? fallback.details,
    correlationId: input.correlationId ?? fallback.correlationId,
    httpStatus: input.httpStatus ?? fallback.httpStatus,
  }
}

