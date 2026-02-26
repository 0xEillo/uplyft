import fs from 'fs'
import path from 'path'

const root = process.cwd()

describe('workout posting optimization migration', () => {
  test('adds batch trigram match RPC that wraps match_exercises_trgm', () => {
    const sql = fs.readFileSync(
      path.join(
        root,
        'supabase',
        'migrations',
        '20260225173000_add_match_exercises_trgm_batch.sql',
      ),
      'utf8',
    )

    expect(sql).toContain('create or replace function match_exercises_trgm_batch')
    expect(sql).toContain('search_queries text[]')
    expect(sql).toContain('returns table (')
    expect(sql).toContain('search_query text,')
    expect(sql).toContain('cross join lateral match_exercises_trgm(')
    expect(sql).toContain('comment on function match_exercises_trgm_batch')
  })
})
