import { MMKV } from 'react-native-mmkv'

import {
  clearStoredWorkoutComposerSession,
  loadStoredWorkoutComposerSession,
  loadWorkoutComposerSessionWithMigration,
  saveStoredWorkoutComposerSession,
} from '../lib/utils/workout-composer-storage'
import { createEmptyWorkoutComposerSession } from '../lib/utils/workout-composer-session'
import { loadDraft, saveDraft } from '../lib/utils/workout-draft'

const mmkvMock = MMKV as typeof MMKV & {
  __clearAll: () => void
  __getStore: (id?: string) => Record<string, string>
}

const COMPOSER_STORAGE_ID = 'workout-composer'
const COMPOSER_KEY = '@workout_composer_session_v1'

function makeSession() {
  return {
    stage: 'editing' as const,
    draft: {
      notes: 'Bench press felt strong',
      title: 'Push Day',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: null,
      routineSource: null,
      song: null,
    },
    review: {
      title: 'Push Day',
      description: '',
      imageUri: null,
      performedAt: '2026-03-31T09:00:00.000Z',
      song: null,
    },
    timer: {
      status: 'running' as const,
      startedAt: '2026-03-31T09:00:00.000Z',
      elapsedBaseSeconds: 0,
      frozenElapsedSeconds: 0,
    },
    meta: {
      updatedAt: 100,
      hydratedFrom: 'none' as const,
      sessionId: 'session-1',
    },
  }
}

beforeEach(() => {
  mmkvMock.__clearAll()
})

describe('workout composer storage', () => {
  test('saves and loads a persisted composer session snapshot', async () => {
    const session = makeSession()

    await saveStoredWorkoutComposerSession(session)

    const loaded = await loadStoredWorkoutComposerSession()

    expect(loaded).not.toBeNull()
    expect(loaded?.draft.notes).toBe('Bench press felt strong')
    expect(loaded?.meta.hydratedFrom).toBe('composer_snapshot')
  })

  test('does not persist an empty idle session', async () => {
    await saveStoredWorkoutComposerSession(createEmptyWorkoutComposerSession())

    expect(mmkvMock.__getStore(COMPOSER_STORAGE_ID)[COMPOSER_KEY]).toBeUndefined()
    expect(await loadStoredWorkoutComposerSession()).toBeNull()
  })

  test('migrates a legacy workout draft into composer storage and clears the legacy draft', async () => {
    await saveDraft({
      notes: 'Bench then incline',
      title: 'Push Day',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: 'routine-1',
      timerElapsedSeconds: 420,
      updatedAt: 200,
    })

    const migrated = await loadWorkoutComposerSessionWithMigration()

    expect(migrated.draft.notes).toBe('Bench then incline')
    expect(migrated.draft.selectedRoutineId).toBe('routine-1')
    expect(migrated.meta.hydratedFrom).toBe('legacy_draft')
    expect(await loadDraft()).toBeNull()
    expect(mmkvMock.__getStore(COMPOSER_STORAGE_ID)[COMPOSER_KEY]).toBeDefined()
  })

  test('prefers an existing composer snapshot over the legacy draft during hydration', async () => {
    const session = makeSession()

    await saveStoredWorkoutComposerSession(session)
    await saveDraft({
      notes: 'Legacy draft should lose',
      title: 'Old Push Day',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: null,
      timerElapsedSeconds: 10,
      updatedAt: 300,
    })

    const hydrated = await loadWorkoutComposerSessionWithMigration()

    expect(hydrated.draft.notes).toBe('Bench press felt strong')
    expect(hydrated.meta.hydratedFrom).toBe('composer_snapshot')
    expect((await loadDraft())?.notes).toBe('Legacy draft should lose')
  })

  test('clears the stored snapshot explicitly', async () => {
    await saveStoredWorkoutComposerSession(makeSession())
    await clearStoredWorkoutComposerSession()

    expect(await loadStoredWorkoutComposerSession()).toBeNull()
  })
})
