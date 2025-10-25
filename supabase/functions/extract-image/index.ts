import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import OpenAI from 'https://esm.sh/openai@4.55.3'

import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB (OpenAI Vision API limit)
const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]

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
    const imageFile = formData.get('image') as File | null

    console.log('Received image file:', {
      name: imageFile?.name,
      type: imageFile?.type,
      size: imageFile?.size,
      hasFile: !!imageFile,
    })

    if (!imageFile) {
      return errorResponse(400, 'Image file is required')
    }

    // Validate file size
    if (imageFile.size > MAX_FILE_SIZE) {
      return errorResponse(
        400,
        `File size exceeds maximum allowed size of ${
          MAX_FILE_SIZE / 1024 / 1024
        }MB`,
      )
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
      return errorResponse(
        400,
        `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      )
    }

    console.log('Converting image to base64...')

    // Convert image to base64 (handle large files without stack overflow)
    const bytes = await imageFile.arrayBuffer()
    const byteArray = new Uint8Array(bytes)
    let binaryString = ''
    for (let i = 0; i < byteArray.length; i++) {
      binaryString += String.fromCharCode(byteArray[i])
    }
    const base64Image = btoa(binaryString)
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
              text: `You are a workout tracking assistant. Analyze this image and extract workout information.

The image may contain:
- Handwritten or typed workout notes
- Exercise names with sets, reps, and weights
- Body measurements or progress tracking notes

IMPORTANT: Return ONLY valid JSON in this format, no other text:
{
  "isWorkoutRelated": boolean,
  "content": {
    "title": "string or null - inferred workout title",
    "description": "string or null - any general notes or comments, formatted cleanly",
    "exercises": "string or null - formatted exercise data (see format below)"
  }
}

If the image contains NO workout-related content (e.g., it's a cat photo, random screenshot, etc.), return:
{
  "isWorkoutRelated": false,
  "content": null
}

**Formatting rules for the 'description' and 'exercises' fields:**
- For 'description': Include any general notes, comments, or observations. Keep it clean and readable.
- For 'exercises': Format each exercise clearly:
  • Put the exercise name on its own line (no bullets, just the name)
  • Indent the sets/reps/weight data below it (use 2-4 spaces)
  • Use consistent format like "weight x reps" or "weight x reps x sets"
  • Separate different exercises with a blank line
  • Preserve any relevant notes about the exercise inline

Example of good 'exercises' formatting:
Bench Press
  135 x 8
  155 x 6
  165 x 4

Incline DB Press
  50 x 10
  55 x 8 x 3

Extract everything you can about exercises, sets, reps, weights, and any other fitness-related data. Keep the output clean and consistently formatted.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
    })

    const messageContent = response.choices[0]?.message?.content

    let combinedText: string | null = null

    if (typeof messageContent === 'string') {
      combinedText = messageContent
    } else if (Array.isArray(messageContent)) {
      const textParts = messageContent
        .map((part) => {
          if (typeof part !== 'object' || !part) return null

          if ('text' in part && typeof part.text === 'string') {
            return part.text
          }

          if ('output_text' in part && typeof part.output_text === 'string') {
            return part.output_text
          }

          return null
        })
        .filter((value): value is string => Boolean(value?.trim()))

      if (textParts.length > 0) {
        combinedText = textParts.join('\n')
      }
    }

    if (!combinedText) {
      console.error('Vision API returned unexpected content:', messageContent)
      return errorResponse(500, 'Invalid response from vision API')
    }

    console.log('Vision API raw response:', combinedText)

    // Parse the JSON response from OpenAI
    const jsonMatch = combinedText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return errorResponse(500, 'Failed to extract structured data from image')
    }

    const extracted = JSON.parse(jsonMatch[0])

    if (!extracted.isWorkoutRelated) {
      return errorResponse(
        400,
        'This image does not appear to contain workout-related content',
      )
    }

    const content = extracted.content ?? null

    const workoutText =
      typeof content?.exercises === 'string'
        ? content.exercises
        : typeof content?.description === 'string'
        ? content.description
        : ''

    return jsonResponse({
      title: typeof content?.title === 'string' ? content.title : null,
      description:
        typeof content?.description === 'string' ? content.description : null,
      workout: workoutText,
      raw: extracted,
    })
  } catch (error) {
    console.error('Error extracting image:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
    return errorResponse(500, 'Failed to process image. Please try again.')
  }
})
