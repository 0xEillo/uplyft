import {
  createEmptyWorkoutComposerSession,
  createWorkoutComposerSessionFromLegacyDraft,
  createWorkoutComposerSessionFromPendingWorkout,
  getWorkoutComposerElapsedSeconds,
  normalizePersistedWorkoutComposerSession,
  workoutComposerReducer,
} from '../lib/utils/workout-composer-session'
import type { PendingWorkout, StructuredExerciseDraft, WorkoutDraft } from '../lib/utils/workout-draft'

const START_MS = Date.parse('2026-03-31T09:00:00.000Z')
const START_ISO = new Date(START_MS).toISOString()

function makeStructuredData(): StructuredExerciseDraft[] {
  return [
    {
      id: 'exercise-1',
      name: 'Bench Press',
      sets: [
        { weight: '225', reps: '5', isCompleted: true },
        { weight: '205', reps: '8', isCompleted: true },
      ],
    },
  ]
}

describe('workout composer session reducer', () => {
  test('starts a new editing session and timer when the first meaningful draft content is added', () => {
    const session = workoutComposerReducer(createEmptyWorkoutComposerSession(), {
      type: 'update_draft',
      patch: { notes: 'Bench press felt strong' },
      now: START_MS,
      nowIso: START_ISO,
    })

    expect(session.stage).toBe('editing')
    expect(session.draft.notes).toBe('Bench press felt strong')
    expect(session.timer.status).toBe('running')
    expect(session.timer.startedAt).toBe(START_ISO)
    expect(session.review.performedAt).toBe(START_ISO)
    expect(session.meta.sessionId).toEqual(expect.any(String))
  })

  test('creates a running routine-backed session when seeded from a template', () => {
    const structuredData = makeStructuredData()
    const session = workoutComposerReducer(createEmptyWorkoutComposerSession(), {
      type: 'seed_routine',
      title: 'Push Day',
      structuredData,
      selectedRoutineId: 'routine-1',
      routineSource: 'route',
      now: START_MS,
      nowIso: START_ISO,
    })

    expect(session.stage).toBe('editing')
    expect(session.draft.title).toBe('Push Day')
    expect(session.draft.selectedRoutineId).toBe('routine-1')
    expect(session.draft.structuredData).toEqual(structuredData)
    expect(session.draft.isStructuredMode).toBe(true)
    expect(session.timer.status).toBe('running')
  })

  test('freezes elapsed time in review and does not auto-restart after returning to editing', () => {
    const started = workoutComposerReducer(createEmptyWorkoutComposerSession(), {
      type: 'update_draft',
      patch: {
        notes: 'Bench press felt strong',
        structuredData: makeStructuredData(),
        isStructuredMode: true,
      },
      now: START_MS,
      nowIso: START_ISO,
    })

    const reviewAtMs = START_MS + 65_000
    const reviewAtIso = new Date(reviewAtMs).toISOString()
    const reviewing = workoutComposerReducer(started, {
      type: 'enter_review',
      now: reviewAtMs,
      nowIso: reviewAtIso,
      defaultTitle: 'Morning Session',
    })

    expect(reviewing.stage).toBe('reviewing')
    expect(reviewing.timer.status).toBe('frozen')
    expect(reviewing.timer.startedAt).toBeNull()
    expect(reviewing.timer.frozenElapsedSeconds).toBe(65)
    expect(reviewing.review.title).toBe('Morning Session')
    expect(getWorkoutComposerElapsedSeconds(reviewing, reviewAtMs + 30_000)).toBe(65)

    const returned = workoutComposerReducer(reviewing, {
      type: 'return_to_editing',
      now: reviewAtMs + 1_000,
    })
    const editedAgain = workoutComposerReducer(returned, {
      type: 'update_draft',
      patch: { notes: 'Bench press felt strong\nIncline press after' },
      now: reviewAtMs + 2_000,
      nowIso: new Date(reviewAtMs + 2_000).toISOString(),
    })

    expect(editedAgain.stage).toBe('editing')
    expect(editedAgain.timer.status).toBe('frozen')
    expect(getWorkoutComposerElapsedSeconds(editedAgain, reviewAtMs + 90_000)).toBe(65)
  })

  test('clears the session when discarded', () => {
    const started = workoutComposerReducer(createEmptyWorkoutComposerSession(), {
      type: 'update_draft',
      patch: { notes: 'Deadlift day' },
      now: START_MS,
      nowIso: START_ISO,
    })

    const discarded = workoutComposerReducer(started, { type: 'discard' })

    expect(discarded).toEqual(createEmptyWorkoutComposerSession())
  })

  test('moves into enqueueing and back to reviewing after an enqueue failure', () => {
    const reviewing = workoutComposerReducer(
      workoutComposerReducer(createEmptyWorkoutComposerSession(), {
        type: 'update_draft',
        patch: { notes: 'Squat 5x5', structuredData: makeStructuredData(), isStructuredMode: true },
        now: START_MS,
        nowIso: START_ISO,
      }),
      {
        type: 'enter_review',
        now: START_MS + 10_000,
        nowIso: new Date(START_MS + 10_000).toISOString(),
        defaultTitle: 'Morning Session',
      },
    )

    const enqueueing = workoutComposerReducer(reviewing, {
      type: 'set_enqueueing',
      now: START_MS + 11_000,
    })
    const failed = workoutComposerReducer(enqueueing, {
      type: 'mark_enqueue_failed',
      now: START_MS + 12_000,
    })

    expect(enqueueing.stage).toBe('enqueueing')
    expect(failed.stage).toBe('reviewing')
  })
})

describe('workout composer session hydration helpers', () => {
  test('normalizes persisted enqueueing and error stages into editable states', () => {
    const structuredData = makeStructuredData()

    const normalizedEnqueueing = normalizePersistedWorkoutComposerSession({
      stage: 'enqueueing',
      draft: {
        notes: 'Bench',
        title: 'Push Day',
        structuredData,
        isStructuredMode: true,
        selectedRoutineId: null,
        routineSource: null,
        song: null,
      },
      review: {
        title: 'Push Day',
        description: 'Solid day',
        imageUri: null,
        performedAt: START_ISO,
        song: null,
      },
      timer: {
        status: 'frozen',
        startedAt: null,
        elapsedBaseSeconds: 300,
        frozenElapsedSeconds: 300,
      },
      meta: {
        updatedAt: START_MS,
        hydratedFrom: 'composer_snapshot',
        sessionId: 'session-1',
      },
    })

    const normalizedError = normalizePersistedWorkoutComposerSession({
      stage: 'error',
      draft: {
        notes: 'Bench',
        title: '',
        structuredData,
        isStructuredMode: true,
        selectedRoutineId: null,
        routineSource: null,
        song: null,
      },
      review: {
        title: '',
        description: '',
        imageUri: null,
        performedAt: START_ISO,
        song: null,
      },
      timer: {
        status: 'frozen',
        startedAt: null,
        elapsedBaseSeconds: 300,
        frozenElapsedSeconds: 300,
      },
    })

    expect(normalizedEnqueueing.stage).toBe('reviewing')
    expect(normalizedError.stage).toBe('editing')
  })

  test('migrates a legacy workout draft into the new session model', () => {
    const legacyDraft: WorkoutDraft = {
      notes: 'Bench then incline',
      title: 'Push Day',
      structuredData: makeStructuredData(),
      isStructuredMode: true,
      selectedRoutineId: 'routine-1',
      timerElapsedSeconds: 420,
      updatedAt: START_MS,
    }

    const session = createWorkoutComposerSessionFromLegacyDraft(legacyDraft)

    expect(session.stage).toBe('editing')
    expect(session.draft.notes).toBe('Bench then incline')
    expect(session.draft.selectedRoutineId).toBe('routine-1')
    expect(session.draft.routineSource).toBe('draft')
    expect(session.review.title).toBe('Push Day')
    expect(session.timer.status).toBe('frozen')
    expect(session.timer.frozenElapsedSeconds).toBe(420)
    expect(session.meta.hydratedFrom).toBe('legacy_draft')
  })

  test('restores a pending workout back into an editable composer session', () => {
    const pending: PendingWorkout = {
      notes: 'Bench Press\nSet 1: 225 lb x 5 reps',
      parserNotes: 'Bench press felt strong',
      title: 'Push Day',
      imageUrl: 'https://cdn.example.com/workout.jpg',
      weightUnit: 'lb',
      userId: 'user-1',
      routineId: 'routine-1',
      durationSeconds: 540,
      description: 'Great lockout today',
      structuredData: makeStructuredData(),
      isStructuredMode: true,
      song: {
        trackId: 1,
        trackName: 'Till I Collapse',
        artistName: 'Eminem',
        artworkUrl100: 'https://cdn.example.com/art.jpg',
        previewUrl: 'https://cdn.example.com/preview.m4a',
      },
      performedAt: START_ISO,
      timezoneOffsetMinutes: 0,
    }

    const session = createWorkoutComposerSessionFromPendingWorkout(pending)

    expect(session.stage).toBe('editing')
    expect(session.draft.notes).toBe('Bench press felt strong')
    expect(session.review.description).toBe('Great lockout today')
    expect(session.review.imageUri).toBe('https://cdn.example.com/workout.jpg')
    expect(session.review.song?.trackName).toBe('Till I Collapse')
    expect(session.timer.status).toBe('frozen')
    expect(session.timer.frozenElapsedSeconds).toBe(540)
    expect(session.meta.hydratedFrom).toBe('restored_pending')
  })
})
