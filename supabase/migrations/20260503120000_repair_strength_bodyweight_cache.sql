-- Repair bodyweight data used by strength analytics.
--
-- Some users have a valid bodyweight in one historical location while
-- profiles.weight_kg, the public strength cache input, is empty. Keep
-- daily_log_entries as the owner-visible source of truth, but backfill from the
-- older body_log_entries/profiles values when needed.

with latest_body_log_weights as (
  select distinct on (user_id)
    user_id,
    weight_kg
  from public.body_log_entries
  where weight_kg is not null and weight_kg > 0
  order by user_id, created_at desc, id desc
),
profile_only_weights as (
  select
    p.id as user_id,
    current_date as log_date,
    p.weight_kg,
    2 as source_priority
  from public.profiles p
  left join public.daily_log_entries d
    on d.user_id = p.id
    and d.weight_kg is not null
  where d.id is null
    and p.weight_kg is not null
    and p.weight_kg > 0
),
body_log_only_weights as (
  select
    b.user_id,
    current_date as log_date,
    b.weight_kg,
    1 as source_priority
  from latest_body_log_weights b
  left join public.daily_log_entries d
    on d.user_id = b.user_id
    and d.weight_kg is not null
  where d.id is null
),
missing_daily_weights as (
  select * from profile_only_weights
  union all
  select * from body_log_only_weights
)
insert into public.daily_log_entries (
  user_id,
  log_date,
  weight_kg,
  created_at,
  updated_at
)
select
  user_id,
  log_date,
  weight_kg,
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
from (
  select
    user_id,
    log_date,
    weight_kg,
    row_number() over (
      partition by user_id, log_date
      order by source_priority asc
    ) as rn
  from missing_daily_weights
) ranked_missing_daily_weights
where rn = 1
on conflict (user_id, log_date) do update
set
  weight_kg = coalesce(public.daily_log_entries.weight_kg, excluded.weight_kg),
  updated_at = timezone('utc'::text, now())
where public.daily_log_entries.weight_kg is null;

with latest_daily_weights as (
  select distinct on (user_id)
    user_id,
    weight_kg
  from public.daily_log_entries
  where weight_kg is not null and weight_kg > 0
  order by user_id, log_date desc, updated_at desc, id desc
),
latest_body_log_weights as (
  select distinct on (user_id)
    user_id,
    weight_kg
  from public.body_log_entries
  where weight_kg is not null and weight_kg > 0
  order by user_id, created_at desc, id desc
),
resolved_weights as (
  select
    p.id as user_id,
    coalesce(d.weight_kg, b.weight_kg, p.weight_kg) as weight_kg
  from public.profiles p
  left join latest_daily_weights d on d.user_id = p.id
  left join latest_body_log_weights b on b.user_id = p.id
  where coalesce(d.weight_kg, b.weight_kg, p.weight_kg) is not null
    and coalesce(d.weight_kg, b.weight_kg, p.weight_kg) > 0
)
update public.profiles p
set
  weight_kg = r.weight_kg,
  overall_strength_updated_at = null
from resolved_weights r
where p.id = r.user_id
  and p.weight_kg is distinct from r.weight_kg;
