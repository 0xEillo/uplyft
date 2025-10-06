import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Constants for validation
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

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = (formData as any).get('audio') as File

    console.log('Received audio file:', {
      name: audioFile?.name,
      type: audioFile?.type,
      size: audioFile?.size,
      hasFile: !!audioFile,
    })

    if (!audioFile) {
      return Response.json({ error: 'Audio file is required' }, { status: 400 })
    }

    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return Response.json(
        {
          error: `File size exceeds maximum allowed size of ${
            MAX_FILE_SIZE / 1024 / 1024
          }MB`,
        },
        { status: 400 },
      )
    }

    // Validate file type
    if (!ALLOWED_AUDIO_TYPES.includes(audioFile.type)) {
      return Response.json(
        {
          error: `Invalid file type. Allowed types: ${ALLOWED_AUDIO_TYPES.join(
            ', ',
          )}`,
        },
        { status: 400 },
      )
    }

    console.log('Sending to OpenAI Whisper API...')

    // Transcribe using Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    })

    console.log('Transcription successful:', transcription.text.substring(0, 50))

    return Response.json({
      text: transcription.text,
    })
  } catch (error) {
    console.error('Error transcribing audio:', error)
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return Response.json(
      { error: 'Failed to transcribe audio', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
