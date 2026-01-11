-- Add warmup tracking to performed sets
alter table public.sets
  add column if not exists is_warmup boolean not null default false;


