import { supabase } from '@/lib/supabase'

/**
 * Get the base URL for Supabase Edge Functions.
 * This is constructed from the Supabase project URL.
 */
export function getSupabaseFunctionBaseUrl(): string {
  const projectUrl = supabase.supabaseUrl
  if (!projectUrl) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is not configured')
  }
  // Supabase functions are at: https://{project-ref}.supabase.co/functions/v1/{function-name}
  return `${projectUrl}/functions/v1`
}

/**
 * Call a Supabase Edge Function and return the response as JSON.
 *
 * @param functionName - The name of the edge function (e.g., 'transcribe', 'parse-workout')
 * @param method - HTTP method (default: POST)
 * @param body - Request body (will be JSON-stringified)
 * @param headers - Additional headers to include
 * @param accessToken - Optional auth token for the user
 * @returns The parsed JSON response
 *
 * @example
 * const { text } = await callSupabaseFunction('transcribe', 'POST', formData)
 */
export async function callSupabaseFunction(
  functionName: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'POST',
  body?: unknown,
  headers?: Record<string, string>,
  accessToken?: string,
): Promise<Response> {
  const url = `${getSupabaseFunctionBaseUrl()}/${functionName}`

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (accessToken) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  })

  return response
}

/**
 * Call a Supabase Edge Function with FormData (for file uploads).
 *
 * @param functionName - The name of the edge function
 * @param formData - FormData instance with the data
 * @param accessToken - Optional auth token for the user
 * @returns The parsed JSON response
 *
 * @example
 * const formData = new FormData()
 * formData.append('audio', audioFile)
 * const { text } = await callSupabaseFunctionWithFormData('transcribe', formData)
 */
export async function callSupabaseFunctionWithFormData(
  functionName: string,
  formData: FormData,
  accessToken?: string,
): Promise<Response> {
  const url = `${getSupabaseFunctionBaseUrl()}/${functionName}`

  const headers: Record<string, string> = {}
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  })

  return response
}
