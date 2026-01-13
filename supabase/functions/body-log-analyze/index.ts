// deno-lint-ignore-file no-explicit-any
// @ts-ignore: Supabase Edge Functions run in Deno and resolve remote modules
// eslint-disable-next-line import/no-unresolved
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
// @ts-ignore: Supabase Edge Functions run in Deno and resolve remote modules
// eslint-disable-next-line import/no-unresolved
import { z } from 'https://esm.sh/zod@3.23.8'
import { generateObject } from 'npm:ai'

import {
    buildBodyLogPrompt,
    parseBodyLogMetrics,
} from '../_shared/body-log-analysis.ts'
import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import {
    GEMINI_FALLBACK_MODEL,
    GEMINI_MODEL,
    openrouter,
} from '../_shared/openrouter.ts'
import { createServiceClient, createUserClient } from '../_shared/supabase.ts'

const BODY_LOG_BUCKET = 'body-log'
const REQUEST_SCHEMA = z.object({
  entryId: z.string().min(1),
})

// Timeout for AI analysis
const ANALYZE_TIMEOUT_MS = 45000

// Schema for body log analysis response
const bodyLogAnalysisSchema = z.object({
  body_fat_percentage: z.number().nullable().describe('Estimated body fat percentage'),
  bmi: z.number().nullable().describe('Estimated BMI'),
  score_v_taper: z.number().int().min(0).max(100).nullable().describe('V-taper score out of 100'),
  score_chest: z.number().int().min(0).max(100).nullable().describe('Chest development score out of 100'),
  score_shoulders: z.number().int().min(0).max(100).nullable().describe('Shoulder development score out of 100'),
  score_abs: z.number().int().min(0).max(100).nullable().describe('Abs definition score out of 100'),
  score_arms: z.number().int().min(0).max(100).nullable().describe('Arm development score out of 100'),
  score_back: z.number().int().min(0).max(100).nullable().describe('Back development score out of 100'),
  score_legs: z.number().int().min(0).max(100).nullable().describe('Leg development score out of 100'),
  analysis_summary: z.string().max(400).describe('Brief 1-2 line analysis summary addressing the user directly'),
})

async function analyzeWithModel(
  modelName: string,
  systemPrompt: string,
  userContent: any[],
): Promise<z.infer<typeof bodyLogAnalysisSchema>> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.error(`[BODY_LOG] AI call (${modelName}) timed out after ${ANALYZE_TIMEOUT_MS}ms`)
    controller.abort()
  }, ANALYZE_TIMEOUT_MS)

  const startTime = Date.now()

  try {
    console.log(`[BODY_LOG] Trying ${modelName}, timeout: ${ANALYZE_TIMEOUT_MS}ms`)

    const model = openrouter.chat(modelName)
    
    const result = await generateObject({
      model,
      schema: bodyLogAnalysisSchema,
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
      abortSignal: controller.signal,
    })

    const elapsed = Date.now() - startTime
    console.log(`[BODY_LOG] ${modelName} succeeded in ${elapsed}ms`)
    console.log(`[BODY_LOG] Response usage: ${JSON.stringify(result.usage ?? 'N/A')}`)
    
    return result.object
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

    // Download and convert images to base64
    const imageContents: { base64: string; mimeType: string }[] = []
    
    for (const img of images) {
      const { data: fileData, error: downloadError } = await serviceClient.storage
        .from(BODY_LOG_BUCKET)
        .download(img.file_path)

      if (downloadError || !fileData) {
        console.error(`[BODY_LOG] Failed to download ${img.file_path}:`, downloadError)
        throw new Error(`Failed to download image: ${img.file_path}`)
      }

      // Convert blob to base64
      const arrayBuffer = await fileData.arrayBuffer()
      const byteArray = new Uint8Array(arrayBuffer)
      let binaryString = ''
      for (let i = 0; i < byteArray.length; i++) {
        binaryString += String.fromCharCode(byteArray[i])
      }
      const base64 = btoa(binaryString)

      // Determine mime type from file extension
      const ext = img.file_path.split('.').pop()?.toLowerCase() || 'jpeg'
      const mimeTypeMap: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
      }
      const mimeType = mimeTypeMap[ext] || 'image/jpeg'

      imageContents.push({ base64, mimeType })
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
    if (imageContents.length > 1) {
      systemPrompt +=
        '\n\nIMPORTANT: You are analyzing MULTIPLE photos of the same person from different angles. Combine information from all photos to provide a SINGLE, more accurate assessment. Use triangulation between photos to improve accuracy of body fat %, BMI, and weight estimates.'
    }

    // Build user message with all images (using base64 data URLs)
    const userContent: any[] = [
      {
        type: 'text',
        text:
          imageContents.length > 1
            ? 'Analyze these body composition photos from multiple angles and return combined JSON metrics.'
            : 'Analyze this body composition photo and return JSON metrics.',
      },
    ]

    // Add all images to the message as data URLs
    for (const { base64, mimeType } of imageContents) {
      userContent.push({
        type: 'image',
        image: `data:${mimeType};base64,${base64}`,
      })
    }

    // Analyze with Gemini via OpenRouter (with fallback)
    let analysisResult: z.infer<typeof bodyLogAnalysisSchema>
    
    try {
      analysisResult = await analyzeWithModel(GEMINI_MODEL, systemPrompt, userContent)
    } catch (primaryError) {
      console.error(`[BODY_LOG] ${GEMINI_MODEL} failed:`, primaryError)
      
      // Try fallback model
      console.log(`[BODY_LOG] Falling back to ${GEMINI_FALLBACK_MODEL}...`)
      
      try {
        analysisResult = await analyzeWithModel(GEMINI_FALLBACK_MODEL, systemPrompt, userContent)
      } catch (fallbackError) {
        console.error(`[BODY_LOG] ${GEMINI_FALLBACK_MODEL} also failed:`, fallbackError)
        throw new Error('Failed to analyze body log images')
      }
    }

    // Parse the metrics using the shared parser for consistency
    const metrics = parseBodyLogMetrics(JSON.stringify(analysisResult))

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
  } catch (error: any) {
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
