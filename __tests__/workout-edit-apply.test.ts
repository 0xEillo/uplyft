import { database } from '../lib/database'
import { deleteWorkoutImage } from '../lib/utils/image-upload'
import { applyWorkoutEditPlan } from '../lib/workout-edit-apply'
import type { WorkoutEditPlan } from '../lib/workout-edit-plan'

jest.mock('@/lib/database', () => ({
  database: {
    workoutSessions: { update: jest.fn() },
    workoutExercises: {
      delete: jest.fn(),
      update: jest.fn(),
      updateOrder: jest.fn(),
    },
    sets: { delete: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('@/lib/utils/image-upload', () => ({
  deleteWorkoutImage: jest.fn(),
}))

const calls: string[] = []

function record(name: string, impl?: (...args: any[]) => Promise<unknown>) {
  return (...args: any[]) => {
    calls.push(`${name}(${args.map((a) => JSON.stringify(a)).join(', ')})`)
    return impl ? impl(...args) : Promise.resolve(undefined)
  }
}

function mockAll() {
  ;(database.workoutSessions.update as jest.Mock).mockImplementation(
    record('workoutSessions.update'),
  )
  ;(deleteWorkoutImage as jest.Mock).mockImplementation(
    record('deleteWorkoutImage'),
  )
  ;(database.workoutExercises.delete as jest.Mock).mockImplementation(
    record('workoutExercises.delete'),
  )
  ;(database.sets.delete as jest.Mock).mockImplementation(record('sets.delete'))
  ;(database.workoutExercises.update as jest.Mock).mockImplementation(
    record('workoutExercises.update'),
  )
  ;(database.workoutExercises.updateOrder as jest.Mock).mockImplementation(
    record('workoutExercises.updateOrder'),
  )
  ;(database.sets.update as jest.Mock).mockImplementation(record('sets.update'))
}

function makePlan(overrides: Partial<WorkoutEditPlan> = {}): WorkoutEditPlan {
  return {
    workoutId: 'w1',
    userId: 'u1',
    sessionUpdate: { type: 'Push', notes: null, duration: 600 },
    deleteImageUrl: 'https://img/old.jpg',
    deleteExerciseIds: ['we9', 'we8'],
    deleteSetIds: ['s9'],
    exerciseSwaps: [{ workoutExerciseId: 'we1', exerciseId: 'ex-new' }],
    order: [
      { workoutExerciseId: 'we2', orderIndex: 0 },
      { workoutExerciseId: 'we1', orderIndex: 1 },
    ],
    setUpdates: [
      { setId: 's1', updates: { reps: 5, weight: 100 } },
      { setId: 's2', updates: { duration_seconds: 60, reps: null, weight: null } },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  calls.length = 0
  mockAll()
})

describe('applyWorkoutEditPlan', () => {
  it('performs every write in the original order', async () => {
    await applyWorkoutEditPlan(makePlan())

    expect(calls).toEqual([
      'workoutSessions.update("w1", "u1", {"type":"Push","notes":null,"duration":600})',
      'deleteWorkoutImage("https://img/old.jpg")',
      'workoutExercises.delete("we9")',
      'workoutExercises.delete("we8")',
      'sets.delete("s9")',
      'workoutExercises.update("we1", "ex-new")',
      'workoutExercises.updateOrder("we2", 0)',
      'workoutExercises.updateOrder("we1", 1)',
      'sets.update("s1", {"reps":5,"weight":100})',
      'sets.update("s2", {"duration_seconds":60,"reps":null,"weight":null})',
    ])
  })

  it('passes set update objects through unchanged (including undefined keys)', async () => {
    const updates = { reps: undefined }
    await applyWorkoutEditPlan(
      makePlan({ setUpdates: [{ setId: 's1', updates }] }),
    )
    expect(database.sets.update).toHaveBeenCalledWith('s1', updates)
    expect(
      Object.keys((database.sets.update as jest.Mock).mock.calls[0][1]),
    ).toEqual(['reps'])
  })

  it('skips image deletion when there is no image to delete', async () => {
    await applyWorkoutEditPlan(makePlan({ deleteImageUrl: null }))
    expect(deleteWorkoutImage).not.toHaveBeenCalled()
  })

  it('makes only the session update for an empty plan', async () => {
    await applyWorkoutEditPlan(
      makePlan({
        deleteImageUrl: null,
        deleteExerciseIds: [],
        deleteSetIds: [],
        exerciseSwaps: [],
        order: [],
        setUpdates: [],
      }),
    )
    expect(calls).toEqual([
      'workoutSessions.update("w1", "u1", {"type":"Push","notes":null,"duration":600})',
    ])
  })

  it('waits for each phase before starting the next', async () => {
    let releaseDeletes: () => void = () => {}
    ;(database.workoutExercises.delete as jest.Mock).mockImplementation(
      record(
        'workoutExercises.delete',
        () => new Promise<void>((resolve) => (releaseDeletes = resolve)),
      ),
    )

    const pending = applyWorkoutEditPlan(makePlan({ deleteExerciseIds: ['we9'] }))
    await new Promise((resolve) => setImmediate(resolve))
    expect(calls[calls.length - 1]).toBe('workoutExercises.delete("we9")')
    expect(database.sets.delete).not.toHaveBeenCalled()

    releaseDeletes()
    await pending
    expect(database.sets.delete).toHaveBeenCalledWith('s9')
  })

  it('stops at the first failing phase and rejects with its error', async () => {
    const failure = new Error('boom')
    ;(database.sets.delete as jest.Mock).mockImplementation(
      record('sets.delete', () => Promise.reject(failure)),
    )

    await expect(applyWorkoutEditPlan(makePlan())).rejects.toBe(failure)
    expect(database.workoutExercises.update).not.toHaveBeenCalled()
    expect(database.workoutExercises.updateOrder).not.toHaveBeenCalled()
    expect(database.sets.update).not.toHaveBeenCalled()
  })

  it('rejects before any other write when the session update fails', async () => {
    const failure = new Error('ownership')
    ;(database.workoutSessions.update as jest.Mock).mockImplementation(
      record('workoutSessions.update', () => Promise.reject(failure)),
    )

    await expect(applyWorkoutEditPlan(makePlan())).rejects.toBe(failure)
    expect(calls).toHaveLength(1)
  })
})
