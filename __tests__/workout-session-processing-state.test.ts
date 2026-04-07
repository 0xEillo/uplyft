import fs from 'fs'
import path from 'path'

const root = process.cwd()

describe('workout session processing state migration', () => {
  test('adds an is_processing column and supporting index', () => {
    const sql = fs.readFileSync(
      path.join(
        root,
        'supabase',
        'migrations',
        '20260407113000_add_workout_session_processing_state.sql',
      ),
      'utf8',
    )

    expect(sql).toContain('add column is_processing boolean not null default false')
    expect(sql).toContain('create index idx_workout_sessions_processing_state')
    expect(sql).toContain('on public.workout_sessions(is_processing, date desc)')
  })
})
