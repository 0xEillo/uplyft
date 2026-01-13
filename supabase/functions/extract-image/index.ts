import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'
import { z } from 'https://esm.sh/zod@3.25.76'
import { generateObject } from 'npm:ai'

import { errorResponse, handleCors, jsonResponse } from '../_shared/cors.ts'
import {
  GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  openrouter,
} from '../_shared/openrouter.ts'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]

// Schema for structured workout extraction
const exerciseSetSchema = z.object({
  weight: z.string().describe('Weight used (empty string if not specified)'),
  reps: z.string().describe('Reps performed (empty string if not specified, or duration like "30 seconds")'),
})

const exerciseSchema = z.object({
  name: z.string().describe('Name of the exercise (e.g., "Bench Press", "Push-ups")'),
  sets: z.array(exerciseSetSchema).describe('Array of sets performed for this exercise'),
})

const workoutExtractionSchema = z.object({
  isWorkoutRelated: z.boolean().describe('Whether the image contains workout-related content'),
  title: z.string().nullable().describe('Inferred workout title, or null if cannot be determined'),
  description: z.string().nullable().describe('Any notes or comments found in the image, or null if none'),
  exercises: z.array(exerciseSchema).describe('Array of individual exercises extracted from the image'),
})

const EXTRACT_TIMEOUT_MS = 30000

async function extractWithModel(
  modelName: string,
  base64Image: string,
  imageType: string,
): Promise<z.infer<typeof workoutExtractionSchema>> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.error(`[ExtractImage] AI call (${modelName}) timed out after ${EXTRACT_TIMEOUT_MS}ms`)
    controller.abort()
  }, EXTRACT_TIMEOUT_MS)

  const startTime = Date.now()

  try {
    console.log(`[ExtractImage] Trying ${modelName}, timeout: ${EXTRACT_TIMEOUT_MS}ms`)

    const model = openrouter.chat(modelName)
    
    const result = await generateObject({
      model,
      schema: workoutExtractionSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a workout tracking assistant. Analyze this image and extract workout information.

CRITICAL RULES:
1. If the image is NOT workout-related (e.g., cat photo, random screenshot), set isWorkoutRelated to false and return empty exercises array.
2. Each INDIVIDUAL exercise MUST be its own object in the exercises array with a unique name.
3. DO NOT group exercises under category headers - extract EACH exercise separately.
4. For exercises that list "X sets" without weight/reps, create that many sets with empty weight and reps strings.
5. For exercises like "3 sets for 30 seconds", set reps to "30 seconds".
6. If no weight is specified, leave weight as empty string "".
7. If no reps are specified, leave reps as empty string "".
8. DO NOT include category headers like "Chest & Triceps:" as exercise names. Only extract actual exercise names.

Example: If image shows:
"Chest & Triceps:
  Push-ups - 3 sets
  Diamond Push-ups - 3 sets
  Bench Press - 135x8, 155x6"

The exercises array should contain:
- Push-ups with 3 sets (each with empty weight and reps)
- Diamond Push-ups with 3 sets (each with empty weight and reps)
- Bench Press with 2 sets (135/8 and 155/6)`,
            },
            {
              type: 'image',
              image: `data:${imageType};base64,${base64Image}`,
            },
          ],
        },
      ],
      abortSignal: controller.signal,
    })

    const elapsed = Date.now() - startTime
    console.log(`[ExtractImage] ${modelName} succeeded in ${elapsed}ms`)
    console.log(`[ExtractImage] Response usage: ${JSON.stringify(result.usage ?? 'N/A')}`)
    
    return result.object
  } finally {
    clearTimeout(timeoutId)
  }
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  try {
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
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
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

    console.log('Sending to Gemini via OpenRouter...')

    // Try primary model first
    let extracted: z.infer<typeof workoutExtractionSchema>
    
    try {
      extracted = await extractWithModel(GEMINI_MODEL, base64Image, imageFile.type)
    } catch (primaryError) {
      console.error(`[ExtractImage] ${GEMINI_MODEL} failed:`, primaryError)
      
      // Try fallback model
      console.log(`[ExtractImage] Falling back to ${GEMINI_FALLBACK_MODEL}...`)
      
      try {
        extracted = await extractWithModel(GEMINI_FALLBACK_MODEL, base64Image, imageFile.type)
      } catch (fallbackError) {
        console.error(`[ExtractImage] ${GEMINI_FALLBACK_MODEL} also failed:`, fallbackError)
        throw new Error('Failed to extract workout from image')
      }
    }

    if (!extracted.isWorkoutRelated) {
      return errorResponse(
        400,
        'This image does not appear to contain workout-related content',
      )
    }

    // Create backwards-compatible workout text from structured exercises
    let workoutText = ''
    if (extracted.exercises.length > 0) {
      workoutText = extracted.exercises.map((ex) => {
        const setsText = ex.sets.map((set, i) => {
          if (set.weight && set.reps) {
            return `  ${set.weight} x ${set.reps}`
          } else if (set.weight) {
            return `  ${set.weight}`
          } else if (set.reps) {
            return `  ${set.reps}`
          }
          return `  Set ${i + 1}`
        }).join('\n')
        return `${ex.name}\n${setsText}`
      }).join('\n\n')
    }

    console.log('Parsed exercises:', extracted.exercises.length, 'exercises')

    return jsonResponse({
      title: extracted.title,
      description: extracted.description,
      workout: workoutText,
      exercises: extracted.exercises,
    })
  } catch (error) {
    console.error('Error extracting image:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
    return errorResponse(500, 'Failed to process image. Please try again.')
  }
})
