import { supabase } from '@/lib/supabase'

// Constants
const WORKOUT_IMAGES_BUCKET = 'workout-images' as const

/**
 * Uploads a workout image to Supabase storage and returns the public URL
 *
 * @param uri - Local URI of the image to upload
 * @param userId - User ID for organizing uploads
 * @returns Promise<string> - Public URL of the uploaded image
 * @throws Error if upload fails
 */
export async function uploadWorkoutImage(uri: string, userId: string): Promise<string> {
  try {
    // Fetch the image as array buffer
    const response = await fetch(uri)
    const arrayBuffer = await response.arrayBuffer()
    const fileData = new Uint8Array(arrayBuffer)

    // Create unique file name
    const fileExt = uri.split('.').pop()?.split('?')[0] || 'jpg'
    const fileName = `${userId}-${Date.now()}.${fileExt}`
    const filePath = `${WORKOUT_IMAGES_BUCKET}/${fileName}`

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from(WORKOUT_IMAGES_BUCKET)
      .upload(filePath, fileData, {
        contentType: `image/${fileExt}`,
        upsert: false,
      })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(WORKOUT_IMAGES_BUCKET)
      .getPublicUrl(filePath)

    return urlData.publicUrl
  } catch (error) {
    console.error('Error uploading workout image:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to upload workout image. Please try again.')
  }
}

/**
 * Deletes a workout image from Supabase storage
 *
 * @param imageUrl - Public URL of the image to delete
 * @returns Promise<void>
 */
export async function deleteWorkoutImage(imageUrl: string): Promise<void> {
  try {
    // Extract file path from URL
    const url = new URL(imageUrl)
    const pathParts = url.pathname.split('/')
    const bucketIndex = pathParts.indexOf(WORKOUT_IMAGES_BUCKET)

    if (bucketIndex === -1) {
      throw new Error('Invalid workout image URL')
    }

    const filePath = pathParts.slice(bucketIndex + 1).join('/')

    // Delete from storage
    const { error } = await supabase.storage
      .from(WORKOUT_IMAGES_BUCKET)
      .remove([`${WORKOUT_IMAGES_BUCKET}/${filePath}`])

    if (error) throw error
  } catch (error) {
    console.error('Error deleting workout image:', error)
    // Don't throw - image deletion is not critical
  }
}
