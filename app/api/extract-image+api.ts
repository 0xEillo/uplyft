import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Constants for validation
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB (OpenAI Vision API limit)
const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const imageFile = (formData as any).get('image') as File

    console.log('Received image file:', {
      name: imageFile?.name,
      type: imageFile?.type,
      size: imageFile?.size,
      hasFile: !!imageFile,
    })

    if (!imageFile) {
      return Response.json({ error: 'Image file is required' }, { status: 400 })
    }

    // Validate file size
    if (imageFile.size > MAX_FILE_SIZE) {
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
    if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
      return Response.json(
        {
          error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(
            ', ',
          )}`,
        },
        { status: 400 },
      )
    }

    console.log('Converting image to base64...')

    // Convert image to base64
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')
    const dataUrl = `data:${imageFile.type};base64,${base64Image}`

    console.log('Sending to OpenAI Vision API...')

    // Extract text from image using GPT-4 Vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a workout tracking assistant. Analyze this image and extract any workout-related information you can find.

The image may contain:
- Handwritten or typed workout notes
- Exercise names with sets, reps, and weights
- A workout title
- Any additional notes or comments about the workout

Please extract and return the information in the following format:

TITLE: [Only include this line if there is an actual workout title present, otherwise completely omit this line]
DESCRIPTION: [Only include this line if there are general notes/comments like "felt strong today" or "shoulder was sore", otherwise completely omit this line]
WORKOUT: [Extract all exercise details including exercise names, sets, reps, weights in a format like:
Bench Press
135 x 8
155 x 6
165 x 4

Squats
185x5
205x5
225x3
]

IMPORTANT: Do not include the TITLE or DESCRIPTION lines if they are empty. Simply omit them entirely.
If the image doesn't contain workout information, respond with "NOT_WORKOUT_RELATED".
Be as accurate as possible with numbers and exercise names.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    })

    const extractedText = response.choices[0]?.message?.content || ''

    console.log('Extraction successful:', extractedText.substring(0, 100))

    // Check if image is workout-related
    if (extractedText.includes('NOT_WORKOUT_RELATED')) {
      return Response.json(
        {
          error:
            "This image doesn't appear to contain workout information. Please try another image with exercise details.",
        },
        { status: 400 },
      )
    }

    // Parse the response to extract title, description, and workout
    const titleMatch = extractedText.match(/TITLE:\s*(.+?)(?:\n|$)/i)
    const descriptionMatch = extractedText.match(
      /DESCRIPTION:\s*(.+?)(?=\nWORKOUT:|$)/is,
    )
    const workoutMatch = extractedText.match(/WORKOUT:\s*(.+?)$/is)

    const title = titleMatch?.[1]?.trim() || ''
    const description = descriptionMatch?.[1]?.trim() || ''
    const workout = workoutMatch?.[1]?.trim() || extractedText

    return Response.json({
      title: title || undefined,
      description: description || undefined,
      workout: workout || extractedText,
    })
  } catch (error) {
    console.error('Error extracting text from image:', error)

    if (error instanceof Error) {
      return Response.json(
        {
          error: 'Failed to extract text from image',
          details: error.message,
        },
        { status: 500 },
      )
    }

    return Response.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
