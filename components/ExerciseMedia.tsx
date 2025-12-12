import { useThemedColors } from '@/hooks/useThemedColors'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

interface ExerciseMediaProps {
  gifUrl?: string | null
  mode?: 'thumbnail' | 'full'
  autoPlay?: boolean
  style?: any
}

export function ExerciseMedia({ 
  gifUrl, 
  mode = 'thumbnail', 
  autoPlay = true,
  style 
}: ExerciseMediaProps) {
  const colors = useThemedColors()
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Construct full URL
  const fullUrl = gifUrl 
    ? supabase.storage.from('exercise-gifs').getPublicUrl(gifUrl).data.publicUrl
    : null

  useEffect(() => {
    if (gifUrl) {
        console.log(`[ExerciseMedia] gifUrl prop: ${gifUrl}, generated fullUrl: ${fullUrl}`)
    }
    setIsPlaying(autoPlay)
  }, [autoPlay, gifUrl, fullUrl])

  if (!fullUrl || hasError) {
    if (hasError) console.log(`[ExerciseMedia] Error loading image for ${gifUrl}`)
    return (
      <View style={[styles.container, styles.fallbackContainer, style]}>
        <Ionicons name="barbell-outline" size={mode === 'thumbnail' ? 24 : 48} color={colors.textTertiary} />
        {mode === 'full' && (
             <Text style={[styles.fallbackText, { color: colors.textTertiary }]}>No visual available</Text>
        )}
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: fullUrl }}
        style={styles.image}
        contentFit="contain" // 'contain' allows seeing the whole exercise. 'cover' might crop heads/feet.
        onLoadStart={() => setIsLoading(true)}
        onLoad={() => {
            console.log(`[ExerciseMedia] Successfully loaded image for ${gifUrl}`)
            setIsLoading(false)
        }}
        onError={(e) => {
            console.log(`[ExerciseMedia] Failed to load image for ${gifUrl}`, e)
            setIsLoading(false)
            setHasError(true)
        }}
        // Expo Image supports animated-gif, but control is limited without 'expo-av' or specialized props in newer versions.
        // Assuming basic GIF support works out of the box. 
        // Note: caching is handled automatically by expo-image.
      />

      {isLoading && (
        <View style={[styles.absoluteFill, styles.centered]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* 
        Note: True play/pause control for GIFs in expo-image isn't fully exposed in standard props 
        without using the native view manager or switching to video.
        For now, we rely on standard GIF loop.
        If 'thumbnail' mode, ideally we'd show a static frame, but expo-image doesn't extract frames easily.
        We can simulate 'thumbnail' by accepting it's a moving thumbnail or just showing it small.
      */}
      
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackContainer: {
    backgroundColor: '#f5f5f5', // Will be overridden by themed backgroundLight usually
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  fallbackText: {
      fontSize: 14,
      fontWeight: '500'
  }
})
