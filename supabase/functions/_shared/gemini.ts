// @ts-ignore: Remote import for Deno edge runtime
import { google } from 'npm:@ai-sdk/google'

export const GEMINI_MODEL = 'gemini-2.5-flash-preview-09-2025'

/**
 * Returns a Gemini model instance for text-only operations.
 * API key is automatically read from GEMINI_API_KEY environment variable.
 */
export function getGeminiModel() {
  return google(GEMINI_MODEL)
}
