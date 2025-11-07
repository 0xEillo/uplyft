import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import OpenAI from 'https://esm.sh/openai@4.55.3'
import { z } from 'https://esm.sh/zod@3.23.8'

import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB (Whisper API limit)
const ALLOWED_AUDIO_TYPES = [
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
]

const requestSchema = z.object({
  audio: z.instanceof(File),
})

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

    const openai = new OpenAI({ apiKey })
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null

    console.log('Received audio file:', {
      name: audioFile?.name,
      type: audioFile?.type,
      size: audioFile?.size,
      hasFile: !!audioFile,
    })

    if (!audioFile) {
      return errorResponse(400, 'Audio file is required')
    }

    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return errorResponse(
        400,
        `File size exceeds maximum allowed size of ${
          MAX_FILE_SIZE / 1024 / 1024
        }MB`,
      )
    }

    // Validate file type
    if (!ALLOWED_AUDIO_TYPES.includes(audioFile.type)) {
      return errorResponse(
        400,
        `Invalid file type. Allowed types: ${ALLOWED_AUDIO_TYPES.join(', ')}`,
      )
    }

    console.log('Sending to OpenAI Whisper API...')

    // Convert file to buffer for OpenAI
    const buffer = await audioFile.arrayBuffer()

    // Transcribe using Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: new File([buffer], audioFile.name, { type: audioFile.type }),
      model: 'whisper-1',
      language: 'en',
    })

    console.log(
      'Transcription successful:',
      transcription.text.substring(0, 50),
    )

    return jsonResponse({
      text: transcription.text,
    })
  } catch (error) {
    console.error('Error transcribing audio:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return errorResponse(500, 'Failed to transcribe audio. Please try again.')
  }
})
