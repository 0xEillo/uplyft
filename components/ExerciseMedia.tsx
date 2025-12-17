import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { memo, useMemo, useState } from 'react'
import { StyleSheet, View, ViewStyle } from 'react-native'

// Pre-compute the storage bucket URL once
const STORAGE_BUCKET_URL =
  'https://nsgezkxrgwtmnshulijs.supabase.co/storage/v1/object/public/exercise-gifs/'

interface ExerciseMediaProps {
  gifUrl?: string | null
  mode?: 'thumbnail' | 'full'
  autoPlay?: boolean
  style?: ViewStyle
}

// Memoized component - only re-renders when props change
export const ExerciseMedia = memo(function ExerciseMedia({
  gifUrl,
  mode = 'thumbnail',
  autoPlay = true,
  style,
}: ExerciseMediaProps) {
  const [hasError, setHasError] = useState(false)

  // Memoize the full URL to avoid recalculation
  const fullUrl = useMemo(() => {
    if (!gifUrl) return null
    return `${STORAGE_BUCKET_URL}${gifUrl}`
  }, [gifUrl])

  if (!fullUrl || hasError) {
    return (
      <View style={[styles.container, style]}>
        <Ionicons name="barbell-outline" size={24} color="#333" />
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: fullUrl }}
        style={styles.image}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={gifUrl}
        transition={150}
        onError={() => setHasError(true)}
        // For thumbnails, use lower priority to not block UI
        priority={mode === 'thumbnail' ? 'low' : 'normal'}
      />
    </View>
  )
})

// Pre-compute blurhash for consistent placeholder
const PLACEHOLDER_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4'

// Optimized version for lists - even lighter weight
export const ExerciseMediaThumbnail = memo(function ExerciseMediaThumbnail({
  gifUrl,
  style,
}: {
  gifUrl?: string | null
  style?: ViewStyle
}) {
  const fullUrl = useMemo(() => {
    if (!gifUrl) return null
    return `${STORAGE_BUCKET_URL}${gifUrl}`
  }, [gifUrl])

  if (!fullUrl) {
    return (
      <View style={[styles.container, style]}>
        <Ionicons name="barbell-outline" size={18} color="#333" />
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: fullUrl }}
        style={styles.image}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={gifUrl}
        placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
        transition={100}
        priority="low"
      />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0', // Keep light background for white GIFs
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  fallbackText: {
    fontSize: 14,
    fontWeight: '500',
  },
})
