// deno-lint-ignore-file no-explicit-any
// @ts-ignore: Supabase Edge Functions run in Deno and resolve remote modules
// eslint-disable-next-line import/no-unresolved
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
// @ts-ignore: Supabase Edge Functions run in Deno and resolve remote modules
// eslint-disable-next-line import/no-unresolved
import { encodeBase64 } from 'https://deno.land/std@0.223.0/encoding/base64.ts'
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
const REQUEST_SCHEMA = z.union([
  z.object({ entryId: z.string().min(1) }),
  z.object({
    imagePaths: z.array(z.string().min(1)).min(1).max(3),
    weightKg: z.number().nullable().optional(),
  }),
])

// Timeout for AI analysis
const ANALYZE_TIMEOUT_MS = 45000

function isHeicImagePath(path: string): boolean {
  return /\.(heic|heif)$/i.test(path)
}

async function createVisionImageInput(
  serviceClient: ReturnType<typeof createServiceClient>,
  filePath: string,
  signedUrlTTLSeconds: number,
): Promise<string> {
  const { data: signed, error: signedError } = await serviceClient.storage
    .from(BODY_LOG_BUCKET)
    .createSignedUrl(filePath, signedUrlTTLSeconds)

  if (signedError || !signed?.signedUrl) {
    console.error(`[BODY_LOG] Failed to sign ${filePath}:`, signedError)
    throw new Error(`Failed to sign image: ${filePath}`)
  }

  if (!isHeicImagePath(filePath)) {
    return signed.signedUrl
  }

  // OpenRouter rejects .heic/.heif as URL images; use an inline data URL instead.
  console.log(`[BODY_LOG] Converting ${filePath} to inline data URL for analysis`)
  const imageResponse = await fetch(signed.signedUrl)
  if (!imageResponse.ok) {
    throw new Error(
      `Failed to download HEIC image (${imageResponse.status}): ${filePath}`,
    )
  }

  const imageBytes = new Uint8Array(await imageResponse.arrayBuffer())
  if (imageBytes.length === 0) {
    throw new Error(`Downloaded HEIC image is empty: ${filePath}`)
  }

  const mimeType = filePath.toLowerCase().endsWith('.heif')
    ? 'image/heif'
    : 'image/heic'
  const base64Image = encodeBase64(imageBytes)
  return `data:${mimeType};base64,${base64Image}`
}

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

    const supabase = createUserClient(accessToken)
    const serviceClient = createServiceClient()

    // Verify user is authenticated
    const { data: userData, error: authError } = await supabase.auth.getUser()

    if (authError || !userData?.user) {
      console.error('[BODY_LOG] ❌ EdgeFunction: Authentication failed')
      return errorResponse(401, 'Unauthorized')
    }

    const userId = userData.user.id

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, age, height_cm, weight_kg')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return errorResponse(404, 'Profile not found')
    }

    const signedUrlTTLSeconds = 60 * 30
    const imageInputs: string[] = []
    let entryCreatedAt: string = new Date().toISOString()
    let scanWeightKg: number | null = null
    let isStandaloneScan = false

    if ('entryId' in payload) {
      // ── Entry-based mode (existing flow) ────────────────────────────────────
      const { entryId } = payload

      const { data: entry, error: entryError } = await supabase
        .from('body_log_entries')
        .select('*')
        .eq('id', entryId)
        .single()

      if (entryError || !entry) {
        return errorResponse(404, 'Body log entry not found')
      }

      if (entry.user_id !== userId) {
        return errorResponse(403, 'Forbidden')
      }

      entryCreatedAt = entry.created_at
      scanWeightKg =
        typeof entry.weight_kg === 'number'
          ? entry.weight_kg
          : typeof profile.weight_kg === 'number'
          ? profile.weight_kg
          : null

      const { data: images, error: imagesError } = await supabase
        .from('body_log_images')
        .select('*')
        .eq('entry_id', entryId)
        .order('sequence', { ascending: true })

      if (imagesError || !images || images.length === 0) {
        return errorResponse(404, 'No images found for this entry')
      }

      for (const img of images) {
        imageInputs.push(
          await createVisionImageInput(
            serviceClient,
            img.file_path,
            signedUrlTTLSeconds,
          ),
        )
      }
    } else {
      // ── Standalone scan mode (new flow — ephemeral images, no entry needed) ──
      isStandaloneScan = true
      const { imagePaths, weightKg } = payload

      // Security: each path must be owned by the authenticated user
      for (const p of imagePaths) {
        if (!p.startsWith(`${userId}/`)) {
          return errorResponse(403, 'Forbidden: image path does not belong to user')
        }
      }

      scanWeightKg =
        typeof weightKg === 'number'
          ? weightKg
          : typeof profile.weight_kg === 'number'
          ? profile.weight_kg
          : null

      for (const filePath of imagePaths) {
        imageInputs.push(
          await createVisionImageInput(serviceClient, filePath, signedUrlTTLSeconds),
        )
      }
    }

    // Build the system prompt with user context
    let systemPrompt = buildBodyLogPrompt({
      display_name: profile.display_name,
      age: profile.age,
      height_cm: profile.height_cm,
      weight_kg: scanWeightKg ?? profile.weight_kg,
      createdAt: entryCreatedAt,
    })

    if (imageInputs.length > 1) {
      systemPrompt +=
        '\n\nIMPORTANT: You are analyzing MULTIPLE photos of the same person from different angles. Combine information from all photos to provide a SINGLE, more accurate assessment. Use triangulation between photos to improve accuracy of body fat %, BMI, and weight estimates.'
    }

    const userContent: any[] = [
      {
        type: 'text',
        text:
          imageInputs.length > 1
            ? 'Analyze these body composition photos from multiple angles and return combined JSON metrics.'
            : 'Analyze this body composition photo and return JSON metrics.',
      },
    ]

    for (const url of imageInputs) {
      userContent.push({ type: 'image_url', image_url: { url } })
    }

    // Analyze with Gemini via OpenRouter (with fallback)
    let analysisContent: string

    try {
      const analysis = await analyzeWithModel(GEMINI_MODEL, systemPrompt, userContent)
      analysisContent = analysis.content
    } catch (primaryError) {
      console.error(`[BODY_LOG] ${GEMINI_MODEL} failed:`, primaryError)
      console.log(`[BODY_LOG] Falling back to ${GEMINI_FALLBACK_MODEL}...`)

      try {
        const analysis = await analyzeWithModel(GEMINI_FALLBACK_MODEL, systemPrompt, userContent)
        analysisContent = analysis.content
      } catch (fallbackError) {
        console.error(`[BODY_LOG] ${GEMINI_FALLBACK_MODEL} also failed:`, fallbackError)
        throw new Error('Failed to analyze body log images')
      }
    }

    const metrics = parseBodyLogMetrics(analysisContent)

    let leanMass: number | null = null
    let fatMass: number | null = null

    if (
      scanWeightKg !== null &&
      metrics.body_fat_percentage !== null &&
      metrics.body_fat_percentage !== undefined
    ) {
      const fatPercent = metrics.body_fat_percentage / 100
      fatMass = Number((scanWeightKg * fatPercent).toFixed(2))
      leanMass = Number((scanWeightKg * (1 - fatPercent)).toFixed(2))
    }

    const computedMetrics = {
      ...metrics,
      weight_kg: scanWeightKg,
      lean_mass_kg: leanMass,
      fat_mass_kg: fatMass,
    }

    // Standalone scan: return metrics without touching the DB
    if (isStandaloneScan) {
      return jsonResponse({ metrics: computedMetrics })
    }

    // Entry-based: update the entry with the computed metrics
    const { entryId } = payload as { entryId: string }
    const { data: updated, error: updateError } = await supabase
      .from('body_log_entries')
      .update(computedMetrics)
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
