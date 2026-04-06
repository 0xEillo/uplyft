import { MMKV } from 'react-native-mmkv'

import {
  getRestTimerSoundEnabled,
  setRestTimerSoundEnabled,
  subscribeToRestTimerSoundEnabled,
} from '../lib/utils/create-post-settings'

const mmkvMock = MMKV as typeof MMKV & { __clearAll: () => void }

beforeEach(() => {
  mmkvMock.__clearAll()
})

describe('create post settings', () => {
  test('rest timer sound defaults to enabled', () => {
    expect(getRestTimerSoundEnabled()).toBe(true)
  })

  test('rest timer sound preference is persisted', () => {
    setRestTimerSoundEnabled(false)
    expect(getRestTimerSoundEnabled()).toBe(false)

    setRestTimerSoundEnabled(true)
    expect(getRestTimerSoundEnabled()).toBe(true)
  })

  test('rest timer sound subscribers receive updates', () => {
    const values: boolean[] = []
    const unsubscribe = subscribeToRestTimerSoundEnabled((enabled) => {
      values.push(enabled)
    })

    setRestTimerSoundEnabled(false)
    setRestTimerSoundEnabled(true)
    unsubscribe()
    setRestTimerSoundEnabled(false)

    expect(values).toEqual([false, true])
  })
})
