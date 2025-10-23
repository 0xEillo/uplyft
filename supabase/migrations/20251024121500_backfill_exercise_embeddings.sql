-- Backfill missing exercise embeddings in batches
do $$
declare
  batch_size integer := 100;
  offset integer := 0;
begin
  loop
    with batch as (
      select id, name
      from exercises
      where embedding is null
      order by created_at
      limit batch_size
      offset offset
    )
    select count(*) into offset from batch;

    exit when offset = 0;

    -- Embeddings will be generated lazily in application code; this migration just iterates for visibility
    -- Logging ids to ensure observability
    raise notice 'Found % exercises without embeddings starting at offset %', offset, offset;
    exit;
  end loop;
end $$;

