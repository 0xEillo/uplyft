import { supabase } from '@/lib/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Image as ExpoImage } from 'expo-image'

// Constants
const BODY_LOG_BUCKET = 'body-log' as const
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7 // 7 days (shorter for cache efficiency)
const CACHE_PREFIX = 'body_log_url_'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 6 // 6 days (refresh before expiry)

// Image transform sizes
export const IMAGE_SIZES = {
  thumbnail: { width: 400, height: 400 },
  hero: { width: 800, height: 1000 },
  full: null, // no transform
} as const

export type ImageSize = keyof typeof IMAGE_SIZES

// In-memory cache for hot lookups (avoids AsyncStorage reads)
const memoryCache = new Map<string, { url: string; expiresAt: number }>()

interface CacheEntry {
  url: string
  expiresAt: number
}

/**
 * Generate a cache key for a file path and size
 */
function getCacheKey(filePath: string, size: ImageSize): string {
  return `${CACHE_PREFIX}${size}_${filePath}`
}

/**
 * Get a cached URL from memory or AsyncStorage
 */
async function getCachedUrl(
  filePath: string,
  size: ImageSize,
): Promise<string | null> {
  const key = getCacheKey(filePath, size)
  const now = Date.now()

  // Check memory cache first
  const memEntry = memoryCache.get(key)
  if (memEntry && memEntry.expiresAt > now) {
    return memEntry.url
  }

  // Fall back to AsyncStorage
  try {
    const stored = await AsyncStorage.getItem(key)
    if (stored) {
      const entry: CacheEntry = JSON.parse(stored)
      if (entry.expiresAt > now) {
        // Warm memory cache
        memoryCache.set(key, entry)
        return entry.url
      }
      // Expired, clean up
      await AsyncStorage.removeItem(key)
    }
  } catch (e) {
    // Ignore cache read errors
  }

  return null
}

/**
 * Store a URL in both memory and AsyncStorage cache
 */
async function setCachedUrl(
  filePath: string,
  size: ImageSize,
  url: string,
): Promise<void> {
  const key = getCacheKey(filePath, size)
  const entry: CacheEntry = {
    url,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }

  // Memory cache
  memoryCache.set(key, entry)

  // AsyncStorage (fire and forget)
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry))
  } catch (e) {
    // Ignore cache write errors
  }
}

/**
 * Clear cached URLs for a file path (all sizes)
 */
export async function invalidateCachedUrls(filePath: string): Promise<void> {
  const sizes: ImageSize[] = ['thumbnail', 'hero', 'full']

  for (const size of sizes) {
    const key = getCacheKey(filePath, size)
    memoryCache.delete(key)
    try {
      await AsyncStorage.removeItem(key)
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Clear all body log URL caches
 */
export async function clearAllBodyLogCache(): Promise<void> {
  memoryCache.clear()

  try {
    const keys = await AsyncStorage.getAllKeys()
    const bodyLogKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX))
    if (bodyLogKeys.length > 0) {
      await AsyncStorage.multiRemove(bodyLogKeys)
    }
  } catch (e) {
    // Ignore
  }
}

/**
 * Get a signed URL with optional image transform
 * Uses caching to avoid repeated Supabase calls
 */
export async function getBodyLogImageUrl(
  filePath: string,
  size: ImageSize = 'full',
): Promise<string> {
  // Check cache first
  const cached = await getCachedUrl(filePath, size)
  if (cached) {
    return cached
  }

  // Generate new signed URL
  const transform = IMAGE_SIZES[size]

  const { data, error } = await supabase.storage
    .from(BODY_LOG_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY, {
      transform: transform
        ? {
            width: transform.width,
            height: transform.height,
            resize: 'cover',
          }
        : undefined,
    })

  if (error) throw error
  if (!data?.signedUrl) throw new Error('Failed to get signed URL')

  // Cache the result
  await setCachedUrl(filePath, size, data.signedUrl)

  return data.signedUrl
}

/**
 * Get signed URLs for multiple files with optional transform
 * Batches requests and uses caching
 */
export async function getBodyLogImageUrls(
  filePaths: string[],
  size: ImageSize = 'full',
): Promise<string[]> {
  if (filePaths.length === 0) return []

  const results: (string | null)[] = new Array(filePaths.length).fill(null)
  const uncachedPaths: { index: number; path: string }[] = []

  // Check cache for each path
  await Promise.all(
    filePaths.map(async (path, index) => {
      const cached = await getCachedUrl(path, size)
      if (cached) {
        results[index] = cached
      } else {
        uncachedPaths.push({ index, path })
      }
    }),
  )

  // Fetch uncached URLs in batch
  if (uncachedPaths.length > 0) {
    const pathsToFetch = uncachedPaths.map((p) => p.path)
    const transform = IMAGE_SIZES[size]

    const { data, error } = await supabase.storage
      .from(BODY_LOG_BUCKET)
      .createSignedUrls(pathsToFetch, SIGNED_URL_EXPIRY, {
        transform: transform
          ? {
              width: transform.width,
              height: transform.height,
              resize: 'cover',
            }
          : undefined,
      } as any) // Type definition missing transform support

    if (error) throw error
    if (!data) throw new Error('Failed to get signed URLs')

    // Map results back and cache
    await Promise.all(
      data.map(async (item, i) => {
        const { index, path } = uncachedPaths[i]
        if (item.signedUrl) {
          results[index] = item.signedUrl
          await setCachedUrl(path, size, item.signedUrl)
        }
      }),
    )
  }

  return results.map((url) => url ?? '')
}

/**
 * Prefetch images into expo-image cache
 * Call this after getting signed URLs to warm the image cache
 */
export async function prefetchBodyLogImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return

  try {
    await ExpoImage.prefetch(urls)
  } catch (e) {
    // Prefetch is best-effort, don't throw
    console.warn('Image prefetch failed:', e)
  }
}

/**
 * Get thumbnail URLs and prefetch them
 * Convenience method for list views
 */
export async function getThumbnailUrlsWithPrefetch(
  filePaths: string[],
): Promise<string[]> {
  const urls = await getBodyLogImageUrls(filePaths, 'thumbnail')
  // Fire and forget prefetch
  prefetchBodyLogImages(urls)
  return urls
}

/**
 * Uploads a body log image to Supabase storage
 * Images are stored privately per user
 *
 * @param uri - Local URI of the image to upload
 * @param userId - User ID for organizing uploads
 * @param entryId - Optional entry ID for organizing images within an entry
 * @param sequence - Optional sequence number (1, 2, or 3) for multi-image entries
 * @returns Promise<string> - Storage path of the uploaded image
 * @throws Error if upload fails
 */
export async function uploadBodyLogImage(
  uri: string,
  userId: string,
  entryId?: string,
  sequence?: number,
): Promise<string> {
  try {
    // Fetch the image as array buffer
    const response = await fetch(uri)
    const arrayBuffer = await response.arrayBuffer()
    const fileData = new Uint8Array(arrayBuffer)

    // Create unique file name
    const fileExt = uri.split('.').pop()?.split('?')[0] || 'jpg'

    // If we have entry ID and sequence, use that naming convention with a unique identifier
    // Otherwise, use timestamp-based naming for legacy compatibility
    const uniqueId = Math.random().toString(36).substring(2, 9)
    const fileName =
      entryId && sequence !== undefined
        ? `${entryId}_${sequence}_${uniqueId}.${fileExt}`
        : `${Date.now()}_${uniqueId}.${fileExt}`

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
 * Uploads multiple body log images for an entry
 *
 * @param uris - Array of local URIs to upload
 * @param userId - User ID for organizing uploads
 * @param entryId - Entry ID for organizing images
 * @returns Promise<string[]> - Array of storage paths
 * @throws Error if any upload fails
 */
export async function uploadBodyLogImages(
  uris: string[],
  userId: string,
  entryId: string,
): Promise<string[]> {
  try {
    const uploadPromises = uris.map((uri, index) => {
      return uploadBodyLogImage(uri, userId, entryId, index + 1)
    })

    const filePaths = await Promise.all(uploadPromises)

    return filePaths
  } catch (error) {
    console.error('[BODY_LOG] ❌ Storage: Batch upload failed', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to upload body log images. Please try again.')
  }
}

/**
 * Deletes a body log image from Supabase storage
 * Also invalidates the URL cache for this file
 *
 * @param filePath - Storage path of the image to delete
 * @returns Promise<void>
 */
export async function deleteBodyLogImage(filePath: string): Promise<void> {
  try {
    // Invalidate cache first
    await invalidateCachedUrls(filePath)

    const { error } = await supabase.storage
      .from(BODY_LOG_BUCKET)
      .remove([filePath])

    if (error) throw error
  } catch (error) {
    console.error('Error deleting body log image:', error)
    // Don't throw - image deletion is not critical
  }
}
