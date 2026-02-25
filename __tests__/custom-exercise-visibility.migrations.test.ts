import fs from 'fs'
import path from 'path'

const root = process.cwd()

const readMigration = (name: string) =>
  fs.readFileSync(path.join(root, 'supabase', 'migrations', name), 'utf8')

describe('custom exercise visibility migration architecture', () => {
  test('restores strict direct exercise visibility and adds routine-scoped display RPC', () => {
    const sql = readMigration(
      '20260225152000_fix_custom_exercise_visibility_architecture.sql',
    )

    expect(sql).toContain(
      'create policy "Exercises visible to owners or global"',
    )
    expect(sql).toContain(
      'get_visible_workout_routine_exercise_exercise_details',
    )
    expect(sql).toContain('resolve_exercise_for_routine_log')
    expect(sql).toContain('create_workout_from_routine')
    expect(sql).toContain(
      'public.resolve_exercise_for_routine_log(exercise_id, v_user_id, p_routine_id)',
    )
  })

  test('adds social/workout scoped exercise hydration RPC', () => {
    const sql = readMigration(
      '20260225143000_add_visible_workout_exercise_details_rpc.sql',
    )

    expect(sql).toContain('get_visible_workout_exercise_exercise_details')
    expect(sql).toContain('public.can_view_user_content(ws.user_id)')
  })

  test('adds view-only exercise detail RPC for exercise page', () => {
    const sql = readMigration(
      '20260225161000_add_viewable_exercise_detail_rpc.sql',
    )

    expect(sql).toContain('get_viewable_exercise_by_id')
    expect(sql).toContain('or public.can_view_user_content(e.created_by)')
    expect(sql).not.toContain('order by name')
  })
})
