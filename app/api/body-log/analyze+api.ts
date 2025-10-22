import OpenAI from 'openai'
import { z } from 'zod'

import {
  buildBodyLogPrompt,
  parseBodyLogMetrics,
} from '@/lib/body-log/analysis'
import {
  createServerSupabaseClient,
  createServiceSupabaseClient,
} from '@/lib/supabase-server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const BODY_LOG_BUCKET = 'body-log'
const REQUEST_SCHEMA = z.object({
  imageId: z.string().min(1),
})

function extractAccessToken(request: Request) {
  const bearer = request.headers.get('Authorization')
  if (!bearer) return undefined
  if (!bearer.startsWith('Bearer ')) return undefined
  const token = bearer.slice('Bearer '.length).trim()
  return token || undefined
}

async function downloadImageBase64(
  filePath: string,
): Promise<{ base64: string; mimeType: string }> {
  const serviceSupabase = createServiceSupabaseClient()

  const {
    data: signed,
    error: signedError,
  } = await serviceSupabase.storage
    .from(BODY_LOG_BUCKET)
    .createSignedUrl(filePath, 60)

  if (signedError || !signed?.signedUrl) {
    throw new Error(
      `Failed to resolve body log image URL: ${signedError?.message || 'Unknown error'}`,
    )
  }

  const response = await fetch(signed.signedUrl)

  if (!response.ok) {
    throw new Error(`Failed to fetch body log image: ${response.status}`)
  }

  const mimeType = response.headers.get('content-type') || 'image/jpeg'
  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  return { base64, mimeType }
}

export async function POST(request: Request) {
  try {
    const accessToken = extractAccessToken(request)

    if (!accessToken) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json()
    const { imageId } = REQUEST_SCHEMA.parse(payload)

    const supabase = createServerSupabaseClient(accessToken)

    const { data: userData, error: authError } = await supabase.auth.getUser()

    if (authError || !userData?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: bodyLog, error: bodyLogError } = await supabase
      .from('body_log_images')
      .select(
        'id, user_id, file_path, created_at, weight_kg, body_fat_percentage, bmi, muscle_mass_kg',
      )
      .eq('id', imageId)
      .single()

    if (bodyLogError || !bodyLog) {
      return Response.json(
        { error: 'Body log image not found' },
        { status: 404 },
      )
    }

    if (bodyLog.user_id !== userData.user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, age, height_cm, weight_kg')
      .eq('id', bodyLog.user_id)
      .single()

    if (profileError || !profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!bodyLog.file_path) {
      return Response.json(
        { error: 'Body log image missing storage path' },
        { status: 400 },
      )
    }

    const { base64, mimeType } = await downloadImageBase64(bodyLog.file_path)

    const systemPrompt = buildBodyLogPrompt({
      profile,
      createdAt: bodyLog.created_at,
    })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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

    const metrics = parseBodyLogMetrics(content)

    const { data: updated, error: updateError } = await supabase
      .from('body_log_images')
      .update(metrics)
      .eq('id', imageId)
      .select('id, weight_kg, body_fat_percentage, bmi, muscle_mass_kg')
      .single()

    if (updateError || !updated) {
      throw updateError || new Error('Failed to update body log metrics')
    }

    return Response.json({ metrics: updated })
  } catch (error) {
    console.error('Error analyzing body log image:', error)

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request', details: error.message },
        { status: 400 },
      )
    }

    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ error: 'Unknown error' }, { status: 500 })
  }
}
