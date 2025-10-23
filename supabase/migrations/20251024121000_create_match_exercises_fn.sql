-- Function to match exercises using pgvector similarity search
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

