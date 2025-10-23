-- Enable pgvector extension and add exercise embeddings
create extension if not exists vector;

alter table exercises
add column if not exists embedding vector(1536);

-- Populate existing rows lazily; embeddings will be generated on demand in application code

create index if not exists idx_exercises_embedding on exercises using ivfflat (embedding vector_l2_ops) with (lists = 200);

