import * as ImageManipulator from 'expo-image-manipulator'

import { supabase } from '@/lib/supabase'

const MEAL_IMAGES_BUCKET = 'meal-images' as const
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 7
const THUMBNAIL_SIZE = 320

export async function uploadMealImage(
  uri: string,
  userId: string,
): Promise<string> {
  try {
    const processedImage = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 0.82,
    })

    const response = await fetch(processedImage.uri)
    const arrayBuffer = await response.arrayBuffer()
    const fileData = new Uint8Array(arrayBuffer)
    const fileName = `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}.jpg`
    const filePath = `${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(MEAL_IMAGES_BUCKET)
      .upload(filePath, fileData, {
        contentType: 'image/jpeg',
        upsert: false,
      })

    if (uploadError) throw uploadError

    return filePath
  } catch (error) {
    console.error('[MealImages] Failed to upload meal image:', error)
    if (error instanceof Error) throw error
    throw new Error('Failed to upload meal image. Please try again.')
  }
}

export async function getMealImageUrls(
  filePaths: string[],
): Promise<Record<string, string>> {
  const uniquePaths = Array.from(
    new Set(
      filePaths
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  )

  if (uniquePaths.length === 0) {
    return {}
  }

  const entries = await Promise.all(
    uniquePaths.map(async (filePath) => {
      const transformed = await supabase.storage
        .from(MEAL_IMAGES_BUCKET)
        .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS, {
          transform: {
            width: THUMBNAIL_SIZE,
            height: THUMBNAIL_SIZE,
            resize: 'cover',
          },
        } as any)

      if (!transformed.error && transformed.data?.signedUrl) {
        return [filePath, transformed.data.signedUrl] as const
      }

      const original = await supabase.storage
        .from(MEAL_IMAGES_BUCKET)
        .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS)

      if (original.error) throw original.error
      return [filePath, original.data?.signedUrl ?? ''] as const
    }),
  )

  return entries.reduce<Record<string, string>>((acc, [filePath, signedUrl]) => {
    if (signedUrl) {
      acc[filePath] = signedUrl
    }
    return acc
  }, {})
}
