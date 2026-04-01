import fs from 'fs'
import path from 'path'

import {
  WORKOUT_SESSION_IDEMPOTENCY_INDEX,
  isWorkoutSessionIdempotencyConflict,
  normalizeIdempotencyKey,
} from '../supabase/functions/parse-workout/idempotency'

const root = process.cwd()

describe('workout session idempotency', () => {
  test('normalizes optional client idempotency keys', () => {
    expect(normalizeIdempotencyKey(undefined)).toBeNull()
    expect(normalizeIdempotencyKey(null)).toBeNull()
    expect(normalizeIdempotencyKey('   ')).toBeNull()
    expect(normalizeIdempotencyKey(' key-123 ')).toBe('key-123')
  })

  test('detects unique violations for the workout idempotency index', () => {
    expect(
      isWorkoutSessionIdempotencyConflict({
        code: '23505',
        message: `duplicate key value violates unique constraint "${WORKOUT_SESSION_IDEMPOTENCY_INDEX}"`,
      }),
    ).toBe(true)

    expect(
      isWorkoutSessionIdempotencyConflict({
        code: '23505',
        details: `Key (user_id, client_idempotency_key) already exists on ${WORKOUT_SESSION_IDEMPOTENCY_INDEX}.`,
      }),
    ).toBe(true)

    expect(
      isWorkoutSessionIdempotencyConflict({
        code: '23505',
        message: 'duplicate key value violates unique constraint "some_other_constraint"',
      }),
    ).toBe(false)

    expect(
      isWorkoutSessionIdempotencyConflict({
        code: '40001',
        message: `duplicate key value violates unique constraint "${WORKOUT_SESSION_IDEMPOTENCY_INDEX}"`,
      }),
    ).toBe(false)
  })

  test('migration adds idempotency column and unique partial index', () => {
    const sql = fs.readFileSync(
      path.join(
        root,
        'supabase',
        'migrations',
        '20260401120000_add_workout_session_idempotency.sql',
      ),
      'utf8',
    )

    expect(sql).toContain('add column client_idempotency_key text')
    expect(sql).toContain(
      `create unique index ${WORKOUT_SESSION_IDEMPOTENCY_INDEX}`,
    )
    expect(sql).toContain(
      'on public.workout_sessions(user_id, client_idempotency_key)',
    )
    expect(sql).toContain('where client_idempotency_key is not null')
  })
})
