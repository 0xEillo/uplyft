-- Limit exercise visibility to the creator and preserve global entries

-- Remove the legacy unique constraint so we can scope uniqueness per creator
alter table exercises
drop constraint if exists exercises_name_key;

-- Global (system) exercises should still be unique regardless of case
create unique index if not exists idx_exercises_global_name_unique
  on exercises (lower(name))
  where created_by is null;

-- User-created exercises should only collide within the same owner
create unique index if not exists idx_exercises_owner_name_unique
  on exercises (created_by, lower(name))
  where created_by is not null;

-- Tighten SELECT policy so athletes only see system exercises + their own
drop policy if exists "Exercises are viewable by everyone" on exercises;
create policy "Exercises visible to owners or global"
  on exercises for select
  using (
    created_by is null
    or created_by = (select auth.uid())
  );

-- Replace the vector search RPC with a version that scopes by requesting user
drop function if exists match_exercises(vector(1536), int, float);
create or replace function match_exercises(
  query_embedding vector(1536),
  requesting_user_id uuid,
  match_count int default 20,
  similarity_threshold float default 0.6
)
returns table (
  id uuid,
  name text,
  aliases text[],
  muscle_group text,
  type text,
  equipment text,
  created_by uuid,
  similarity float
) as $$
begin
  return query
  select
    e.id,
    e.name,
    e.aliases,
    e.muscle_group,
    e.type,
    e.equipment,
    e.created_by,
    1 - (e.embedding <=> query_embedding) as similarity
  from exercises e
  where e.embedding is not null
    and (e.created_by is null or e.created_by = requesting_user_id)
    and (1 - (e.embedding <=> query_embedding)) >= similarity_threshold
  order by e.embedding <=> query_embedding
  limit match_count;
end;
$$ language plpgsql;

-- Replace the trigram search RPC with the same visibility constraints
drop function if exists match_exercises_trgm(text, int, float);
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
    created_by,
    name_similarity,
    alias_similarity,
    greatest(name_similarity, alias_similarity) as best_similarity
  from scored
  where greatest(name_similarity, alias_similarity) >= similarity_threshold
  order by best_similarity desc
  limit match_count;
$$;

