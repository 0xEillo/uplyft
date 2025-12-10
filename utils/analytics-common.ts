/**
 * Common Analytics Utilities
 *
 * Standalone utilities that do not depend on React contexts.
 */

// ============================================================================
// SESSION TRACKING
// ============================================================================

let sessionId: string | null = null

/**
 * Generates or retrieves the current session ID
 */
export function getSessionId(): string {
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`
  }
  return sessionId
}

/**
 * Clears the current session (call on app close or logout)
 */
export function clearSession() {
  sessionId = null
}

// ============================================================================
// PROPERTY FILTERING
// ============================================================================

/**
 * Removes undefined values from event properties
 * (PostHog doesn't accept undefined, only null)
 */
export function filterProperties<T extends Record<string, unknown>>(
  properties: T,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties).filter(([_, value]) => value !== undefined),
  )
}

// ============================================================================
// VALIDATION (Development only)
// ============================================================================

/**
 * Validates event properties in development mode
 * Logs warnings for missing recommended properties
 */
export function validateEventProperties(
  eventName: string,
  properties?: Record<string, unknown>,
): void {
  if (__DEV__) {
    // Add timestamp if missing
    if (properties && !properties.timestamp) {
      console.warn(
        `[Analytics] Event "${eventName}" is missing timestamp. Consider adding it for better tracking.`,
      )
    }

    // Warn about empty objects
    if (properties && Object.keys(properties).length === 0) {
      console.warn(
        `[Analytics] Event "${eventName}" has no properties. Consider adding context.`,
      )
    }
  }
}
