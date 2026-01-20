// deno-lint-ignore-file no-explicit-any
// @ts-ignore: Supabase Edge Functions run in Deno and resolve remote modules
// eslint-disable-next-line import/no-unresolved
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
// @ts-ignore: Supabase Edge Functions run in Deno and resolve remote modules
// eslint-disable-next-line import/no-unresolved
import { z } from 'https://esm.sh/zod@3.25.76'
import {
  buildBodyLogPrompt,
  parseBodyLogMetrics,
} from '../_shared/body-log-analysis.ts'
import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import { GEMINI_FALLBACK_MODEL, GEMINI_MODEL } from '../_shared/openrouter.ts'
import { createServiceClient, createUserClient } from '../_shared/supabase.ts'

const BODY_LOG_BUCKET = 'body-log'
const REQUEST_SCHEMA = z.object({
  entryId: z.string().min(1),
})

// Timeout for AI analysis
const ANALYZE_TIMEOUT_MS = 45000

async function analyzeWithModel(
  modelName: string,
  systemPrompt: string,
  userContent: any[],
): Promise<{ content: string; usage?: unknown }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.error(
      `[BODY_LOG] AI call (${modelName}) timed out after ${ANALYZE_TIMEOUT_MS}ms`,
    )
    controller.abort()
  }, ANALYZE_TIMEOUT_MS)

  const startTime = Date.now()

  try {
    console.log(
      `[BODY_LOG] Trying ${modelName}, timeout: ${ANALYZE_TIMEOUT_MS}ms`,
    )

    // @ts-ignore: Deno env is available in Supabase Edge Functions
    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY')
    }

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://uplyft.app',
          'X-Title': 'Uplyft Body Log Analysis',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userContent,
            },
          ],
          temperature: 0.2,
        }),
        signal: controller.signal,
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `OpenRouter error (${response.status}): ${
          errorText || response.statusText
        }`,
      )
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content

    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('OpenRouter returned empty response')
    }

    const elapsed = Date.now() - startTime
    console.log(`[BODY_LOG] ${modelName} succeeded in ${elapsed}ms`)
    console.log(
      `[BODY_LOG] Response usage: ${JSON.stringify(data?.usage ?? 'N/A')}`,
    )

    return { content, usage: data?.usage }
  } finally {
    clearTimeout(timeoutId)
  }
}

serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  try {
    const bearer = req.headers.get('Authorization')
    const accessToken = bearer?.startsWith('Bearer ')
      ? bearer.slice('Bearer '.length).trim()
      : undefined

    if (!accessToken) {
      return errorResponse(401, 'Unauthorized')
    }

    const payload = REQUEST_SCHEMA.parse(await req.json())
    const { entryId } = payload

    const supabase = createUserClient(accessToken)
    const serviceClient = createServiceClient()

    // Verify user is authenticated
    const { data: userData, error: authError } = await supabase.auth.getUser()

    if (authError || !userData?.user) {
      console.error('[BODY_LOG] ❌ EdgeFunction: Authentication failed')
      return errorResponse(401, 'Unauthorized')
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, age, height_cm, weight_kg')
      .eq('id', userData.user.id)
      .single()

    if (profileError || !profile) {
      return errorResponse(404, 'Profile not found')
    }

    // Get the body log entry
    const { data: entry, error: entryError } = await supabase
      .from('body_log_entries')
      .select('*')
      .eq('id', entryId)
      .single()

    if (entryError || !entry) {
      return errorResponse(404, 'Body log entry not found')
    }

    // Verify ownership
    if (entry.user_id !== userData.user.id) {
      return errorResponse(403, 'Forbidden')
    }

    // Get all images for this entry
    const { data: images, error: imagesError } = await supabase
      .from('body_log_images')
      .select('*')
      .eq('entry_id', entryId)
      .order('sequence', { ascending: true })

    if (imagesError || !images || images.length === 0) {
      return errorResponse(404, 'No images found for this entry')
    }

    // Create signed URLs instead of base64 to avoid memory spikes
    const imageUrls: string[] = []
    const signedUrlTTLSeconds = 60 * 30

    for (const img of images) {
      const {
        data: signed,
        error: signedError,
      } = await serviceClient.storage
        .from(BODY_LOG_BUCKET)
        .createSignedUrl(img.file_path, signedUrlTTLSeconds)

      if (signedError || !signed?.signedUrl) {
        console.error(
          `[BODY_LOG] Failed to sign ${img.file_path}:`,
          signedError,
        )
        throw new Error(`Failed to sign image: ${img.file_path}`)
      }

      imageUrls.push(signed.signedUrl)
    }

    // Build the system prompt with user context
    let systemPrompt = buildBodyLogPrompt({
      display_name: profile.display_name,
      age: profile.age,
      height_cm: profile.height_cm,
      weight_kg: profile.weight_kg,
      createdAt: entry.created_at,
    })

    // Add multi-image instruction if applicable
    if (imageUrls.length > 1) {
      systemPrompt +=
        '\n\nIMPORTANT: You are analyzing MULTIPLE photos of the same person from different angles. Combine information from all photos to provide a SINGLE, more accurate assessment. Use triangulation between photos to improve accuracy of body fat %, BMI, and weight estimates.'
    }

    // Build user message with all images (using signed URLs)
    const userContent: any[] = [
      {
        type: 'text',
        text:
          imageUrls.length > 1
            ? 'Analyze these body composition photos from multiple angles and return combined JSON metrics.'
            : 'Analyze this body composition photo and return JSON metrics.',
      },
    ]

    // Add all images to the message as signed URLs
    for (const url of imageUrls) {
      userContent.push({
        type: 'image_url',
        image_url: { url },
      })
    }

    // Analyze with Gemini via OpenRouter (with fallback)
    let analysisContent: string

    try {
      const analysis = await analyzeWithModel(
        GEMINI_MODEL,
        systemPrompt,
        userContent,
      )
      analysisContent = analysis.content
    } catch (primaryError) {
      console.error(`[BODY_LOG] ${GEMINI_MODEL} failed:`, primaryError)

      // Try fallback model
      console.log(`[BODY_LOG] Falling back to ${GEMINI_FALLBACK_MODEL}...`)

      try {
        const analysis = await analyzeWithModel(
          GEMINI_FALLBACK_MODEL,
          systemPrompt,
          userContent,
        )
        analysisContent = analysis.content
      } catch (fallbackError) {
        console.error(
          `[BODY_LOG] ${GEMINI_FALLBACK_MODEL} also failed:`,
          fallbackError,
        )
        throw new Error('Failed to analyze body log images')
      }
    }

    // Parse the metrics using the shared parser for consistency
    const metrics = parseBodyLogMetrics(analysisContent)

    // Calculate lean mass and fat mass if possible
    const weight =
      typeof profile.weight_kg === 'number'
        ? profile.weight_kg
        : typeof entry.weight_kg === 'number'
        ? entry.weight_kg
        : null

    let leanMass: number | null = null
    let fatMass: number | null = null

    if (
      weight !== null &&
      metrics.body_fat_percentage !== null &&
      metrics.body_fat_percentage !== undefined
    ) {
      const fatPercent = metrics.body_fat_percentage / 100
      fatMass = Number((weight * fatPercent).toFixed(2))
      leanMass = Number((weight * (1 - fatPercent)).toFixed(2))
    }

    const updatePayload = {
      ...metrics,
      weight_kg: weight,
      lean_mass_kg: leanMass,
      fat_mass_kg: fatMass,
    }

    // Update entry metrics
    const { data: updated, error: updateError } = await supabase
      .from('body_log_entries')
      .update(updatePayload)
      .eq('id', entryId)
      .select(
        'id, weight_kg, body_fat_percentage, bmi, muscle_mass_kg, lean_mass_kg, fat_mass_kg, score_v_taper, score_chest, score_shoulders, score_abs, score_arms, score_back, score_legs, analysis_summary',
      )
      .single()

    if (updateError || !updated) {
      console.error('[BODY_LOG] Update Error:', updateError)
      throw updateError || new Error('Failed to update body log entry metrics')
    }

    return jsonResponse({ metrics: updated })
  } catch (error) {
    console.error('Error analyzing body log image:', error)

    if (error instanceof z.ZodError) {
      return errorResponse(400, 'Invalid request', error.errors)
    }

    if (error instanceof Error) {
      return errorResponse(500, error.message)
    }

    return errorResponse(500, 'Unknown error')
  }
})
