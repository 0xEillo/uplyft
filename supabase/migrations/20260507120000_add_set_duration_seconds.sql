alter table public.sets
  add column if not exists duration_seconds integer;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'sets'
      and constraint_name = 'sets_duration_seconds_check'
  ) then
    alter table public.sets
      add constraint sets_duration_seconds_check
      check (
        duration_seconds is null
        or (
          duration_seconds >= 1
          and duration_seconds <= 86400
        )
      );
  end if;
end $$;

comment on column public.sets.duration_seconds is
  'Duration performed for timed sets, stored in seconds.';
