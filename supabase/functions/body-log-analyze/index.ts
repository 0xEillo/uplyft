// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import OpenAI from 'https://esm.sh/openai@4.55.3'
import { z } from 'https://esm.sh/zod@3.23.8'

import {
  buildBodyLogPrompt,
  parseBodyLogMetrics,
} from '../_shared/body-log-analysis.ts'
import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabase.ts'

const BODY_LOG_BUCKET = 'body-log'
const REQUEST_SCHEMA = z.object({
  imageId: z.string().min(1),
})

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
    const apiKey = Deno.env.get('OPENAI_API_KEY')
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
    const { imageId } = payload

    const supabase = createUserClient(accessToken)
    const serviceClient = createServiceClient()

    // Verify user is authenticated
    const { data: userData, error: authError } = await supabase.auth.getUser()

    if (authError || !userData?.user) {
      return errorResponse(401, 'Unauthorized')
    }

    // Get the body log image
    const { data: bodyLog, error: bodyLogError } = await supabase
      .from('body_log_images')
      .select(
        'id, user_id, file_path, created_at, weight_kg, body_fat_percentage, bmi',
      )
      .eq('id', imageId)
      .single()

    if (bodyLogError || !bodyLog) {
      return errorResponse(404, 'Body log image not found')
    }

    // Verify ownership
    if (bodyLog.user_id !== userData.user.id) {
      return errorResponse(403, 'Forbidden')
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, age, height_cm, weight_kg')
      .eq('id', bodyLog.user_id)
      .single()

    if (profileError || !profile) {
      return errorResponse(404, 'Profile not found')
    }

    if (!bodyLog.file_path) {
      return errorResponse(400, 'Body log image missing storage path')
    }

    // Download image from storage
    const { base64, mimeType } = await downloadImageBase64(
      serviceClient,
      bodyLog.file_path,
    )

    const openai = new OpenAI({ apiKey })

    // Build the system prompt with user context
    const systemPrompt = buildBodyLogPrompt({
      display_name: profile.display_name,
      age: profile.age,
      height_cm: profile.height_cm,
      weight_kg: profile.weight_kg,
      createdAt: bodyLog.created_at,
    })

    // Analyze the image with GPT-4o Mini Vision
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Analyze this body composition photo and return JSON metrics.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_completion_tokens: 400,
    })

    const content = completion.choices[0]?.message?.content

    // Parse the metrics from the response
    const metrics = parseBodyLogMetrics(content)

    // Update the body log with the metrics
    const { data: updated, error: updateError } = await supabase
      .from('body_log_images')
      .update(metrics)
      .eq('id', imageId)
      .select('id, weight_kg, body_fat_percentage, bmi')
      .single()

    if (updateError || !updated) {
      throw updateError || new Error('Failed to update body log metrics')
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
