import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'

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
let player: ReturnType<typeof createAudioPlayer> | null = null
let statusSubscription: { remove: () => void } | null = null
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
  if (!player) return
  statusSubscription?.remove()
  statusSubscription = null
  try {
    player.pause()
  } catch {
    // Ignore stop errors
  }
  player.remove()
  player = null
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
    await setAudioModeAsync({ playsInSilentMode: true })
    const nextPlayer = createAudioPlayer({ uri: song.previewUrl })

    if (token !== activeToken) {
      nextPlayer.remove()
      return
    }

    player = nextPlayer
    statusSubscription = nextPlayer.addListener(
      'playbackStatusUpdate',
      (status) => {
        if (token !== activeToken) return

        if (status.didJustFinish) {
          void stopMusicPreview()
          return
        }

        setState({
          trackId: song.trackId,
          isPlaying: status.playing,
          isBuffering: status.isBuffering,
        })
      },
    )

    nextPlayer.play()
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
