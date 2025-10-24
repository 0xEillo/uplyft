-- Enable trigram search for exercises and expose a helper function

create extension if not exists pg_trgm;

-- Trigram indexes to accelerate similarity lookups on exercise names and aliases
create index if not exists idx_exercises_name_trgm
  on exercises using gin (name gin_trgm_ops);

create or replace function exercise_aliases_text(input text[])
returns text
language sql
immutable
as $$
  select coalesce(array_to_string(input, ' '), '');
$$;

create index if not exists idx_exercises_aliases_trgm
  on exercises using gin (exercise_aliases_text(aliases) gin_trgm_ops);

-- Utility to normalize exercise text (mirror of application sanitize logic)
create or replace function sanitize_exercise_text(input text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      lower(
        regexp_replace(coalesce(input, ''), '\([^)]*\)', ' ', 'g')
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

-- Trigram-based exercise matcher
create or replace function match_exercises_trgm(
  search_query text,
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
  name_similarity float,
  alias_similarity float,
  best_similarity float
)
language sql
stable
as $$
  with normalized as (
    select sanitize_exercise_text(search_query) as query
  ),
  prepared as (
    select
      e.*, 
      sanitize_exercise_text(e.name) as sanitized_name,
      coalesce(
        array(
          select sanitize_exercise_text(alias)
          from unnest(coalesce(e.aliases, '{}')) as alias
        ),
        '{}'
      ) as sanitized_aliases
    from exercises e
  ),
  scored as (
    select
      p.id,
      p.name,
      p.aliases,
      p.muscle_group,
      p.type,
      p.equipment,
      similarity(p.sanitized_name, n.query) as name_similarity,
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
    name_similarity,
    alias_similarity,
    greatest(name_similarity, alias_similarity) as best_similarity
  from scored
  where greatest(name_similarity, alias_similarity) >= similarity_threshold
  order by best_similarity desc
  limit match_count;
$$;

