import { openai } from '@ai-sdk/openai'
import { experimental_transcribe as transcribe } from 'ai'

// Constants for validation
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB (Whisper API limit)
const ALLOWED_AUDIO_TYPES = [
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
]

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return Response.json({ error: 'Audio file is required' }, { status: 400 })
    }

    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return Response.json(
        {
          error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 },
      )
    }

    // Validate file type
    if (!ALLOWED_AUDIO_TYPES.includes(audioFile.type)) {
      return Response.json(
        {
          error: `Invalid file type. Allowed types: ${ALLOWED_AUDIO_TYPES.join(', ')}`,
        },
        { status: 400 },
      )
    }

    // Convert to Uint8Array
    const arrayBuffer = await audioFile.arrayBuffer()
    const audioData = new Uint8Array(arrayBuffer)

    // Transcribe using Whisper
    const result = await transcribe({
      model: openai.transcription('whisper-1'),
      audio: audioData,
      providerOptions: {
        openai: {
          language: 'en',
        },
      },
    })

    return Response.json({
      text: result.text,
    })
  } catch (error) {
    console.error('Error transcribing audio:', error)
    return Response.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 },
    )
  }
}
