import { openai } from '@ai-sdk/openai'
import { experimental_transcribe as transcribe } from 'ai'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return Response.json({ error: 'Audio file is required' }, { status: 400 })
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
