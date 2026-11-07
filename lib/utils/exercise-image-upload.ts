import { supabase } from '@/lib/supabase'

const EXERCISE_IMAGES_BUCKET = 'exercise-images' as const
/**
 * Uploads a custom exercise image to Supabase storage.
 *
 * @param uri - Local URI of the image to upload
 * @param userId - User ID for organizing uploads
 * @param exerciseId - Exercise ID to name the file
 * @returns Promise<string> - Full public URL of the uploaded image
 * @throws Error if upload fails
 */
export async function uploadExerciseImage(
  uri: string,
  userId: string,
  exerciseId: string,
): Promise<string> {
  try {
    // Fetch the image as array buffer
    const response = await fetch(uri)
    const arrayBuffer = await response.arrayBuffer()
    const fileData = new Uint8Array(arrayBuffer)

    // Determine extension from URI
    const fileExt =
      uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg'
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(fileExt)
      ? fileExt
      : 'jpg'

    // Store as userId/exerciseId.ext (upsert so re-uploads replace in place)
    const filePath = `${userId}/${exerciseId}.${safeExt}`

    const { error: uploadError } = await supabase.storage
      .from(EXERCISE_IMAGES_BUCKET)
      .upload(filePath, fileData, {
        contentType: `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
        upsert: true,
      })

    if (uploadError) throw uploadError

    // Return the full public URL
    const { data: urlData } = supabase.storage
      .from(EXERCISE_IMAGES_BUCKET)
      .getPublicUrl(filePath)

    // Bust cache by appending a timestamp query param
    return `${urlData.publicUrl}?t=${Date.now()}`
  } catch (error) {
    console.error('Error uploading exercise image:', error)
    if (error instanceof Error) throw error
    throw new Error('Failed to upload exercise image. Please try again.')
  }
}


