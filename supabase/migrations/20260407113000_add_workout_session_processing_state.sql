-- Keep in-progress workout writes out of feed/count queries until exercise persistence finishes.

alter table public.workout_sessions
  add column is_processing boolean not null default false;

create index idx_workout_sessions_processing_state
  on public.workout_sessions(is_processing, date desc);
