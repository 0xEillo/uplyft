create table if not exists chat_context_cache (
  user_id uuid primary key references profiles(id) on delete cascade,
  summary jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists chat_context_cache_updated_at_idx
  on chat_context_cache(updated_at);

