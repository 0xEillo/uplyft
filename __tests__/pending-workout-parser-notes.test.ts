import { MMKV } from 'react-native-mmkv'

import {
  clearPendingWorkout,
  loadPendingWorkout,
  savePendingWorkout,
} from '../lib/utils/workout-draft'

const mmkvMock = MMKV as typeof MMKV & { __clearAll: () => void }

beforeEach(() => {
  mmkvMock.__clearAll()
})

describe('pending workout parserNotes persistence', () => {
  test('round-trips parserNotes when provided', async () => {
    await savePendingWorkout({
      notes: 'raw combined notes',
      parserNotes: 'free-form notes only',
      title: 'Push Day',
      imageUrl: null,
      weightUnit: 'kg',
      userId: 'user-1',
      performedAt: '2026-02-25T12:00:00.000Z',
      timezoneOffsetMinutes: 300,
    })

    const pending = await loadPendingWorkout()

    expect(pending?.notes).toBe('raw combined notes')
    expect(pending?.parserNotes).toBe('free-form notes only')
  })

  test('supports older payloads without parserNotes', async () => {
    await savePendingWorkout({
      notes: 'legacy notes payload',
      title: 'Legacy',
      imageUrl: null,
      weightUnit: 'lb',
      userId: 'user-1',
      performedAt: '2026-02-25T12:00:00.000Z',
      timezoneOffsetMinutes: 300,
    })

    const pending = await loadPendingWorkout()

    expect(pending?.notes).toBe('legacy notes payload')
    expect(pending?.parserNotes).toBeUndefined()
  })

  test('clearPendingWorkout removes stored payload', async () => {
    await savePendingWorkout({
      notes: 'to clear',
      parserNotes: 'to clear parser',
      title: 'Clear',
      imageUrl: null,
      weightUnit: 'kg',
      userId: 'user-1',
      performedAt: '2026-02-25T12:00:00.000Z',
      timezoneOffsetMinutes: 300,
    })

    await clearPendingWorkout()

    expect(await loadPendingWorkout()).toBeNull()
  })
})
