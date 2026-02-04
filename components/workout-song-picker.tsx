import { useThemedColors } from '@/hooks/useThemedColors'
import { searchItunesSongs } from '@/lib/api/itunes'
import type { WorkoutSong } from '@/types/music'
import { Ionicons } from '@expo/vector-icons'
import { Audio } from 'expo-av'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    ActivityIndicator,
    Image,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native'

interface WorkoutSongPickerProps {
  selectedSong: WorkoutSong | null
  onSelectSong: (song: WorkoutSong) => void
  isDisabled?: boolean
}

function formatMillis(ms?: number) {
  if (!ms) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function WorkoutSongPicker({
  selectedSong,
  onSelectSong,
  isDisabled = false,
}: WorkoutSongPickerProps) {
  const colors = useThemedColors()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WorkoutSong[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)

  const trimmedQuery = useMemo(() => query.trim(), [query])

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
    setPlayingTrackId(null)
  }, [])

  const handleSearch = useCallback(async () => {
    if (!trimmedQuery) {
      setResults([])
      setHasSearched(true)
      return
    }

    setIsSearching(true)
    setHasSearched(true)
    const songs = await searchItunesSongs(trimmedQuery)
    setResults(songs)
    setIsSearching(false)
  }, [trimmedQuery])

  const handlePlayPreview = useCallback(
    async (song: WorkoutSong) => {
      if (playingTrackId === song.trackId) {
        await stopPlayback()
        return
      }

      await stopPlayback()
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
        const { sound } = await Audio.Sound.createAsync(
          { uri: song.previewUrl },
          { shouldPlay: true },
        )
        soundRef.current = sound
        setPlayingTrackId(song.trackId)
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return
          if (status.didJustFinish) {
            stopPlayback()
          }
        })
      } catch (error) {
        console.error('Error playing preview:', error)
        await stopPlayback()
      }
    },
    [playingTrackId, stopPlayback],
  )

  useEffect(() => {
    return () => {
      stopPlayback()
    }
  }, [stopPlayback])

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        Add a song preview
      </Text>
      <View
        style={[
          styles.searchRow,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search iTunes for a song"
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.textPrimary }]}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          editable={!isDisabled}
        />
        <Pressable
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={isDisabled}
        >
          <Ionicons name="search" size={18} color={colors.brandPrimary} />
        </Pressable>
      </View>

      {isSearching && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.brandPrimary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Searching iTunes...
          </Text>
        </View>
      )}

      {!isSearching && hasSearched && results.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No results yet. Try another search.
        </Text>
      )}

      <ScrollView
        style={styles.resultsList}
        contentContainerStyle={styles.resultsContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        {results.map((song, index) => {
          const isSelected = selectedSong?.trackId === song.trackId
          const isPlaying = playingTrackId === song.trackId
          const duration = formatMillis(song.trackTimeMillis)

          return (
            <View key={song.trackId}>
              <Pressable
                style={[
                  styles.resultRow,
                  isSelected && { backgroundColor: colors.surfaceSubtle },
                ]}
                onPress={() => onSelectSong(song)}
              >
                <Image
                  source={{ uri: song.artworkUrl100 }}
                  style={styles.artwork}
                />
                <View style={styles.resultInfo}>
                  <Text
                    style={[styles.trackName, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {song.trackName}
                  </Text>
                  <Text
                    style={[styles.artistName, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {song.artistName}
                    {duration ? ` • ${duration}` : ''}
                  </Text>
                </View>
                <Pressable
                  style={styles.previewButton}
                  onPress={() => handlePlayPreview(song)}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={20}
                    color={colors.brandPrimary}
                  />
                </Pressable>
              </Pressable>
              {index < results.length - 1 && (
                <View
                  style={[styles.separator, { backgroundColor: colors.border }]}
                />
              )}
            </View>
          )
        })}
      </ScrollView>

      <Text style={[styles.attribution, { color: colors.textTertiary }]}>
        Previews provided courtesy of iTunes.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 14,
  },
  searchButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyText: {
    fontSize: 13,
  },
  resultsList: {
    maxHeight: 260,
  },
  resultsContent: {
    paddingBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  resultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  trackName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  artistName: {
    fontSize: 14,
    fontWeight: '400',
  },
  previewButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60, // 48 (artwork) + 12 (gap)
  },
  attribution: {
    fontSize: 11,
  },
})
