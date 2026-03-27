-- Backfill profiles.weight_kg from the latest readable daily_log_entries weight.
--
-- Why:
-- - daily_log_entries is the owner-only source of truth for current weight.
-- - profiles.weight_kg is still needed as a public cache for friend-facing
--   strength views that cannot read another user's private daily_log_entries.

with latest_daily_weights as (
  select distinct on (user_id)
    user_id,
    weight_kg
  from public.daily_log_entries
  where weight_kg is not null
  order by user_id, log_date desc, updated_at desc, id desc
)
update public.profiles
set weight_kg = latest_daily_weights.weight_kg
from latest_daily_weights
where profiles.id = latest_daily_weights.user_id
  and profiles.weight_kg is distinct from latest_daily_weights.weight_kg;
