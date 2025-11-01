export type ApiErrorCode =
  | 'ZOD_INVALID'
  | 'UNAUTHORIZED'
  | 'CONTENT_REFUSED'
  | 'PARSE_FAILED'
  | 'DB_FAILED'
  | 'NETWORK'
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

export function mapApiErrorToMessage(error: ApiError): string {
  switch (error.code) {
    case 'ZOD_INVALID':
      return 'Invalid request data. Please check the workout details and try again.'
    case 'UNAUTHORIZED':
      return 'You need to sign in again before posting workouts.'
    case 'CONTENT_REFUSED':
      return 'The AI could not recognize this as a workout. Add more detail and try again.'
    case 'PARSE_FAILED':
      return 'The AI had trouble parsing that workout. Give it another shot in a moment.'
    case 'DB_FAILED':
      return 'We parsed your workout but failed to save it. Please retry shortly.'
    case 'NETWORK':
      return 'Network error. Check your connection and retry.'
    default:
      return 'Unexpected error. Please try again.'
  }
}
