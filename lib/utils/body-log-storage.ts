import { supabase } from '@/lib/supabase'

// Constants
const BODY_LOG_BUCKET = 'body-log' as const
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 365 // 1 year in seconds

/**
 * Uploads a body log image to Supabase storage
 * Images are stored privately per user
 *
 * @param uri - Local URI of the image to upload
 * @param userId - User ID for organizing uploads
 * @returns Promise<string> - Storage path of the uploaded image
 * @throws Error if upload fails
 */
export async function uploadBodyLogImage(
  uri: string,
  userId: string,
): Promise<string> {
  try {
    // Fetch the image as array buffer
    const response = await fetch(uri)
    const arrayBuffer = await response.arrayBuffer()
    const fileData = new Uint8Array(arrayBuffer)

    // Create unique file name
    const fileExt = uri.split('.').pop()?.split('?')[0] || 'jpg'
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${userId}/${fileName}`

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from(BODY_LOG_BUCKET)
      .upload(filePath, fileData, {
        contentType: `image/${fileExt}`,
        upsert: false,
      })

    if (uploadError) throw uploadError

    return filePath
  } catch (error) {
    console.error('Error uploading body log image:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to upload body log image. Please try again.')
  }
}

/**
 * Gets a signed URL for a private body log image
 * Signed URLs expire after 1 year
 *
 * @param filePath - Storage path of the image
 * @returns Promise<string> - Signed URL for the image
 * @throws Error if fetching URL fails
 */
export async function getBodyLogImageUrl(filePath: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(BODY_LOG_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY)

    if (error) throw error
    if (!data?.signedUrl) throw new Error('Failed to get signed URL')

    return data.signedUrl
  } catch (error) {
    console.error('Error getting body log image URL:', error)
    throw new Error('Failed to load image. Please try again.')
  }
}

/**
 * Gets signed URLs for multiple body log images
 *
 * @param filePaths - Array of storage paths
 * @returns Promise<string[]> - Array of signed URLs
 */
export async function getBodyLogImageUrls(
  filePaths: string[],
): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage
      .from(BODY_LOG_BUCKET)
      .createSignedUrls(filePaths, SIGNED_URL_EXPIRY)

    if (error) throw error
    if (!data) throw new Error('Failed to get signed URLs')

    return data.map((item) => item.signedUrl)
  } catch (error) {
    console.error('Error getting body log image URLs:', error)
    throw new Error('Failed to load images. Please try again.')
  }
}

/**
 * Deletes a body log image from Supabase storage
 *
 * @param filePath - Storage path of the image to delete
 * @returns Promise<void>
 */
export async function deleteBodyLogImage(filePath: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(BODY_LOG_BUCKET)
      .remove([filePath])

    if (error) throw error
  } catch (error) {
    console.error('Error deleting body log image:', error)
    // Don't throw - image deletion is not critical
  }
}
