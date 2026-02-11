import type { PendingWorkout, WorkoutDraft } from '../lib/utils/workout-draft'
import { buildHydrationPlan } from '../lib/utils/workout-draft-hydration'

const baseDraft: WorkoutDraft = {
  notes: '',
  title: '',
  structuredData: [],
  isStructuredMode: false,
  selectedRoutineId: null,
  timerStartedAt: null,
  timerElapsedSeconds: 0,
  updatedAt: 0,
}

const basePending: PendingWorkout = {
  notes: '',
  title: '',
  imageUrl: null,
  weightUnit: 'lb',
  userId: 'user-1',
  performedAt: '2025-01-01T00:00:00.000Z',
  timezoneOffsetMinutes: 0,
}

describe('buildHydrationPlan', () => {
  test('skips hydration when local edits are newer and no new route routine', () => {
    const plan = buildHydrationPlan({
      draft: { ...baseDraft, notes: 'draft', updatedAt: 100 },
      pending: null,
      selectedRoutineId: null,
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: true,
      lastLocalEditAt: 200,
    })

    expect(plan.shouldSkip).toBe(true)
    expect(plan.hasNewRouteRoutine).toBe(false)
  })

  test('does not skip when a new route routine arrives', () => {
    const plan = buildHydrationPlan({
      draft: { ...baseDraft, notes: 'draft', updatedAt: 100 },
      pending: null,
      selectedRoutineId: 'route-1',
      refresh: '1',
      lastRouteRoutineToken: null,
      hasHydrated: true,
      lastLocalEditAt: 200,
    })

    expect(plan.shouldSkip).toBe(false)
    expect(plan.hasNewRouteRoutine).toBe(true)
    expect(plan.effectiveRoutineId).toBe('route-1')
    expect(plan.routineSource).toBe('route')
  })

  test('route routine token must change to be considered new', () => {
    const plan = buildHydrationPlan({
      draft: null,
      pending: null,
      selectedRoutineId: 'routine-1',
      refresh: 'abc',
      lastRouteRoutineToken: 'routine-1:abc',
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.hasNewRouteRoutine).toBe(false)
    expect(plan.effectiveRoutineId).toBeNull()
  })

  test('refresh change marks a new route routine token', () => {
    const plan = buildHydrationPlan({
      draft: null,
      pending: null,
      selectedRoutineId: 'routine-1',
      refresh: 'def',
      lastRouteRoutineToken: 'routine-1:abc',
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.hasNewRouteRoutine).toBe(true)
    expect(plan.routeRoutineToken).toBe('routine-1:def')
  })

  test('draft notes take precedence over pending notes', () => {
    const plan = buildHydrationPlan({
      draft: { ...baseDraft, notes: 'draft note' },
      pending: { ...basePending, notes: 'pending note' },
      selectedRoutineId: null,
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.notes).toBe('draft note')
  })

  test('pending notes are used when draft notes are empty', () => {
    const plan = buildHydrationPlan({
      draft: { ...baseDraft, notes: '' },
      pending: { ...basePending, notes: 'pending note' },
      selectedRoutineId: null,
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.notes).toBe('pending note')
  })

  test('structured data sets structured mode true by default', () => {
    const plan = buildHydrationPlan({
      draft: {
        ...baseDraft,
        structuredData: [
          { id: 'ex-1', name: 'Bench', sets: [{ weight: '', reps: '' }] },
        ],
        isStructuredMode: undefined,
      },
      pending: null,
      selectedRoutineId: null,
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.structuredData?.length).toBe(1)
    expect(plan.isStructuredMode).toBe(true)
  })

  test('structured data respects explicit structured mode flag', () => {
    const plan = buildHydrationPlan({
      draft: {
        ...baseDraft,
        structuredData: [
          { id: 'ex-1', name: 'Bench', sets: [{ weight: '', reps: '' }] },
        ],
        isStructuredMode: false,
      },
      pending: null,
      selectedRoutineId: null,
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.isStructuredMode).toBe(false)
  })

  test('structured mode can be set even without structured data', () => {
    const plan = buildHydrationPlan({
      draft: { ...baseDraft, isStructuredMode: true },
      pending: null,
      selectedRoutineId: null,
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.structuredData).toBeUndefined()
    expect(plan.isStructuredMode).toBe(true)
  })

  test('route routine overrides draft routine when new', () => {
    const plan = buildHydrationPlan({
      draft: { ...baseDraft, selectedRoutineId: 'draft-routine' },
      pending: null,
      selectedRoutineId: 'route-routine',
      refresh: '1',
      lastRouteRoutineToken: null,
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.effectiveRoutineId).toBe('route-routine')
    expect(plan.routineSource).toBe('route')
  })

  test('draft routine is used when no new route routine', () => {
    const plan = buildHydrationPlan({
      draft: { ...baseDraft, selectedRoutineId: 'draft-routine' },
      pending: null,
      selectedRoutineId: null,
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.effectiveRoutineId).toBe('draft-routine')
    expect(plan.routineSource).toBe('draft')
  })

  test('shouldApplyHydration is true when pending has a title', () => {
    const plan = buildHydrationPlan({
      draft: null,
      pending: { ...basePending, title: 'Pending Title' },
      selectedRoutineId: null,
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.shouldApplyHydration).toBe(true)
  })

  test('shouldApplyHydration is true when timer exists', () => {
    const plan = buildHydrationPlan({
      draft: {
        ...baseDraft,
        timerStartedAt: '2025-01-01T00:00:00.000Z',
        timerElapsedSeconds: 10,
      },
      pending: null,
      selectedRoutineId: null,
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.shouldApplyHydration).toBe(true)
    expect(plan.shouldHydrateTimer).toBe(true)
  })

  test('shouldHydrateTimer is false when no draft', () => {
    const plan = buildHydrationPlan({
      draft: null,
      pending: null,
      selectedRoutineId: null,
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.shouldHydrateTimer).toBe(false)
  })

  test('route token includes blank refresh', () => {
    const plan = buildHydrationPlan({
      draft: null,
      pending: null,
      selectedRoutineId: 'routine-1',
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.routeRoutineToken).toBe('routine-1:')
  })

  test('shouldApplyHydration false when no content', () => {
    const plan = buildHydrationPlan({
      draft: null,
      pending: null,
      selectedRoutineId: null,
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: false,
      lastLocalEditAt: 0,
    })

    expect(plan.shouldApplyHydration).toBe(false)
  })

  test('resets to empty when hydrated local state exists but disk draft was cleared', () => {
    const plan = buildHydrationPlan({
      draft: null,
      pending: null,
      selectedRoutineId: null,
      refresh: null,
      lastRouteRoutineToken: null,
      hasHydrated: true,
      lastLocalEditAt: 500,
    })

    expect(plan.shouldResetToEmpty).toBe(true)
    expect(plan.shouldSkip).toBe(false)
  })

  test('does not reset to empty when a new route routine arrives', () => {
    const plan = buildHydrationPlan({
      draft: null,
      pending: null,
      selectedRoutineId: 'route-1',
      refresh: 'x',
      lastRouteRoutineToken: null,
      hasHydrated: true,
      lastLocalEditAt: 500,
    })

    expect(plan.shouldResetToEmpty).toBe(false)
    expect(plan.hasNewRouteRoutine).toBe(true)
  })
})
