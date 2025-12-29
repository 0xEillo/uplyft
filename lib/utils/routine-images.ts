import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'routine-images'

/**
 * Reserved routine images used for pre-made/explore routines.
 * These images should NOT be available for users to select for their own routines.
 * Add the file names (without extension) here.
 */
export const RESERVED_ROUTINE_IMAGES = [
  // PPL Program routines
  'Push',
  'Pull',
  'Legs',
  // Upper/Lower Program routines
  'Upper Body A',
  'Lower Body A',
  // Full Body Program routines
  'Full Body A',
  'Full Body B',
  'Full Body C',
]

// Available tint colors for routine cards
export const ROUTINE_TINT_COLORS = [
  '#A3E635', // Lime
  '#22D3EE', // Cyan
  '#94A3B8', // Slate
  '#F0ABFC', // Fuchsia
  '#FB923C', // Orange
  '#4ADE80', // Green
  '#60A5FA', // Blue
  '#F472B6', // Pink
  '#FACC15', // Yellow
  '#A78BFA', // Violet
]

/**
 * Generate a random tint color for a routine
 */
export function generateRandomTintColor(): string {
  const randomIndex = Math.floor(Math.random() * ROUTINE_TINT_COLORS.length)
  return ROUTINE_TINT_COLORS[randomIndex]
}

/**
 * Get a tint color by index (for fallback when no stored color)
 */
export function getTintColorByIndex(index: number): string {
  return ROUTINE_TINT_COLORS[index % ROUTINE_TINT_COLORS.length]
}

export interface RoutineImage {
  name: string
  path: string
  url: string
}

/**
 * List all available routine images from the storage bucket
 */
export async function listRoutineImages(): Promise<RoutineImage[]> {
  try {
    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' },
      })

    if (error) {
      console.error('Error listing routine images:', error)
      return []
    }

    if (!files || files.length === 0) {
      return []
    }

    // Filter out folders and only include image files
    const imageFiles = files.filter(
      (file) =>
        !file.id.includes('/') &&
        (file.name.endsWith('.png') ||
          file.name.endsWith('.jpg') ||
          file.name.endsWith('.jpeg') ||
          file.name.endsWith('.webp'))
    )

    // Get public URLs for each image
    const images: RoutineImage[] = imageFiles.map((file) => {
      const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(file.name)

      return {
        name: file.name.replace(/\.(png|jpg|jpeg|webp)$/i, ''),
        path: file.name,
        url: data.publicUrl,
      }
    })

    return images
  } catch (error) {
    console.error('Error in listRoutineImages:', error)
    return []
  }
}

/**
 * List routine images available for users to select (excludes reserved pre-made routine images)
 */
export async function listSelectableRoutineImages(): Promise<RoutineImage[]> {
  const allImages = await listRoutineImages()
  
  // Filter out reserved images (case-insensitive comparison)
  const reservedNamesLower = RESERVED_ROUTINE_IMAGES.map(name => name.toLowerCase())
  
  return allImages.filter(
    (image) => !reservedNamesLower.includes(image.name.toLowerCase())
  )
}

/**
 * Get the public URL for a routine image by its path
 */
export function getRoutineImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(imagePath)

  return data.publicUrl
}

/**
 * Check if a routine image exists in storage
 */
export async function routineImageExists(imagePath: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        search: imagePath,
      })

    if (error) {
      console.error('Error checking routine image:', error)
      return false
    }

    return data?.some((file) => file.name === imagePath) ?? false
  } catch (error) {
    console.error('Error in routineImageExists:', error)
    return false
  }
}
