-- Batch exercise trigram matching to reduce one-RPC-per-exercise overhead
-- in the parse-workout resolver.

drop function if exists match_exercises_trgm_batch(text[], uuid, int, float);

create or replace function match_exercises_trgm_batch(
  search_queries text[],
  requesting_user_id uuid,
  match_count int default 20,
  similarity_threshold float default 0.4
)
returns table (
  search_query text,
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
  with queries as (
    select
      trim(q.query) as search_query,
      q.ord
    from unnest(coalesce(search_queries, '{}')) with ordinality as q(query, ord)
    where q.query is not null
      and trim(q.query) <> ''
  )
  select
    queries.search_query,
    matches.id,
    matches.name,
    matches.aliases,
    matches.muscle_group,
    matches.type,
    matches.equipment,
    matches.created_by,
    matches.name_similarity,
    matches.alias_similarity,
    matches.best_similarity
  from queries
  cross join lateral match_exercises_trgm(
    queries.search_query,
    requesting_user_id,
    match_count,
    similarity_threshold
  ) as matches
  order by queries.ord;
$$;

comment on function match_exercises_trgm_batch(text[], uuid, int, float) is
'Batch wrapper around match_exercises_trgm. Accepts multiple search queries and returns per-query candidate matches in one RPC to reduce network/database round-trip overhead.';
