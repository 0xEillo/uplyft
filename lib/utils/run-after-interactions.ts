/**
 * Replacement for deprecated InteractionManager.runAfterInteractions.
 * Uses requestIdleCallback (RN 0.82+) per React Native's recommendation.
 */
export function runAfterInteractions(callback: () => void): { cancel?: () => void } {
  if (typeof requestIdleCallback !== 'undefined') {
    const id = requestIdleCallback(callback, { timeout: 50 })
    return {
      cancel: () => {
        if (typeof cancelIdleCallback !== 'undefined') {
          cancelIdleCallback(id)
        }
      },
    }
  }
  const id = setImmediate(callback)
  return {
    cancel: () => clearImmediate(id),
  }
}
