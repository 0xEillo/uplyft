-- Vector embeddings, similarity search, and trigram helpers for exercises

create extension if not exists vector;

alter table exercises
add column if not exists embedding vector(1536);

create index if not exists idx_exercises_embedding
  on exercises using ivfflat (embedding vector_l2_ops) with (lists = 200);

-- Vector similarity RPC
create or replace function match_exercises(
  query_embedding vector(1536),
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
    1 - (e.embedding <=> query_embedding) as similarity
  from exercises e
  where e.embedding is not null
  order by e.embedding <=> query_embedding
  limit match_count;
end;
$$ language plpgsql;

-- Diagnostic backfill (noop on empty DB but preserved for parity)
do $$
declare
  batch_size integer := 100;
  batch_offset integer := 0;
begin
  loop
    with batch as (
      select id, name
      from exercises
      where embedding is null
      order by created_at
      limit batch_size
      offset batch_offset
    )
    select count(*) into batch_offset from batch;

    exit when batch_offset = 0;

    raise notice 'Found % exercises without embeddings starting at offset %', batch_offset, batch_offset;
    exit;
  end loop;
end $$;

-- Text search helpers
create extension if not exists pg_trgm;

create or replace function exercise_aliases_text(input text[])
returns text
language sql
immutable
as $$
  select coalesce(array_to_string(input, ' '), '');
$$;

create index if not exists idx_exercises_name_trgm
  on exercises using gin (name gin_trgm_ops);

create index if not exists idx_exercises_aliases_trgm
  on exercises using gin (exercise_aliases_text(aliases) gin_trgm_ops);

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

