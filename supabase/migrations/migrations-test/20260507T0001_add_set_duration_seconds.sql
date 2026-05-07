alter table if exists public.sets
  add column if not exists duration_seconds integer;

alter table public.sets
  drop constraint if exists sets_duration_seconds_check;

alter table public.sets
  add constraint sets_duration_seconds_check
  check (
    duration_seconds is null
    or (
      duration_seconds >= 1
      and duration_seconds <= 86400
    )
  );
