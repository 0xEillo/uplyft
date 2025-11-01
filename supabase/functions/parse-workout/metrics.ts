export function createCorrelationId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

export function logWithCorrelation(
  correlationId: string,
  message: string,
  ...args: unknown[]
): void {
  console.log(`[ParseWorkout][${correlationId}] ${message}`, ...args)
}

export function logErrorWithCorrelation(
  correlationId: string,
  message: string,
  error: unknown,
): void {
  console.error(`[ParseWorkout][${correlationId}] ${message}`, error)
}
