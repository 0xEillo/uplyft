import { Audio } from 'expo-av'

import type { WorkoutSong } from '@/types/music'

export type MusicPreviewState = {
  trackId: number | null
  isPlaying: boolean
  isBuffering: boolean
}

type Listener = () => void

const listeners = new Set<Listener>()
let state: MusicPreviewState = {
  trackId: null,
  isPlaying: false,
  isBuffering: false,
}
let sound: Audio.Sound | null = null
let activeToken = 0

function notify() {
  listeners.forEach((listener) => listener())
}

function setState(next: MusicPreviewState) {
  if (
    state.trackId === next.trackId &&
    state.isPlaying === next.isPlaying &&
    state.isBuffering === next.isBuffering
  ) {
    return
  }
  state = next
  notify()
}

async function cleanupSound() {
  if (!sound) return
  try {
    await sound.stopAsync()
  } catch {
    // Ignore stop errors
  }
  try {
    await sound.unloadAsync()
  } catch {
    // Ignore unload errors
  }
  sound.setOnPlaybackStatusUpdate(null)
  sound = null
}

export function getMusicPreviewState(): MusicPreviewState {
  return state
}

export function subscribeMusicPreview(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function stopMusicPreview(): Promise<void> {
  activeToken += 1
  await cleanupSound()
  if (state.trackId !== null || state.isPlaying || state.isBuffering) {
    setState({ trackId: null, isPlaying: false, isBuffering: false })
  }
}

export async function playMusicPreview(song: WorkoutSong): Promise<void> {
  const token = activeToken + 1
  activeToken = token

  await cleanupSound()
  setState({ trackId: song.trackId, isPlaying: false, isBuffering: true })

  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
    const { sound: nextSound } = await Audio.Sound.createAsync(
      { uri: song.previewUrl },
      { shouldPlay: true },
    )

    if (token !== activeToken) {
      try {
        await nextSound.unloadAsync()
      } catch {
        // Ignore unload errors
      }
      return
    }

    sound = nextSound
    nextSound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded || token !== activeToken) return

      if (status.didJustFinish) {
        void stopMusicPreview()
        return
      }

      setState({
        trackId: song.trackId,
        isPlaying: status.isPlaying,
        isBuffering: status.isBuffering,
      })
    })

    setState({ trackId: song.trackId, isPlaying: true, isBuffering: false })
  } catch (error) {
    console.error('Error playing preview:', error)
    if (token === activeToken) {
      await stopMusicPreview()
    }
  }
}

export async function toggleMusicPreview(song: WorkoutSong): Promise<void> {
  if (
    state.trackId === song.trackId &&
    (state.isPlaying || state.isBuffering)
  ) {
    await stopMusicPreview()
    return
  }

  await playMusicPreview(song)
}
