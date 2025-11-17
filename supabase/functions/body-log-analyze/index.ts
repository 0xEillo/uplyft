// deno-lint-ignore-file no-explicit-any
// @ts-ignore: Supabase Edge Functions run in Deno and resolve remote modules
// eslint-disable-next-line import/no-unresolved
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
// @ts-ignore: Supabase Edge Functions run in Deno and resolve remote modules
// eslint-disable-next-line import/no-unresolved
import OpenAI from 'https://esm.sh/openai@4.55.3'
// @ts-ignore: Supabase Edge Functions run in Deno and resolve remote modules
// eslint-disable-next-line import/no-unresolved
import { z } from 'https://esm.sh/zod@3.23.8'

import {
  buildBodyLogPrompt,
  parseBodyLogMetrics,
} from '../_shared/body-log-analysis.ts'
import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabase.ts'

const BODY_LOG_BUCKET = 'body-log'
const REQUEST_SCHEMA = z.object({
  entryId: z.string().min(1),
})

const BODY_LOG_RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'BodyLogAnalysis',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['body_fat_percentage', 'bmi', 'analysis_summary'],
      properties: {
        body_fat_percentage: { type: ['number', 'null'] },
        bmi: { type: ['number', 'null'] },
        analysis_summary: {
          type: 'string',
          minLength: 8,
          maxLength: 400,
        },
      },
    },
  },
}

async function downloadImageBase64(
  serviceClient: ReturnType<typeof createServiceClient>,
  filePath: string,
): Promise<{ base64: string; mimeType: string }> {
  const { data: signed, error: signedError } = await serviceClient.storage
    .from(BODY_LOG_BUCKET)
    .createSignedUrl(filePath, 60)

  if (signedError || !signed?.signedUrl) {
    throw new Error(
      `Failed to resolve body log image URL: ${
        signedError?.message || 'Unknown error'
      }`,
    )
  }

  const response = await fetch(signed.signedUrl)

  if (!response.ok) {
    throw new Error(`Failed to fetch body log image: ${response.status}`)
  }

  const mimeType = response.headers.get('content-type') || 'image/jpeg'
  const arrayBuffer = await response.arrayBuffer()

  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(arrayBuffer)
  const chunkSize = 0x8000
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    chunks.push(String.fromCharCode(...slice))
  }
  const base64 = btoa(chunks.join(''))

  return { base64, mimeType }
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  try {
    const apiKey =
      'Deno' in globalThis
        ? (globalThis as typeof globalThis & {
            Deno: { env: { get(key: string): string | undefined } }
          }).Deno.env.get('OPENAI_API_KEY')
        : undefined
    if (!apiKey) {
      throw new Error('Missing OPENAI_API_KEY environment variable')
    }

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

    // Download all images from storage
    const imageDownloads = await Promise.all(
      images.map((img) => downloadImageBase64(serviceClient, img.file_path)),
    )

    const openai = new OpenAI({ apiKey })

    // Build the system prompt with user context
    let systemPrompt = buildBodyLogPrompt({
      display_name: profile.display_name,
      age: profile.age,
      height_cm: profile.height_cm,
      weight_kg: profile.weight_kg,
      createdAt: entry.created_at,
    })

    // Add multi-image instruction if applicable
    if (imageDownloads.length > 1) {
      systemPrompt +=
        '\n\nIMPORTANT: You are analyzing MULTIPLE photos of the same person from different angles. Combine information from all photos to provide a SINGLE, more accurate assessment. Use triangulation between photos to improve accuracy of body fat %, BMI, and weight estimates.'
    }

    // Build user message with all images
    const userContent: any[] = [
      {
        type: 'text',
        text:
          imageDownloads.length > 1
            ? 'Analyze these body composition photos from multiple angles and return combined JSON metrics.'
            : 'Analyze this body composition photo and return JSON metrics.',
      },
    ]

    // Add all images to the message
    for (const { base64, mimeType } of imageDownloads) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64}`,
          detail: 'high',
        },
      })
    }

    // Analyze with GPT-4o Mini Vision
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
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
      max_completion_tokens: 400,
      response_format: BODY_LOG_RESPONSE_FORMAT,
    })

    const content = completion.choices[0]?.message?.content

    // Parse the metrics from the response
    const metrics = parseBodyLogMetrics(content)
    const updatePayload = {
      ...metrics,
      weight_kg:
        typeof profile.weight_kg === 'number'
          ? profile.weight_kg
          : typeof entry.weight_kg === 'number'
          ? entry.weight_kg
          : null,
    }

    // Update entry metrics
    const { data: updated, error: updateError } = await supabase
      .from('body_log_entries')
      .update(updatePayload)
      .eq('id', entryId)
      .select(
        'id, weight_kg, body_fat_percentage, bmi, muscle_mass_kg, analysis_summary',
      )
      .single()

    if (updateError || !updated) {
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
