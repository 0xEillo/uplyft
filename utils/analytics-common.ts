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
