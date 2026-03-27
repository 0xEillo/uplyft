-- Backfill daily_log_entries.weight_kg from historical body_log_entries.
--
-- Why:
-- - Strength analytics reads bodyweight from daily_log_entries via hydrated profile data.
-- - Older installs may have weight history only in body_log_entries because that table
--   predates daily_log_entries.
--
-- Strategy:
-- - For each user/date pair, take the latest non-null body_log_entries.weight_kg.
-- - Insert missing daily_log_entries rows.
-- - If a daily_log_entries row already exists, only fill weight_kg when it is null.

with latest_body_weights as (
  select distinct on (user_id, ((created_at at time zone 'utc')::date))
    user_id,
    ((created_at at time zone 'utc')::date) as log_date,
    weight_kg,
    created_at
  from public.body_log_entries
  where weight_kg is not null
  order by user_id, ((created_at at time zone 'utc')::date), created_at desc, id desc
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
from latest_body_weights
on conflict (user_id, log_date) do update
set
  weight_kg = excluded.weight_kg,
  updated_at = timezone('utc'::text, now())
where public.daily_log_entries.weight_kg is null;
