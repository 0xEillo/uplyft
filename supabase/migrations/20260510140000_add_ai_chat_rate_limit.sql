-- Per-user rate limit log for the AI chat edge function.
-- Goal: protect inference budget against runaway usage / abuse.
-- Strategy: append-only usage rows with a weight, atomic check + insert
-- in a single SECURITY DEFINER function. Older rows are pruned per call.

create table if not exists public.ai_chat_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  weight smallint not null default 1 check (weight > 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_usage_user_time_idx
  on public.ai_chat_usage (user_id, created_at desc);

alter table public.ai_chat_usage enable row level security;

-- No public policies: only service_role (edge functions) reads/writes this table.

create or replace function public.check_ai_chat_rate_limit(
  p_user_id uuid,
  p_weight integer default 1,
  p_minute_limit integer default 8,
  p_hour_limit integer default 60,
  p_day_limit integer default 200
) returns table (
  allowed boolean,
  reason text,
  minute_count integer,
  hour_count integer,
  day_count integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_min integer;
  v_hour integer;
  v_day integer;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  -- Opportunistic prune: drop rows older than the longest window we care about.
  delete from public.ai_chat_usage
   where user_id = p_user_id
     and created_at < v_now - interval '1 day';

  select coalesce(sum(weight), 0)::int into v_min
    from public.ai_chat_usage
   where user_id = p_user_id
     and created_at > v_now - interval '1 minute';

  select coalesce(sum(weight), 0)::int into v_hour
    from public.ai_chat_usage
   where user_id = p_user_id
     and created_at > v_now - interval '1 hour';

  select coalesce(sum(weight), 0)::int into v_day
    from public.ai_chat_usage
   where user_id = p_user_id
     and created_at > v_now - interval '1 day';

  if v_min + p_weight > p_minute_limit then
    return query select false, 'minute'::text, v_min, v_hour, v_day, 60;
    return;
  end if;

  if v_hour + p_weight > p_hour_limit then
    -- Suggest waiting until the oldest in-window row falls out, capped at 1h.
    return query select false, 'hour'::text, v_min, v_hour, v_day, 3600;
    return;
  end if;

  if v_day + p_weight > p_day_limit then
    return query select false, 'day'::text, v_min, v_hour, v_day, 86400;
    return;
  end if;

  insert into public.ai_chat_usage (user_id, weight)
  values (p_user_id, p_weight);

  return query select
    true,
    null::text,
    v_min + p_weight,
    v_hour + p_weight,
    v_day + p_weight,
    0;
end;
$$;

revoke all on function public.check_ai_chat_rate_limit(uuid, integer, integer, integer, integer)
  from public, anon, authenticated;

grant execute on function public.check_ai_chat_rate_limit(uuid, integer, integer, integer, integer)
  to service_role;
