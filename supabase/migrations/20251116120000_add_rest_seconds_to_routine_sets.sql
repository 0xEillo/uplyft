-- Add rest_seconds to workout routine sets so templates can include rest cues

alter table public.workout_routine_sets
  add column if not exists rest_seconds integer;

do $$
begin
  if not exists (
    select 1
    from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'workout_routine_sets'
      and constraint_name = 'workout_routine_sets_rest_seconds_check'
  ) then
    alter table public.workout_routine_sets
      add constraint workout_routine_sets_rest_seconds_check
      check (
        rest_seconds is null
        or (
          rest_seconds >= 0
          and rest_seconds <= 3600
        )
      );
  end if;
end;
$$;

comment on column public.workout_routine_sets.rest_seconds is
  'Recommended rest interval between sets (seconds, nullable)';






