// @ts-ignore: Remote import for Deno edge runtime
import { createOpenRouter } from 'npm:@openrouter/ai-sdk-provider'

// OpenRouter model identifiers
export const GEMINI_MODEL = 'google/gemini-3-flash-preview'
export const GEMINI_FALLBACK_MODEL = 'google/gemini-2.0-flash-001'

// Create OpenRouter provider instance
// API key is read from OPENROUTER_API_KEY environment variable
const openrouter = createOpenRouter({
  apiKey: Deno.env.get('OPENROUTER_API_KEY'),
})

/**
 * Returns a Gemini model instance via OpenRouter for text-only operations.
 */
export function getGeminiModel() {
  return openrouter.chat(GEMINI_MODEL)
}

/**
 * Returns a specific model via OpenRouter by name.
 * @param model - The model identifier (e.g., 'google/gemini-3-flash-preview')
 */
export function getModel(model: string) {
  return openrouter.chat(model)
}

export { openrouter }


