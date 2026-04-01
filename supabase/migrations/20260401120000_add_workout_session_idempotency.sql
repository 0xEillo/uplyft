-- Prevent duplicate workout session creation when the client retries the same submission.

alter table public.workout_sessions
  add column client_idempotency_key text;

create unique index idx_workout_sessions_user_idempotency_key_unique
  on public.workout_sessions(user_id, client_idempotency_key)
  where client_idempotency_key is not null;
