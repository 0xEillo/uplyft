import { useSyncExternalStore } from 'react'

import {
  getMusicPreviewState,
  subscribeMusicPreview,
  type MusicPreviewState,
} from '@/lib/music-preview-player'

export function useMusicPreviewState(): MusicPreviewState {
  return useSyncExternalStore(
    subscribeMusicPreview,
    getMusicPreviewState,
    getMusicPreviewState,
  )
}
