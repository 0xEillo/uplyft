import { createOpenRouter } from 'npm:@openrouter/ai-sdk-provider@3.1.0'

// OpenRouter model identifiers
export const GEMINI_MODEL = 'google/gemini-3.1-flash-lite'
export const GEMINI_FALLBACK_MODEL = 'google/gemini-3.5-flash-lite'

// API key is read from the OPENROUTER_API_KEY secret.
// 'strict' compatibility sends OpenRouter-only fields (stream usage etc.).
export const openrouter = createOpenRouter({
  apiKey: Deno.env.get('OPENROUTER_API_KEY'),
  compatibility: 'strict',
  appName: 'Rep AI',
})

/**
 * Returns a Gemini model instance via OpenRouter for text-only operations.
 */
export function getGeminiModel(): ReturnType<typeof openrouter.chat> {
  return openrouter.chat(GEMINI_MODEL)
}

/**
 * Returns a specific model via OpenRouter by name.
 * @param model - The model identifier (e.g., GEMINI_MODEL)
 */
export function getModel(model: string): ReturnType<typeof openrouter.chat> {
  return openrouter.chat(model)
}

/**
 * The chat model. OpenRouter falls back to the next model in `models` if the
 * primary errors or is unavailable, before any output is streamed.
 */
export function getChatModel(): ReturnType<typeof openrouter.chat> {
  return openrouter.chat(GEMINI_MODEL, {
    models: [GEMINI_MODEL, GEMINI_FALLBACK_MODEL],
  })
}
