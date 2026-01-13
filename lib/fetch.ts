import { Platform } from 'react-native'

/**
 * A fetch wrapper that supports streaming response bodies on native platforms.
 * It uses 'expo/fetch' on native (which supports Response.body.getReader())
 * and the global fetch on web.
 */
export const appFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  if (Platform.OS !== 'web') {
    try {
      // Try to use Expo's native fetch implementation if available
      // @ts-ignore - expo/fetch might not be in the type definitions yet
      const { fetch: expoFetch } = require('expo/fetch')
      if (expoFetch) {
        return expoFetch(input, init)
      }
    } catch (e) {
      // Ignore checks if module is missing, fallback to global fetch
      // console.warn('expo/fetch not found, falling back to global fetch')
    }
  }

  // Fallback for web or if expo/fetch is unavailable
  return fetch(input, init)
}
