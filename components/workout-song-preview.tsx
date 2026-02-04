import { useThemedColors } from '@/hooks/useThemedColors'
import type { WorkoutSong } from '@/types/music'
import { Ionicons } from '@expo/vector-icons'
import { Audio } from 'expo-av'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

interface WorkoutSongPreviewProps {
  song: WorkoutSong
  onRemove?: () => void
  showAttribution?: boolean
  containerStyle?: StyleProp<ViewStyle>
  artworkSize?: number
}

function formatMillis(ms?: number) {
  if (!ms) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function WorkoutSongPreview({
  song,
  onRemove,
  showAttribution = false,
  containerStyle,
  artworkSize = 42,
}: WorkoutSongPreviewProps) {
  const colors = useThemedColors()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const soundRef = useRef<Audio.Sound | null>(null)
  const duration = formatMillis(song.trackTimeMillis)

  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync()
        await soundRef.current.unloadAsync()
      } catch {
        // Ignore unload errors
      }
      soundRef.current = null
    }
    setIsPlaying(false)
    setIsBuffering(false)
  }, [])

  const togglePlayback = useCallback(async () => {
    if (isPlaying) {
      await stopPlayback()
      return
    }

    setIsBuffering(true)
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
      const { sound } = await Audio.Sound.createAsync(
        { uri: song.previewUrl },
        { shouldPlay: true },
      )
      soundRef.current = sound
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return
        setIsPlaying(status.isPlaying)
        setIsBuffering(status.isBuffering)
        if (status.didJustFinish) {
          stopPlayback()
        }
      })
    } catch (error) {
      console.error('Error playing song preview:', error)
      await stopPlayback()
    } finally {
      setIsBuffering(false)
    }
  }, [isPlaying, song.previewUrl, stopPlayback])

  useEffect(() => {
    return () => {
      stopPlayback()
    }
  }, [stopPlayback])

  return (
    <View
      style={[styles.container, containerStyle]}
    >
      <Image
        source={{ uri: song.artworkUrl100 }}
        style={[styles.artwork, { width: artworkSize, height: artworkSize }]}
      />
      <View style={styles.info}>
        <Text style={[styles.trackName, { color: colors.textPrimary }]} numberOfLines={1}>
          {song.trackName}
        </Text>
        <Text style={[styles.artistName, { color: colors.textSecondary }]} numberOfLines={1}>
          {song.artistName}
          {duration ? ` • ${duration}` : ''}
        </Text>
        {showAttribution && (
          <Text style={[styles.attribution, { color: colors.textTertiary }]}>
            Preview courtesy of iTunes
          </Text>
        )}
      </View>
      <Pressable
        style={styles.playButton}
        onPress={togglePlayback}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={20}
          color={colors.brandPrimary}
        />
      </Pressable>
      {onRemove && (
        <Pressable style={styles.removeButton} onPress={onRemove}>
          <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
        </Pressable>
      )}

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 10,
    gap: 12,
  },
  artwork: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  trackName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  artistName: {
    fontSize: 13,
    fontWeight: '400',
  },
  attribution: {
    fontSize: 11,
    marginTop: 2,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    marginLeft: 4,
  },

})
