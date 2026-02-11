import { MMKV } from 'react-native-mmkv'

import {
  clearDraft,
  compactDraft,
  draftHasContent,
  loadDraft,
  saveDraft,
  saveDraftPatch,
  type StructuredExerciseDraft,
} from '../lib/utils/workout-draft'

const mmkvMock = MMKV as typeof MMKV & { __clearAll: () => void }

const SNAPSHOT_KEY = '@workout_draft_snapshot'
const OPS_KEY = '@workout_draft_ops'
const STORAGE_ID = 'workout-draft'

const makeStructuredSkeleton = (): StructuredExerciseDraft[] => [
  {
    id: 'ex-1',
    name: 'Bench Press',
    sets: [
      { weight: '', reps: '' },
      { weight: '', reps: '' },
    ],
  },
]

beforeEach(() => {
  mmkvMock.__clearAll()
})

describe('workout draft persistence', () => {
  test('draftHasContent returns false for empty draft', () => {
    expect(
      draftHasContent({
        notes: '',
        title: '',
        structuredData: [],
        isStructuredMode: false,
        selectedRoutineId: null,
      }),
    ).toBe(false)
  })

  test('draftHasContent returns true for notes/title/routine/structured skeleton', () => {
    expect(draftHasContent({ notes: 'hello', title: '' })).toBe(true)
    expect(draftHasContent({ notes: '', title: 'Push Day' })).toBe(true)
    expect(
      draftHasContent({
        notes: '',
        title: '',
        selectedRoutineId: 'routine-1',
      }),
    ).toBe(true)
    expect(
      draftHasContent({
        notes: '',
        title: '',
        structuredData: makeStructuredSkeleton(),
      }),
    ).toBe(true)
    expect(
      draftHasContent({
        notes: '',
        title: '',
        timerStartedAt: '2026-01-01T00:00:00.000Z',
        timerElapsedSeconds: 5,
      }),
    ).toBe(true)
  })

  test('draftHasContent ignores whitespace-only notes/title', () => {
    expect(draftHasContent({ notes: '   ', title: '' })).toBe(false)
    expect(draftHasContent({ notes: '', title: '   ' })).toBe(false)
  })

  test('draftHasContent treats structured data as content even if structured mode is false', () => {
    expect(
      draftHasContent({
        notes: '',
        title: '',
        structuredData: makeStructuredSkeleton(),
        isStructuredMode: false,
      }),
    ).toBe(true)
  })

  test('draftHasContent true for combined note + structured + routine', () => {
    expect(
      draftHasContent({
        notes: 'Felt strong',
        title: 'Push',
        structuredData: makeStructuredSkeleton(),
        selectedRoutineId: 'routine-123',
      }),
    ).toBe(true)
  })

  test('saveDraft and loadDraft round-trip all fields', async () => {
    const structuredData = makeStructuredSkeleton()

    await saveDraft({
      notes: 'Warmup notes',
      title: 'Chest Day',
      structuredData,
      isStructuredMode: true,
      selectedRoutineId: 'routine-abc',
      timerStartedAt: '2025-01-01T12:00:00.000Z',
      timerElapsedSeconds: 600,
      updatedAt: 12345,
    })

    const draft = await loadDraft()
    expect(draft).not.toBeNull()
    expect(draft?.notes).toBe('Warmup notes')
    expect(draft?.title).toBe('Chest Day')
    expect(draft?.structuredData?.length).toBe(1)
    expect(draft?.isStructuredMode).toBe(true)
    expect(draft?.selectedRoutineId).toBe('routine-abc')
    expect(draft?.timerStartedAt).toBe('2025-01-01T12:00:00.000Z')
    expect(draft?.timerElapsedSeconds).toBe(600)
    expect(draft?.updatedAt).toBe(12345)
  })

  test('saveDraft clears storage when no content exists', async () => {
    await saveDraft({
      notes: '',
      title: '',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: null,
    })

    const draft = await loadDraft()
    expect(draft).toBeNull()
  })

  test('saveDraft preserves routine-only drafts', async () => {
    await saveDraft({
      notes: '',
      title: '',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: 'routine-keep',
    })

    const draft = await loadDraft()
    expect(draft?.selectedRoutineId).toBe('routine-keep')
  })

  test('saveDraftPatch merges patches on top of snapshot', async () => {
    await saveDraft({
      notes: 'first',
      title: 'A',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: null,
      updatedAt: 1,
    })

    await saveDraftPatch({ notes: 'second', updatedAt: 2 })

    const draft = await loadDraft()
    expect(draft?.notes).toBe('second')
    expect(draft?.title).toBe('A')
    expect(draft?.updatedAt).toBe(2)
  })

  test('structured skeleton survives patches that clear notes/title', async () => {
    const structuredData = makeStructuredSkeleton()

    await saveDraft({
      notes: 'initial',
      title: 'Initial',
      structuredData,
      isStructuredMode: true,
      selectedRoutineId: null,
    })

    await saveDraftPatch({ notes: '', title: '' })

    const draft = await loadDraft()
    expect(draft).not.toBeNull()
    expect(draft?.structuredData?.length).toBe(1)
  })

  test('structured data is preserved when patch does not include it', async () => {
    const structuredData = makeStructuredSkeleton()

    await saveDraft({
      notes: 'initial',
      title: '',
      structuredData,
      isStructuredMode: true,
      selectedRoutineId: null,
    })

    await saveDraftPatch({ notes: 'updated' })

    const draft = await loadDraft()
    expect(draft?.notes).toBe('updated')
    expect(draft?.structuredData?.length).toBe(1)
  })

  test('structured data is replaced when patch includes new structured array', async () => {
    await saveDraft({
      notes: '',
      title: '',
      structuredData: makeStructuredSkeleton(),
      isStructuredMode: true,
      selectedRoutineId: null,
    })

    await saveDraftPatch({
      structuredData: [
        {
          id: 'ex-2',
          name: 'Squat',
          sets: [{ weight: '225', reps: '5' }],
        },
      ],
    })

    const draft = await loadDraft()
    expect(draft?.structuredData?.length).toBe(1)
    expect(draft?.structuredData?.[0]?.name).toBe('Squat')
  })

  test('selectedRoutineId can be cleared by patch', async () => {
    await saveDraft({
      notes: 'keep',
      title: '',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: 'routine-to-clear',
    })

    await saveDraftPatch({ selectedRoutineId: null })

    const draft = await loadDraft()
    expect(draft).not.toBeNull()
    expect(draft?.selectedRoutineId).toBeNull()
  })

  test('selectedRoutineId remains when patch omits it', async () => {
    await saveDraft({
      notes: '',
      title: '',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: 'routine-keep',
    })

    await saveDraftPatch({ notes: 'update' })

    const draft = await loadDraft()
    expect(draft?.selectedRoutineId).toBe('routine-keep')
  })

  test('clearing routine on an otherwise empty draft clears the draft', async () => {
    await saveDraft({
      notes: '',
      title: '',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: 'routine-only',
    })

    await saveDraftPatch({ selectedRoutineId: null })

    const draft = await loadDraft()
    expect(draft).toBeNull()
  })

  test('timer fields persist when patch omits them', async () => {
    await saveDraft({
      notes: 'seed',
      title: '',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: null,
      timerStartedAt: '2025-02-02T10:00:00.000Z',
      timerElapsedSeconds: 900,
    })

    await saveDraftPatch({ notes: 'updated' })

    const draft = await loadDraft()
    expect(draft?.timerStartedAt).toBe('2025-02-02T10:00:00.000Z')
    expect(draft?.timerElapsedSeconds).toBe(900)
  })

  test('timer-only draft is preserved (not auto-cleared)', async () => {
    await saveDraft({
      notes: '',
      title: '',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: null,
      timerStartedAt: '2026-02-02T10:00:00.000Z',
      timerElapsedSeconds: 42,
    })

    const draft = await loadDraft()
    expect(draft).not.toBeNull()
    expect(draft?.timerStartedAt).toBe('2026-02-02T10:00:00.000Z')
    expect(draft?.timerElapsedSeconds).toBe(42)
  })

  test('saveDraft normalizes invalid structuredData to empty array', async () => {
    await saveDraft({
      notes: 'hello',
      title: 'world',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      structuredData: 'not-an-array' as any,
      isStructuredMode: true,
      selectedRoutineId: null,
    })

    const draft = await loadDraft()
    expect(draft?.structuredData).toEqual([])
  })

  test('loadDraft applies ops in order', async () => {
    await saveDraft({
      notes: 'base',
      title: '',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: null,
    })

    await saveDraftPatch({ notes: 'step-1', updatedAt: 1 })
    await saveDraftPatch({ notes: 'step-2', updatedAt: 2 })
    await saveDraftPatch({ notes: 'step-3', updatedAt: 3 })

    const draft = await loadDraft()
    expect(draft?.notes).toBe('step-3')
    expect(draft?.updatedAt).toBe(3)
  })

  test('saveDraftPatch compacts after 50 ops', async () => {
    await saveDraft({
      notes: 'base',
      title: '',
      structuredData: [],
      isStructuredMode: false,
      selectedRoutineId: null,
    })

    for (let i = 0; i < 50; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await saveDraftPatch({ notes: `note-${i}` })
    }

    const storage = new MMKV({ id: STORAGE_ID })
    const opsRaw = storage.getString(OPS_KEY)
    expect(opsRaw).toBeUndefined()

    const draft = await loadDraft()
    expect(draft?.notes).toBe('note-49')
  })

  test('compactDraft clears when hydrated draft has no content', async () => {
    const storage = new MMKV({ id: STORAGE_ID })
    storage.set(SNAPSHOT_KEY, JSON.stringify({ notes: '', title: '' }))

    await compactDraft()
    const draft = await loadDraft()
    expect(draft).toBeNull()
  })

  test('compactDraft persists when passed a valid draft', async () => {
    await compactDraft({
      notes: 'saved',
      title: '',
      structuredData: makeStructuredSkeleton(),
      isStructuredMode: true,
      selectedRoutineId: 'routine-1',
      updatedAt: 42,
    })

    const draft = await loadDraft()
    expect(draft?.notes).toBe('saved')
    expect(draft?.structuredData?.length).toBe(1)
    expect(draft?.selectedRoutineId).toBe('routine-1')
    expect(draft?.updatedAt).toBe(42)
  })

  test('loadDraft returns null on corrupt storage payloads', async () => {
    const storage = new MMKV({ id: STORAGE_ID })
    storage.set(SNAPSHOT_KEY, '{invalid-json')
    storage.set(OPS_KEY, 'not-json')

    const draft = await loadDraft()
    expect(draft).toBeNull()
  })

  test('clearDraft removes stored snapshot and ops', async () => {
    const storage = new MMKV({ id: STORAGE_ID })
    storage.set(SNAPSHOT_KEY, JSON.stringify({ notes: 'x', title: '' }))
    storage.set(OPS_KEY, JSON.stringify([{ ts: 1, patch: { notes: 'y' } }]))

    await clearDraft()

    expect(storage.getString(SNAPSHOT_KEY)).toBeUndefined()
    expect(storage.getString(OPS_KEY)).toBeUndefined()
  })
})
