import { useMusicPreviewState } from '@/hooks/useMusicPreviewState'
import { useThemedColors } from '@/hooks/useThemedColors'
import { stopMusicPreview, toggleMusicPreview } from '@/lib/music-preview-player'
import type { WorkoutSong } from '@/types/music'
import { Ionicons } from '@expo/vector-icons'
import { useCallback } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

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
  const playback = useMusicPreviewState()
  const isActive = playback.trackId === song.trackId
  const isPlaying = isActive && playback.isPlaying
  const isBuffering = isActive && playback.isBuffering
  const duration = formatMillis(song.trackTimeMillis)

  const handleTogglePlayback = useCallback(() => {
    void toggleMusicPreview(song)
  }, [song])

  const handleRemove = useCallback(() => {
    if (isActive) {
      void stopMusicPreview()
    }
    onRemove?.()
  }, [isActive, onRemove])

  const handleOpenSong = useCallback(() => {
    // We prefer the full trackViewUrl if available (new data), 
    // but fallback to the i/trackId format for old data.
    const url = song.trackViewUrl 
      ? `https://song.link/${song.trackViewUrl}`
      : `https://song.link/i/${song.trackId}`
      
    void Linking.openURL(url)
  }, [song])

  return (
    <View style={[styles.container, containerStyle]}>
      <Pressable 
        style={styles.clickableArea} 
        onPress={handleOpenSong}
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
      </Pressable>
      <Pressable
        style={styles.playButton}
        onPress={handleTogglePlayback}
      >
        {isBuffering ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={20}
            color={colors.textPrimary}
          />
        )}
      </Pressable>
      {onRemove && (
        <Pressable style={styles.removeButton} onPress={handleRemove}>
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
  clickableArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  removeButton: {
    marginLeft: 4,
  },

})
