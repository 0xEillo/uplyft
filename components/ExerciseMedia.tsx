import { Image } from 'expo-image'
import { memo, useMemo, useState } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

// Pre-compute the storage bucket URL once
const STORAGE_BUCKET_URL =
  'https://nsgezkxrgwtmnshulijs.supabase.co/storage/v1/object/public/exercise-gifs/'

type ExerciseMediaContentFit =
  | 'contain'
  | 'cover'
  | 'fill'
  | 'none'
  | 'scale-down'

interface ExerciseMediaProps {
  gifUrl?: string | null
  mode?: 'thumbnail' | 'full'
  autoPlay?: boolean
  style?: StyleProp<ViewStyle>
  contentFit?: ExerciseMediaContentFit
  isCustom?: boolean
}

// Memoized component - only re-renders when props change
export const ExerciseMedia = memo(function ExerciseMedia({
  gifUrl,
  mode = 'thumbnail',
  autoPlay = true,
  style,
  contentFit = 'contain',
  isCustom = false,
}: ExerciseMediaProps) {
  const [hasError, setHasError] = useState(false)

  // Memoize the full URL to avoid recalculation
  const fullUrl = useMemo(() => {
    if (!gifUrl) return null
    return `${STORAGE_BUCKET_URL}${gifUrl}`
  }, [gifUrl])

  if (!fullUrl || hasError) {
    if (isCustom) {
      return (
        <View style={[styles.container, style, { backgroundColor: '#1A1A1A' }]}>
          <Image
            source={require('@/assets/images/logo-transparent.png')}
            style={{ width: '60%', height: '60%' }}
            contentFit="contain"
          />
        </View>
      )
    }

    return (
      <View style={[styles.container, style]}>
        <Image
          source={require('@/assets/images/bicep-icon.png')}
          style={{ width: '50%', height: '50%', opacity: 0.5 }}
          contentFit="contain"
        />
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: fullUrl }}
        style={styles.image}
        contentFit={contentFit}
        autoplay={autoPlay}
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
  autoPlay = true,
  isCustom = false,
}: {
  gifUrl?: string | null
  style?: StyleProp<ViewStyle>
  autoPlay?: boolean
  isCustom?: boolean
}) {
  const fullUrl = useMemo(() => {
    if (!gifUrl) return null
    return `${STORAGE_BUCKET_URL}${gifUrl}`
  }, [gifUrl])

  if (!fullUrl) {
    if (isCustom) {
      return (
        <View style={[styles.container, style, { backgroundColor: '#1A1A1A' }]}>
          <Image
            source={require('@/assets/images/logo-transparent.png')}
            style={{ width: '60%', height: '60%' }}
            contentFit="contain"
          />
        </View>
      )
    }

    return (
      <View style={[styles.container, style]}>
        <Image
          source={require('@/assets/images/bicep-icon.png')}
          style={{ width: '50%', height: '50%', opacity: 0.5 }}
          contentFit="contain"
        />
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: fullUrl }}
        style={styles.image}
        contentFit="contain"
        autoplay={autoPlay}
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
    backgroundColor: '#FFFFFF', // Pure white background for GIF container
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
