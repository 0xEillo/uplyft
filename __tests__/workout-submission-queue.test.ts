import { MMKV } from 'react-native-mmkv'

import { ApiError } from '../lib/api/errors'
import { postWorkout } from '../lib/api/post-workout'
import { database } from '../lib/database'
import { uploadWorkoutImage } from '../lib/utils/image-upload'
import { loadStoredWorkoutComposerSession } from '../lib/utils/workout-composer-storage'
import {
  enqueueWorkoutSubmission,
  peekPendingWorkoutPlaceholder,
  processPendingWorkoutSubmission,
} from '../lib/utils/workout-submission-queue'
import {
  loadPendingWorkout,
  loadPlaceholderWorkout,
  savePendingWorkout,
  savePlaceholderWorkout,
  type PendingWorkout,
} from '../lib/utils/workout-draft'
import type { WorkoutComposerSession } from '../lib/utils/workout-composer-session'

jest.mock('@/lib/api/post-workout', () => ({
  postWorkout: jest.fn(),
}))

jest.mock('@/lib/database', () => ({
  database: {
    profiles: {
      getById: jest.fn(),
    },
  },
}))

jest.mock('@/lib/utils/image-upload', () => ({
  uploadWorkoutImage: jest.fn(),
}))

jest.mock('@/lib/mixpanel', () => ({
  mixpanel: {
    track: jest.fn(),
  },
}))

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'idempotency-key-1'),
}))

const mmkvMock = MMKV as typeof MMKV & { __clearAll: () => void }
const mockPostWorkout = postWorkout as jest.MockedFunction<typeof postWorkout>
const mockUploadWorkoutImage = uploadWorkoutImage as jest.MockedFunction<
  typeof uploadWorkoutImage
>
const mockGetProfileById = database.profiles.getById as jest.MockedFunction<
  typeof database.profiles.getById
>

const performedAt = '2026-03-31T09:00:00.000Z'

function makeStructuredData() {
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

function makeSession(): WorkoutComposerSession {
  return {
    stage: 'reviewing',
    draft: {
      notes: 'Bench press felt strong',
      title: 'Push Day',
      structuredData: makeStructuredData(),
      isStructuredMode: true,
      selectedRoutineId: 'routine-1',
      routineSource: 'route',
      song: {
        trackId: 1,
        trackName: 'Till I Collapse',
        artistName: 'Eminem',
        artworkUrl100: 'https://cdn.example.com/art.jpg',
        previewUrl: 'https://cdn.example.com/preview.m4a',
      },
    },
    review: {
      title: 'Final Push Day',
      description: 'Great lockout today',
      imageUri: 'file:///tmp/workout-photo.jpg',
      performedAt,
      song: {
        trackId: 1,
        trackName: 'Till I Collapse',
        artistName: 'Eminem',
        artworkUrl100: 'https://cdn.example.com/art.jpg',
        previewUrl: 'https://cdn.example.com/preview.m4a',
      },
    },
    timer: {
      status: 'frozen',
      startedAt: null,
      elapsedBaseSeconds: 540,
      frozenElapsedSeconds: 540,
    },
    meta: {
      updatedAt: 100,
      hydratedFrom: 'none',
      sessionId: 'session-1',
    },
  }
}

function makePendingWorkout(overrides: Partial<PendingWorkout> = {}): PendingWorkout {
  return {
    notes: 'Bench Press\nSet 1: 225 lb x 5 reps',
    parserNotes: 'Bench press felt strong',
    title: 'Push Day',
    imageUrl: 'https://cdn.example.com/workout-photo.jpg',
    weightUnit: 'lb',
    userId: 'user-1',
    idempotencyKey: 'idempotency-key-1',
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
    performedAt,
    timezoneOffsetMinutes: 0,
    ...overrides,
  }
}

beforeEach(() => {
  mmkvMock.__clearAll()
  jest.clearAllMocks()
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse(performedAt))
  mockUploadWorkoutImage.mockResolvedValue('https://cdn.example.com/workout-photo.jpg')
  mockGetProfileById.mockResolvedValue({
    display_name: 'Oliver',
    avatar_url: 'https://cdn.example.com/avatar.jpg',
  } as Awaited<ReturnType<typeof database.profiles.getById>>)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('workout submission queue', () => {
  test('enqueues a session into the pending queue and creates a placeholder workout', async () => {
    const { pending, placeholder } = await enqueueWorkoutSubmission({
      session: makeSession(),
      userId: 'user-1',
      weightUnit: 'lb',
    })

    expect(mockUploadWorkoutImage).toHaveBeenCalledWith(
      'file:///tmp/workout-photo.jpg',
      'user-1',
    )
    expect(pending.title).toBe('Final Push Day')
    expect(pending.notes).toContain('Bench Press')
    expect(pending.notes).toContain('225 lbs x 5 reps')
    expect(pending.notes).toContain('Bench press felt strong')
    expect(pending.parserNotes).toBe('Bench press felt strong')
    expect(pending.durationSeconds).toBe(540)
    expect(pending.imageUrl).toBe('https://cdn.example.com/workout-photo.jpg')
    expect(placeholder.title).toBe('Final Push Day')

    expect(await loadPendingWorkout()).toEqual(pending)
    expect(await peekPendingWorkoutPlaceholder()).toEqual(placeholder)
  })

  test('keeps pending artifacts when background processing fails due to a network error', async () => {
    const pending = makePendingWorkout()
    await savePendingWorkout(pending)
    await savePlaceholderWorkout({
      id: 'temp-1',
      title: pending.title,
      imageUrl: pending.imageUrl,
      song: pending.song,
      created_at: performedAt,
      isPending: true,
      user_id: pending.userId,
      profile: null,
    })

    mockPostWorkout.mockRejectedValue(
      new ApiError({
        error: 'Network error calling parse-workout',
        code: 'NETWORK',
      }),
    )

    const result = await processPendingWorkoutSubmission('access-token')

    expect(result.status).toBe('offline')
    expect(await loadPendingWorkout()).toEqual(pending)
    expect(await loadPlaceholderWorkout()).not.toBeNull()
    expect(await loadStoredWorkoutComposerSession()).toBeNull()
  })

  test('clears pending artifacts after a successful background submission', async () => {
    const pending = makePendingWorkout()
    await savePendingWorkout(pending)
    await savePlaceholderWorkout({
      id: 'temp-1',
      title: pending.title,
      imageUrl: pending.imageUrl,
      song: pending.song,
      created_at: performedAt,
      isPending: true,
      user_id: pending.userId,
      profile: null,
    })

    mockPostWorkout.mockResolvedValue({
      workout: {
        isWorkoutRelated: true,
        exercises: [],
      },
      createdWorkout: {
        id: 'workout-1',
      } as any,
      correlationId: 'corr-1',
    })

    const result = await processPendingWorkoutSubmission('access-token')

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.placeholder?.id).toBe('temp-1')
      expect(result.workout.id).toBe('workout-1')
    }
    expect(await loadPendingWorkout()).toBeNull()
    expect(await loadPlaceholderWorkout()).toBeNull()
  })

  test('restores the composer session when background submission fails for a non-network reason', async () => {
    const pending = makePendingWorkout()
    await savePendingWorkout(pending)
    await savePlaceholderWorkout({
      id: 'temp-1',
      title: pending.title,
      imageUrl: pending.imageUrl,
      song: pending.song,
      created_at: performedAt,
      isPending: true,
      user_id: pending.userId,
      profile: null,
    })

    mockPostWorkout.mockRejectedValue(new Error('Supabase function failed'))

    const result = await processPendingWorkoutSubmission('access-token')
    const restoredSession = await loadStoredWorkoutComposerSession()

    expect(result.status).toBe('error')
    expect(await loadPendingWorkout()).toBeNull()
    expect(await loadPlaceholderWorkout()).toBeNull()
    expect(restoredSession).not.toBeNull()
    expect(restoredSession?.meta.hydratedFrom).toBe('composer_snapshot')
    expect(restoredSession?.draft.notes).toBe('Bench press felt strong')
    expect(restoredSession?.review.description).toBe('Great lockout today')
    expect(restoredSession?.review.imageUri).toBe('https://cdn.example.com/workout-photo.jpg')
    expect(restoredSession?.timer.frozenElapsedSeconds).toBe(540)
  })

  test('returns none after a successful run when no pending workout remains', async () => {
    mockPostWorkout.mockResolvedValue({
      workout: {
        isWorkoutRelated: true,
        exercises: [],
      },
      createdWorkout: {
        id: 'workout-1',
      } as any,
    })

    await savePendingWorkout(makePendingWorkout())
    await processPendingWorkoutSubmission('access-token')

    expect(await processPendingWorkoutSubmission('access-token')).toEqual({
      status: 'none',
    })
  })
})
