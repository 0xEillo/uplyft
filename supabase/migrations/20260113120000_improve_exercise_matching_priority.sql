-- Fix exercise matching by NOT stripping equipment from names
-- 
-- Problem: The old sanitize_exercise_text strips "(Barbell)", "(Smith Machine)", etc.
-- This makes ALL variations of an exercise appear identical:
--   "Bench Press (Barbell)" → "bench press"
--   "Bench Press (Smith Machine)" → "bench press"  
--   Both get similarity 1.0 → arbitrary winner
--
-- Solution: Create a new function that preserves equipment info in names,
-- but still sanitizes for fuzzy matching. Let ALIASES drive the canonical short forms.
--
-- Now: "Bench Press" query matches:
--   - "Bench Press (Barbell)" via its "Bench Press" alias → similarity 1.0
--   - "Bench Press (Smith Machine)" via name → similarity ~0.65

-- New sanitize function that PRESERVES parenthetical content (equipment info)
create or replace function sanitize_exercise_name(input text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      lower(coalesce(input, '')),
      '[^a-z0-9()]+',  -- Keep parentheses, remove other special chars
      ' ',
      'g'
    )
  );
$$;

-- Drop the old function signature
drop function if exists match_exercises_trgm(text, uuid, int, float);

create or replace function match_exercises_trgm(
  search_query text,
  requesting_user_id uuid,
  match_count int default 20,
  similarity_threshold float default 0.4
)
returns table (
  id uuid,
  name text,
  aliases text[],
  muscle_group text,
  type text,
  equipment text,
  created_by uuid,
  name_similarity float,
  alias_similarity float,
  best_similarity float
)
language sql
stable
as $$
  with normalized as (
    -- Sanitize query - strip parentheticals from USER input in case they type them
    -- But keep the exercise names with their equipment for differentiation
    select sanitize_exercise_text(search_query) as query
  ),
  prepared as (
    select
      e.*,
      -- Use the NEW function that preserves equipment in names
      sanitize_exercise_name(e.name) as sanitized_name,
      -- Aliases are already short forms, sanitize them normally
      coalesce(
        array(
          select sanitize_exercise_text(alias)
          from unnest(coalesce(e.aliases, '{}')) as alias
        ),
        '{}'
      ) as sanitized_aliases
    from exercises e
    where e.created_by is null
      or e.created_by = requesting_user_id
  ),
  scored as (
    select
      p.id,
      p.name,
      p.aliases,
      p.muscle_group,
      p.type,
      p.equipment,
      p.created_by,
      -- Name similarity: "bench press" vs "bench press (barbell)" → ~0.75
      similarity(p.sanitized_name, n.query) as name_similarity,
      -- Alias similarity: "bench press" vs alias "bench press" → 1.0
      coalesce(
        (select max(similarity(sa, n.query))
         from unnest(p.sanitized_aliases) as sa),
        0
      ) as alias_similarity
    from normalized n
    cross join prepared p
  )
  select
    id,
    name,
    aliases,
    muscle_group,
    type,
    equipment,
    created_by,
    name_similarity,
    alias_similarity,
    greatest(name_similarity, alias_similarity) as best_similarity
  from scored
  where greatest(name_similarity, alias_similarity) >= similarity_threshold
  order by 
    -- Primary: best match (name or alias)
    greatest(name_similarity, alias_similarity) desc,
    -- Secondary: prefer alias matches (canonical short forms)
    alias_similarity desc,
    -- Tertiary: shorter names = more canonical
    length(name)
  limit match_count;
$$;

comment on function match_exercises_trgm(text, uuid, int, float) is 
'Exercise search that respects the "Exercise (Equipment)" naming convention.

How it works:
- Exercise NAMES keep their equipment: "Bench Press (Barbell)" → "bench press (barbell)"
- Exercise ALIASES are the canonical short forms: "Bench Press", "DB Bench", etc.
- When user types "Bench Press", it matches:
  - "Bench Press (Barbell)" via its "Bench Press" alias → similarity 1.0 ✓
  - "Bench Press (Smith Machine)" via name only → similarity ~0.65

This naturally prioritizes exercises that have proper aliases set up.';
